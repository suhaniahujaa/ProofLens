import asyncio
from contextlib import asynccontextmanager
from dataclasses import replace
from datetime import date
import json
import os
from pathlib import Path
from urllib.parse import urlsplit

from fastapi import FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.exceptions import RequestValidationError
from fastapi.responses import FileResponse, JSONResponse, Response
from fastapi.staticfiles import StaticFiles
from starlette.concurrency import run_in_threadpool
from starlette.middleware.trustedhost import TrustedHostMiddleware

from .config import ROOT, Settings, save_connection
from .engine import Engine, india_today
from .models import AskRequest, CheckRequest, ConnectionInput, ConnectionProbe, NoteInput, SourceInput, URLInput
from .store import Store
from .web import normalize_domain, pdf_pages


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or Settings()
    store = Store(settings.data_dir)
    engine = Engine(store, settings)
    checks = asyncio.Semaphore(2)

    @asynccontextmanager
    async def lifespan(app):
        engine.seed()
        yield

    app = FastAPI(title="ProofLens", version="2.0.0", lifespan=lifespan, docs_url=None, redoc_url=None,
                  description="Local evidence checking with retrieval-augmented generation.")
    app.state.store = store
    app.state.engine = engine
    app.add_middleware(TrustedHostMiddleware, allowed_hosts=["*"] if settings.public_deployment else ["localhost", "127.0.0.1", "[::1]", "testserver"])

    @app.middleware("http")
    async def browser_boundaries(request: Request, call_next):
        if request.method in {"POST", "PUT", "PATCH", "DELETE"} and request.url.path.startswith("/api/"):
            origin = request.headers.get("origin")
            if request.headers.get("x-prooflens") != "1" or (origin and origin != str(request.base_url).rstrip("/")):
                return JSONResponse({"detail": "Open ProofLens on this computer and try again."}, status_code=403)
            length = request.headers.get("content-length", "0")
            if length.isdigit() and int(length) > 17 * 1024 * 1024:
                return JSONResponse({"detail": "This upload is too large. Use a file under 15 MB."}, status_code=413)
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["Referrer-Policy"] = "no-referrer"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Content-Security-Policy"] = (
            "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: blob:; "
            "connect-src 'self'; media-src 'self' blob:; object-src 'none'; base-uri 'self'; frame-ancestors 'none'")
        if request.url.path.startswith("/api/"):
            response.headers["Cache-Control"] = "no-store"
        return response

    @app.exception_handler(RequestValidationError)
    async def invalid_fields(request: Request, exc: RequestValidationError):
        # Never echo request bodies: connection forms can contain credentials.
        detail = [{"loc": e["loc"], "msg": e["msg"], "type": e["type"]} for e in exc.errors()]
        return JSONResponse({"detail": detail}, status_code=422)

    @app.exception_handler(ValueError)
    async def invalid_input(request: Request, exc: ValueError):
        return JSONResponse({"detail": str(exc)}, status_code=400)

    @app.get("/api/status")
    def status():
        return {"name": "ProofLens", "version": "2.1.0", "api_ready": settings.configured, "provider": settings.provider,
            "model": settings.model, "timezone": settings.timezone,
            "documents": {"demo": len(store.documents("demo")), "live": len(store.documents("live"))},
            "source_count": len(store.sources()), "local_only": settings.provider == "ollama", "public_deployment": settings.public_deployment}

    @app.get("/api/settings")
    def connection_settings():
        return {"api_ready": settings.configured, "provider": settings.provider, "model": settings.model,
            "embedding_model": settings.embedding_model, "transcription_model": settings.transcription_model,
            "public_deployment": settings.public_deployment}

    @app.post("/api/settings")
    def update_connection(body: ConnectionInput):
        nonlocal settings, engine
        if settings.public_deployment:
            raise HTTPException(status_code=403, detail="AI settings are managed securely by the site owner on this public deployment.")
        key = body.api_key.strip() if body.api_key else settings.api_key
        if body.provider == "openai" and key and (len(key) < 15 or any(char.isspace() for char in key) or any(ord(c) < 32 for c in key)):
            raise ValueError("Paste the complete API key into the password field. It should contain no spaces or line breaks.")
        values = {"PROOFLENS_AI_PROVIDER": body.provider, "OPENAI_API_KEY": key, "PROOFLENS_MODEL": body.model,
            "PROOFLENS_EMBEDDING_MODEL": body.embedding_model, "OPENAI_TRANSCRIPTION_MODEL": body.transcription_model}
        try:
            save_connection(settings.env_file, values)
        except OSError as exc:
            raise ValueError("Settings could not be saved. Keep the project in a writable folder and try again.") from exc
        # Match the saved file in this server and in future launches from this process.
        os.environ.update(values)
        settings = replace(settings, provider=body.provider, api_key=key, model=body.model, embedding_model=body.embedding_model,
                           transcription_model=body.transcription_model)
        engine = Engine(store, settings)
        app.state.engine = engine
        return {**connection_settings(), "note": "AI settings saved. Free local mode uses Ollama on this computer; no API credits are required."}

    @app.post("/api/settings/test")
    async def test_connection():
        async with checks:
            provider = engine.provider
            if not provider.settings.configured:
                raise ValueError("Choose an AI provider in Settings first.")
            await provider.structured("Return status=ok. This is a connection and structured-output test.",
                                      {"test": "connection"}, ConnectionProbe)
            if provider.settings.provider != "groq":
                await provider.embeddings(["ProofLens connection test"])
            return {"ok": True, "note": "Connected. Public cloud AI is ready." if provider.settings.provider == "groq" else "Connected. The text model and RAG meaning search both responded."}

    @app.post("/api/documents/note", status_code=201)
    def save_note(body: NoteInput):
        if len(body.text.strip()) < 30:
            raise ValueError("Write at least 30 characters so there is enough information to search.")
        return store.add_document(title=body.title, pages=[body.text], collection="live", origin="note")

    @app.post("/api/ask")
    async def ask_library(body: AskRequest):
        async with checks:
            return await engine.ask(body.question)

    @app.get("/api/answers")
    def saved_answers():
        return store.answers()

    @app.delete("/api/answers")
    def delete_answers():
        store.delete_answers()
        return {"ok": True}

    @app.get("/api/samples")
    def samples():
        return [{k: c[k] for k in ("id", "label", "message", "message_date")} for c in engine.samples]

    @app.post("/api/check")
    async def check(body: CheckRequest):
        async with checks:
            return await engine.check(body)

    @app.get("/api/sources")
    def list_sources():
        return store.sources()

    @app.post("/api/sources", status_code=201)
    def add_source(body: SourceInput):
        if len(store.sources()) >= 20:
            raise ValueError("This local project supports up to 20 approved source domains.")
        return store.add_source(body.name, normalize_domain(body.domain))

    @app.delete("/api/sources/{source_id}")
    def delete_source(source_id: str):
        if not store.source(source_id):
            raise HTTPException(404, "Source not found.")
        store.delete_source(source_id)
        return {"ok": True}

    @app.post("/api/documents/url")
    async def add_url(body: URLInput):
        source = store.source(body.source_id)
        if not source:
            raise HTTPException(404, "Choose an approved source first.")
        if body.published_on and body.published_on > india_today():
            raise ValueError("A publication date cannot be in the future.")
        return await engine.import_url(source, body.url,
            body.published_on.isoformat() if body.published_on else None, body.follow_links)

    @app.post("/api/documents/upload", status_code=201)
    async def upload_reference(file: UploadFile = File(...)):
        data = await file.read(settings.max_upload + 1)
        if len(data) > settings.max_upload:
            raise HTTPException(413, "Use a file smaller than 15 MB.")
        name = (file.filename or "Reference").replace("\\", "/").rsplit("/", 1)[-1][:200]
        suffix = Path(name).suffix.lower()
        if suffix == ".pdf":
            pages = await run_in_threadpool(pdf_pages, data)
        elif suffix in {".txt", ".md"}:
            try:
                pages = [data.decode("utf-8-sig")[:120000]]
            except UnicodeDecodeError as e:
                raise ValueError("Please use a UTF-8 text file or a text-based PDF.") from e
        else:
            raise ValueError("Reference uploads support PDF, TXT, and Markdown files.")
        record = store.add_document(title=name, pages=pages, origin="upload", collection="live")
        return {**record, "note": "Saved as an unverified reference. Uploading a file does not authenticate its issuer; use its official website URL for decisive evidence."}

    @app.get("/api/documents")
    def documents(mode: str = "live"):
        if mode not in {"demo", "live"}:
            raise HTTPException(400, "Mode must be demo or live.")
        return store.documents(mode)

    @app.get("/api/documents/{doc_id}")
    def document(doc_id: str):
        record = store.document(doc_id)
        if not record:
            raise HTTPException(404, "Document not found.")
        return record

    @app.delete("/api/documents/{doc_id}")
    def remove_document(doc_id: str):
        if not store.document(doc_id):
            raise HTTPException(404, "Document not found.")
        store.delete_document(doc_id)
        return {"ok": True}

    @app.post("/api/extract")
    async def extract(file: UploadFile = File(...), kind: str = Form(...)):
        data = await file.read(settings.max_upload + 1)
        if not data or len(data) > settings.max_upload:
            raise ValueError("Choose a non-empty image/audio file under 15 MB.")
        if not settings.configured:
            raise ValueError("Screenshot and voice reading need an API key. Open Settings and save your key first.")
        if kind == "image":
            text = await engine.provider.extract_image(data)
        elif kind == "audio":
            name = (file.filename or "recording.webm").replace("\\", "/").rsplit("/", 1)[-1]
            if Path(name).suffix.lower() not in {".mp3", ".mp4", ".mpeg", ".mpga", ".m4a", ".wav", ".webm", ".ogg"}:
                raise ValueError("Use MP3, M4A, MP4, WAV, WebM, MPEG, or OGG audio.")
            text = await engine.provider.transcribe(data, name, file.content_type or "application/octet-stream")
        else:
            raise ValueError("Choose image or audio input.")
        return {"text": text, "needs_review": True,
                "note": "Check the extracted text, especially names and dates, before running the evidence check."}

    @app.get("/api/history")
    def history(mode: str = "live"):
        if mode not in {"demo", "live"}:
            raise HTTPException(400, "Invalid mode.")
        return store.history(mode)

    @app.delete("/api/history")
    def clear_history(mode: str = "live"):
        if mode not in {"demo", "live"}:
            raise HTTPException(400, "Invalid mode.")
        store.delete_history(mode)
        return {"ok": True}

    @app.get("/api/history/{check_id}")
    def get_history(check_id: str):
        record = store.check(check_id)
        if not record:
            raise HTTPException(404, "Check not found.")
        return record

    @app.get("/api/history/{check_id}/export")
    def export(check_id: str):
        record = get_history(check_id)
        return Response(json.dumps(record, ensure_ascii=False, indent=2), media_type="application/json",
            headers={"Content-Disposition": f'attachment; filename="ProofLens-report-{record["id"][:8]}.json"'})

    @app.get("/")
    def index():
        return FileResponse(ROOT / "static/index.html")

    app.mount("/static", StaticFiles(directory=ROOT / "static"), name="static")
    return app


app = create_app()
