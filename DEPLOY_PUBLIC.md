# Deploy ProofLens publicly (free demo)

This build supports two modes:
- Local: Ollama, no cloud key.
- Public demo: Render + a server-side Groq API key. Visitors never see or enter the key.

## 1. Push to GitHub
Upload the project files, but do NOT upload `.env`, `.venv`, `data`, `__pycache__`, or any API key.

## 2. Create a Groq API key
Create a key in the Groq Console. Keep it private. Do not put it in GitHub.

## 3. Deploy on Render
1. Create a Render account and connect GitHub.
2. Choose New > Blueprint and select this repository. Render reads `render.yaml`.
3. When Render asks for `GROQ_API_KEY`, paste the Groq key as a secret environment variable.
4. Deploy.
5. Open the generated `onrender.com` URL.

## Free-demo limitations
- Render Free may sleep after inactivity, so the first request after sleep can take longer.
- The free web-service filesystem is ephemeral. Notes, uploaded PDFs, history and SQLite changes can disappear after restart/redeploy/sleep. Use this build for a class/demo link, not permanent user storage.
- Public cloud mode intentionally uses keyword/BM25 RAG rather than paid cloud embeddings.
- Image reading, voice transcription and AI web-search discovery are disabled in the free public mode. Text checks, saved-note/PDF retrieval, direct source URLs and RAG answers remain available.
- Groq free usage is rate-limited; if the shared limit is busy, ProofLens asks the visitor to retry later.
