# ProofLens 2.0

Find the evidence behind a message, and ask questions about information you save.

A local MCA project using Python, FastAPI, SQLite and retrieval-augmented generation (RAG). Includes a responsive interface, two original AI-generated illustrations, sliding tabs, a closable sidebar, saved notes and document questions with source quotes.

## Start on Windows

Open the folder containing `start.py` in VS Code. Run:

```powershell
py -3.12 start.py
```

Or double-click `START_WINDOWS.bat`. Open **http://127.0.0.1:8000** if the browser does not open. Keep the terminal running while you use the app. Open `START_HERE.html` for simple instructions.

Python 3.12 is the tested version. The starter accepts 3.11–3.14, tries to find an installed compatible interpreter, checks the actual interpreter inside `.venv`, preserves an incompatible environment in `.venv-previous-…`, and installs ready-made dependency wheels. This avoids compiling `pydantic-core` under an unsupported Python 3.15 environment. Dependencies are pinned in `requirements.txt`.

On macOS/Linux: `python3 start.py` or `bash start_mac_linux.sh`.

## Updating your existing project

1. Stop ProofLens with **Ctrl+C**. Keep that PowerShell window open if you previously set the API key there.
2. Extract the new ZIP to a separate place.
3. Open its `ProofLens` folder. Copy its contents into your existing project folder — the one containing `start.py`. Choose **Replace files** when Windows asks.
4. Keep your existing **`data` folder**, **`.env` file** and **`.venv` folder**. The ZIP contains none of these, so merging the new files preserves them. Do not delete the old project folder.
5. Run `py -3.12 start.py` again in the existing folder. Refresh the browser with **Ctrl+F5**.

The application upgrades the existing SQLite database by adding the answers table. Existing sources, documents, cached vectors and check reports are preserved.

## Connect AI

1. Open **Settings** in ProofLens.
2. Paste your own OpenAI API key into the password box and click **Save connection**.
3. Click **Test saved connection**. It sends a small structured-text request and an embedding request; normal API charges may apply.
4. A successful test confirms those two configured models responded. Web search, image reading and voice permissions are checked when used.

Saving updates the running app immediately and writes connection settings to the server’s `.env` file. A blank key field keeps an existing key. Keys are never returned by status/settings APIs or saved in browser storage. Updating an existing configuration preserves unrelated `.env` entries. Environment variables take precedence at startup; using Settings updates the running server and its saved settings together.

The API account needs available API credits and access to the configured models. A ChatGPT plan does not itself establish API billing access. No paid API request was run during development because no live key was available here. Use the connection test on your computer.

The defaults are `gpt-5.4-mini`, `text-embedding-3-small` (512 dimensions) and `gpt-transcribe`. Change them in Settings if your API account uses another compatible model. The meaning-search adapter expects a model supporting the dimensions parameter. Precise, redacted errors show HTTP status, error code, rejected parameter and request ID when the service supplies them. A failed request does not create an evidence verdict.

## Save information and ask about it

**Evidence sources → Write a note**

Title: `MCA admission checklist`

Information:

> For MCA admission, students must bring their original marksheets, two passport photographs and a government photo identity card.

Click **Save note**. Open **Ask your library** and ask:

> What documents should I bring for MCA admission?

With a working API connection, the app retrieves the relevant saved passage and asks the AI to answer from it. Each answer point needs a quote that the server can find in a retrieved passage. Open the source under each point to inspect it yourself.

You can instead upload a text-based PDF, TXT or Markdown file, or import an approved website page. The saved information can answer questions without being authenticated as an official announcement. Library answers describe the documents; they do not independently prove those documents are true.

Close the browser, reopen the same local address, and return to **Evidence sources** or **History**. The saved note and answer remain. Restarting the Python server also preserves them.

## Check a real announcement

1. Under **Evidence sources → Website**, approve the real issuing website, after checking its ownership yourself.
2. Import the direct notice page or text-based PDF. Supply its printed publication date if the page does not expose one.
3. Under **Check a message**, use **My workspace**, paste the claim, and supply the organization and original message date where needed.
4. Choose whether to search the approved websites for fresh material, then click **Find the evidence**.
5. Read the source quotes, dates and limitations. Open the original source before acting on an urgent announcement.

Real example to try:

- Organization: **ISRO**
- Domain: `isro.gov.in`
- Page: https://www.isro.gov.in/Ch3_Lunar_Orbit_Insertion_Press_Release.html
- Publication date printed on that page: **5 August 2023** (`2023-08-05`)
- Claim: **Chandrayaan-3 successfully entered lunar orbit on 5 August 2023.**

The source page reports successful lunar orbit insertion on that date. This is an example input, not a built-in verdict. The app must fetch and retrieve evidence and the AI comparison must pass the evidence rules.

## RAG implementation

1. **Store:** save document text, origin, source URL, publication date and retrieval time in SQLite.
2. **Chunk:** split text into overlapping passages of roughly 1,200 characters with 180-character overlap, preserving page numbers.
3. **Retrieve:** BM25 finds matching words. Cached, 512-dimensional embeddings find related meaning. Reciprocal rank fusion combines both rankings and limits passages per document for source diversity.
4. **Augment:** send only selected passages and their IDs beside the question or claim. Treat document text as untrusted data.
5. **Generate:** request a structured answer or structured claim findings from the AI.
6. **Check citations:** reject unknown chunk IDs and quotes absent from the actual retrieved text. Library answer points with invalid citations are removed. Claim verdicts are computed in application code after origin, scope and date checks.
7. **Remember:** save vector caches, answers and evidence reports for later use.

Meaning search indexes selected chunks on demand and caches vectors. Collections of up to 220 loaded passages receive meaning-search coverage of every passage, including older notes with different wording. A request embeds up to 220 selected passages; word search reads up to the most recent 2,500 stored chunks. Meaning-search failure falls back to word search and displays a warning. Large collections can exceed this bounded prototype’s coverage. This is real retrieval and AI generation, with documented limits.

## Evidence rules

- Every decisive claim finding needs a 24–500 character quote present in a retrieved passage, from a page actually fetched from an approved issuing website.
- Notes and uploads can answer library questions; they stay context-only for official announcement checking.
- Organization, event, scope and time must match. Those semantic checks still depend on AI interpretation.
- Time-sensitive claims need an event date and a publication date; future publication dates are rejected. Sources more than 120 days from an event additionally need its exact written date in the quote. Old timetables are not rejected solely for being old. This conservative date-text check recognizes ISO dates and common full English month formats; other formats may need manual review.
- Reimporting an unchanged page with a corrected publication date updates that date while retaining its chunks and cached vectors.
- Relative words such as “tomorrow” need the original message date. Missing context prevents a decisive verdict.
- Both sides of conflicting evidence are shown. Newer publication alone does not settle a conflict.
- Search snippets, a missing notice, an official-looking filename and model memory are not proof.
- Supporting, contradicting, mixed and insufficient results describe the evidence checked. No fabricated confidence percentages are shown.

## What stays saved

| Information | Saved where | After closing/restarting? |
| --- | --- | --- |
| Websites, notes, imported/uploaded document text | `data/prooflens.sqlite3` | Yes |
| Document chunks and cached embeddings | Same SQLite database | Yes |
| Message reports and library answers | Same SQLite database | Yes |
| API key and model settings | Server `.env` file when saved in Settings | Yes |
| Drafts, selected page/workspace, tabs, sidebar preference | Browser localStorage | Yes, in the same browser and local address |
| Original image/audio files | Not saved | Extracted text becomes a draft |

Keep `data` and `.env` when updating or moving the project. Browser preferences belong to the specific browser/origin; private browsing or clearing browser storage removes drafts and preferences. Saved SQLite information remains. Deleting a source/document intentionally clears live report and answer history containing document quotes; the app asks before doing this. Clearing history alone keeps the documents.

## Interface

- Animated sidebar highlight and sliding text/screenshot/voice and website/upload/note controls.
- Tab controls support click/tap, arrow keys, Home/End and horizontal swipes.
- The sidebar has a close button, a persistent header menu button, a mobile backdrop and Escape-to-close.
- Mobile bottom navigation; responsive cards; reduced-motion preference respected.
- Original locally bundled AI artwork, documented with generation prompts in `static/assets/ARTWORK.md`.
- The former learning page/navigation item has been removed. Connection setup lives in Settings.
- My workspace is the initial default. Reopening remembers your workspace instead of resetting to fictional samples.

The optional **Fictional sample lab** remains separate for four offline teaching cases. It uses real keyword retrieval and prepared annotations, not an offline language model. It cannot check arbitrary real messages. No sample content enters the live collection.

## Files and technology

| Path | Purpose |
| --- | --- |
| `start.py`, `START_WINDOWS.bat`, `run.py` | Setup and local launch |
| `prooflens/app.py` | API routes and local browser boundaries |
| `prooflens/config.py` | Fresh configuration reads and atomic connection saving |
| `prooflens/store.py` | Persistent documents, chunks, vectors, reports and answers |
| `prooflens/retrieval.py` | BM25, cosine similarity and reciprocal rank fusion |
| `prooflens/engine.py` | Library RAG, claim comparison and citation validation |
| `prooflens/provider.py` | AI HTTP adapters and redacted diagnostics |
| `prooflens/web.py` | Approved-site HTML/PDF fetching and date extraction |
| `static/` | HTML/CSS/JavaScript and original artwork; no runtime CDN |
| `sample_data/` | Separate fictional teaching cases |
| `docs/PROJECT_EXPLANATION.md` | Simple English/Hinglish notes for your MCA presentation |
| `docs/TESTING.md`, `tests/` | Validation and repeatable checks |

Python, FastAPI, Uvicorn, SQLite, HTTPX, Pydantic, pypdf, Pillow, python-multipart, python-dotenv and plain HTML/CSS/JavaScript. There is no separate database or npm installation to start the app.

## Limits and validation

This is a local single-user prototype at 127.0.0.1, not a deployed multi-user service. Data is local to this project folder. Downloaded text is bounded to 5 MB; reference uploads to 15 MB. PDF extraction reads up to 30 text pages with stream limits. Scanned PDFs, bot-protected pages and JavaScript-only websites may not be readable. Multilingual model accuracy and real-world fact-checking accuracy have not been benchmarked. AI may misunderstand even a valid quote; inspect the source.

HTTPS ingestion validates public addresses, pins checked IPs, verifies TLS and rechecks redirects. The local API uses same-origin mutation protection, a custom request header, trusted hosts and a restrictive content security policy. Keys and full AI responses are excluded from browser storage. A public deployment would require its own access-control design.

Run the automated tests after setup:

```powershell
.venv\Scripts\python.exe -m unittest discover -s tests -v
```

On macOS/Linux: `.venv/bin/python -m unittest discover -s tests -v`.

## Troubleshooting

| Problem | Try this |
| --- | --- |
| Saved documents seem missing | Choose My workspace at the top; use the same project folder and its existing `data` folder. |
| Old design still appears | Restart the server, then press Ctrl+F5 in the browser. |
| AI request fails | Open Settings, save the connection and run Test saved connection. Read the specific error shown; it distinguishes key, credits, model, request and service errors. |
| Only a generic older error appears | Merge the updated source files into the existing project and restart. |
| Python 3.15 / Rust / `link.exe` installation error | Use `py -3.12 start.py`. The updated starter rebuilds incompatible environments automatically. |
| The page cannot connect | Keep the terminal running; open the printed local address. |
| Port 8000 is busy | Stop the older app or run `py -3.12 start.py --port 8001`. Documents remain saved; browser draft preferences belong to each address. |
| No publication date found | Copy the date printed on the notice into the import form and reimport. |
| Every arbitrary sample-lab message is inconclusive | Use My workspace with a working API connection and relevant sources. |
| Library answer says information is missing | Add the relevant note/document, then ask a specific question. Missing information does not become a guessed answer. |

Primary API documentation: [Structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs), [web search](https://developers.openai.com/api/docs/guides/tools-web-search), [embeddings](https://developers.openai.com/api/docs/guides/embeddings), [vision](https://developers.openai.com/api/docs/guides/images-vision), [transcription](https://developers.openai.com/api/docs/guides/speech-to-text), [API errors](https://developers.openai.com/api/docs/guides/error-codes).
