# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## Project Overview

MemoDeer (知道AI学习助手) — a full-stack AI learning assistant for middle school and university students. Users upload knowledge documents (PDF/DOCX/TXT/MD), the system extracts structured knowledge, then provides RAG-based Q&A with citations, semantic search, and AI-generated answers grounded in the user's personal knowledge base.

## Commands

### Backend (Python FastAPI, runs on PC)

```bash
cd backend
pip install -r requirements.txt
# Set DEEPSEEK_API_KEY in .env, then:
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

API docs at `http://localhost:8000/docs` once running.

### Frontend (React + Vite, runs anywhere)

```bash
cd frontend
npm install
npm run dev       # dev server on 0.0.0.0:5173
npm run build     # type-check + production build to dist/
```

Vite proxies `/api` requests to `http://localhost:8000` in dev. For mobile testing, connect phone and PC to the same WiFi, then access `http://<PC-IP>:5173` from the phone browser.

No test, lint, or format scripts are configured.

## Architecture

### Two-tier structure

```
frontend/   → React 18 + TypeScript + Vite 5 + Tailwind CSS 3
backend/    → Python FastAPI + SQLAlchemy 2 (async) + SQLite + ChromaDB
```

### Backend layers (`backend/app/`)

| Layer | Location | Role |
|-------|----------|------|
| API routes | `api/` | HTTP handlers: auth, notebooks, documents, chat (SSE), search |
| Core | `core/` | `database.py` (async engine/session), `models.py` (7 ORM models), `schemas.py` (Pydantic request/response) |
| Services | `services/` | Business logic — all are module-level singletons |
| Utils | `utils/exceptions.py` | Custom `AppException` hierarchy |

**Service singletons**: `llm_service`, `embedding_service`, `vector_store` are lazy-initialized module-level singletons — import them directly, no DI container beyond FastAPI's `Depends()`.

**LLM provider strategy — three-tier model architecture**:

| Tier | Property | Model Config | Temperature | Purpose |
|------|----------|-------------|-------------|---------|
| Flash | `.flash` | `LLM_FLASH_MODEL` (default `deepseek-v4-flash`) | 0.3 | Lightweight NLU: knowledge extraction from documents, text structuring. Can be switched to local 8B (Ollama) via `use_local_for_flash()`. |
| Pro | `.pro` | `LLM_PRO_MODEL` (default `deepseek-v4-pro`) | 0.7 | Strong reasoning: RAG Q&A with citations, complex logical questions from users. |
| Local | `.local` | `LLM_LOCAL_MODEL` (default `qwen3:8b`) | — | Reserved for local Ollama 8B model. Set `LLM_LOCAL_BASE_URL=http://localhost:11434/v1` to activate. Can replace Flash to save API costs on NLU tasks. |

All providers implement `BaseLLMProvider` abstract class via `OpenAICompatibleProvider` (OpenAI SDK), supporting both DeepSeek API and local Ollama with the same interface. Flash and Pro model IDs are independently configurable in `.env`. Note: `deepseek-chat` / `deepseek-reasoner` are deprecated aliases (sunset 2026-07-24) and should not be used in new configs.

**Auth**: JWT (HS256, 7-day expiry) via `get_current_user` FastAPI dependency. All data queries filter by `user_id`. Passwords hashed with bcrypt (passlib).

**Database**: SQLite via aiosqlite. Tables auto-created on startup via `Base.metadata.create_all` in the lifespan handler. `get_db()` async generator yields session, commits on success, rolls back on exception. All PKs are uuid4 hex strings.

**Vector store**: ChromaDB embedded, one collection per notebook (`nb_{notebook_id}`), top-k=8 retrieval.

### Frontend layers (`frontend/src/`)

| Layer | Location | Role |
|-------|----------|------|
| Pages | `pages/` | 7 pages: Login, Register, Home (notebook list), Notebook (documents), Chat (RAG Q&A), DocumentView (full-document Markdown viewer), Settings |
| Layout | `components/layout/` | `Layout` (wraps auth pages with drawer + `<Outlet/>`), `SideDrawer` |
| State | `store/` | `authStore.ts` (JWT + user, localStorage-backed), `uiStore.ts` (drawer, upload modal) |
| API | `api/client.ts` | Axios instance: base `/api`, 60s timeout, auto-attaches Bearer token, redirects to `/login` on 401 |

**Provider stack** at mount: `StrictMode → QueryClientProvider → BrowserRouter → App`

**Chat SSE**: `ChatPage` uses native `fetch()` with `ReadableStream` to consume SSE events (not Axios). Events: `token`, `status`, `citations`, `source`, `done`, `error`. The `source` event indicates whether the answer came from RAG (`"rag"`) or open-knowledge fallback (`"open"`).

Auth gate: `ProtectedRoute` checks `useAuthStore.token` from localStorage, redirects to `/login` if absent.

### Key data flows

**Upload**: file → save disk → `parser_service.extract_text()` → `_reformat_text_to_markdown()` (Flash LLM reformats raw text into structured Markdown) → `chunking_service.split_text()` → `embedding_service.embed()` → ChromaDB add + SQLite chunks → Flash LLM extract knowledge points (structured JSON)

**Q&A (auto mode, default)**: query → embed → ChromaDB search top-8 → if results found: build prompt with [1],[2] citations → Pro LLM stream answer (source="rag") → SSE；if no results found: fallback to Pro LLM open-knowledge answer with disclaimer (source="open") → SSE. User can save open answers as notes via "添加到笔记" button → edit → `POST /notebooks/{id}/notes`.

**Document viewing**: Navigate to DocumentViewPage → `GET /documents/{id}/content` returns all chunks → frontend joins into one continuous text → render as single ReactMarkdown document. Citation clicks append `?highlight={chunk_id}` → scroll to highlighted span.

**GenUI knowledge visualization**: LLM responses can include ```` ```genui ```` fenced code blocks with JSON data. `ChatPage`'s custom react-markdown `code` handler detects `language-genui`, parses the JSON, and renders a `<GenUI>` component. Supported types: `concept-card` (concept definition with icon points), `key-points` (numbered list), `comparison` (table), `steps` (vertical timeline), `example-box` (highlighted example).

**Note CRUD**: Users can create manual Markdown notes via "新建笔记" button in NotebookPage header, and delete documents via the 🗑 button on each document card. Deletion cascades: database records + ChromaDB vectors + disk files.

**Search**: query → embed → ChromaDB search → formatted results with doc names + scores

**Membership (simulated payment)**: Free users see premium banners and locked features. Upgrade via `/membership` page → simulated payment → `POST /api/user/upgrade-premium` sets `is_premium` flag. Three tiers: free, monthly (¥19.9, 30 days), lifetime (¥299, permanent).

**Quiz generation (premium)**: NotebookPage "出题" button → QuizPage → `POST /api/notebooks/{id}/quiz/generate` → Pro LLM (or mock data) → interactive quiz session with auto-grading and explanations.

**Knowledge cards & mnemonics (premium)**: NotebookPage tab switching (文档/知识点/卡片/口诀) → `POST /api/notebooks/{id}/premium/generate` → Pro LLM generates flip-cards and memory aids. Non-premium users see PremiumGate lock.

### Configuration

`backend/app/config.py` (Pydantic Settings) reads from `backend/.env`. Key defaults:
- `CHUNK_SIZE=500`, `CHUNK_OVERLAP=50`, `RETRIEVAL_TOP_K=8`
- `EMBEDDING_MODEL=BAAI/bge-small-zh-v1.5` — **identity** (which model to load; HuggingFace model ID)
- `EMBEDDING_LOCAL_DIR=./models/bge-small-zh-v1.5` — **location** (relative to `backend/`; leave empty to auto-derive to `backend/models/<safe-name>/`). The loader tries three tiers in order: this local dir → HuggingFace global cache `~/.cache/huggingface/hub/` → network download to global cache. See `services/embedding_service.py` for the fallback chain.
- `MAX_UPLOAD_SIZE=10MB`
- `LLM_FLASH_MODEL=deepseek-v4-flash` — NLU tasks (knowledge extraction); can swap to local 8B
- `LLM_PRO_MODEL=deepseek-v4-pro` — reasoning tasks (RAG Q&A); use strongest available
- `LLM_LOCAL_BASE_URL` (empty by default) — set to `http://localhost:11434/v1` to activate local Ollama 8B
- `LLM_LOCAL_MODEL=qwen3:8b` — local model name for Ollama
- `HF_ENDPOINT=https://hf-mirror.com` — mirror for first-time downloads; set in `app/main.py` lifespan **and** in any standalone download script (e.g. `scripts/download_embedding.py`) before `huggingface_hub` is imported.

## Project State

- Mid-development: core RAG Q&A, document upload, search, auth, GenUI visualization, global search, document viewing, note CRUD, membership system, quiz generation, knowledge cards & mnemonics
- **Membership**: Simulated payment (frontend complete, backend sets flag). Three tiers: free / monthly (¥19.9, 30d) / lifetime (¥299, permanent). New routes: `/membership`, `/notebook/:id/quiz`. User model extended with `is_premium`, `premium_type`, `premium_expire_at`.
- **Quiz (premium)**: NotebookPage "出题" button → QuizPage → API stub returns mock or Pro LLM-generated questions. Interactive session with choice/fill/mixed types, auto-grading, explanations.
- **Knowledge cards & mnemonics (premium)**: NotebookPage 4-tab layout (文档/知识点/卡片/口诀). API stub at `POST /api/notebooks/{id}/premium/generate` returns mock cards/mnemonics; Pro LLM integration pending.
- **Auth store** extended with `isPremium`, `premiumType`, `setPremium()` for runtime membership state management.
- Chat uses intelligent auto mode: always tries RAG first, falls back to open-knowledge with disclaimer if no relevant chunks found (uses `RAG_DISTANCE_THRESHOLD` filter)
- Uploaded documents are AI-reformatted into structured Markdown before chunking (Flash LLM, batched)
- GenUI system renders structured knowledge cards (concept-card, comparison, steps, etc.) from LLM-generated JSON in ```genui code blocks
- Global search iterates all user notebooks' ChromaDB collections, results grouped by notebook
- DocumentViewPage renders full document as continuous Markdown (joins all chunks), supports citation highlight scrolling
- Document processing runs synchronously in the request (not background tasks); a comment notes future Celery/ARQ migration
- No tests, no linting/formatting config, no CI/CD pipeline
- LLM three-tier architecture (Flash/Pro/Local) implemented — Flash and Pro have independent model IDs, Local reserved for Ollama 8B
- JWT secret in `.env` is a placeholder — needs replacement for any non-local deployment
- `apiBaseUrl` in Settings page is wired to the Axios client; ChatPage SSE also reads it. Mobile devices on the same LAN can point directly at `<PC-IP>:8000`
- `_extract_knowledge_points` in `rag_service.py` logs failures with the `[KP extract] batch N failed: ...` prefix to stdout instead of swallowing them — check server logs if a document shows `knowledge_point_count: 0` after `status: completed`
- Search returns `score = 1 - distance`; for BGE normalized vectors this can be negative (cosine distance ∈ [0, 2]). Don't interpret it as a percentage without clamping

## Known gotchas

- **Embedding model loader has a 3-tier fallback**: `services/embedding_service.py` tries in order — `EMBEDDING_LOCAL_DIR` (or auto-derived `backend/models/<safe-name>/`) → HF global cache `~/.cache/huggingface/hub/` → network download via `HF_ENDPOINT`. The first hit wins. To switch models, use `python scripts/download_embedding.py <new-model-id>` which downloads and updates `.env` in one step.
- **HF_ENDPOINT must be set early**: `app/main.py` sets it in the `lifespan` handler, but the embedding service ALSO sets it lazily on first `.model` access as a backstop. Standalone scripts (e.g. `scripts/download_embedding.py`) must set it before importing `huggingface_hub`. The pattern is `os.environ.setdefault("HF_ENDPOINT", settings.HF_ENDPOINT)`.
- **Embedding model dimension change = wipe ChromaDB**: switching between models with different output dimensions (e.g. `bge-small-zh` 512-dim → `bge-large-zh` 1024-dim) makes all existing vectors incompatible. Users must `rm -rf backend/data/chroma_db` and re-upload all documents.
- **Document upload is request-blocking**: `api/documents.py` calls `process_document` inline, which now includes an LLM reformatting step (`_reformat_text_to_markdown`). A 10MB PDF will hold the request open for parse → AI reformat (batch LLM calls) → chunk → embed pipeline (potentially 30-90 seconds for large documents). Long-running uploads will hit the FastAPI/uvicorn worker timeout; consider moving to `BackgroundTasks` before scaling beyond single-user demos.
- **AI reformat batching**: `_reformat_text_to_markdown()` processes documents up to 50,000 characters in batches of ~8,000 chars. Each batch is a separate Flash LLM call. Documents under 50 chars skip reformatting. LLM call failures are caught and silently fall back to the original raw text — check server logs for `[DocFormat]` prefixed messages to diagnose reformat failures.
- **GenUI renders only in ChatPage**: The `GenUI` component is defined in `components/common/GenUI.tsx` and only used in `ChatPage.tsx`'s custom ReactMarkdown `code` handler. If GenUI code blocks appear in document content (DocumentViewPage) or other Markdown contexts, they will NOT be rendered as cards — only the raw JSON will show.
- **`datetime.utcnow()` deprecation**: `core/models.py` and several routes still use `datetime.utcnow()`, which is deprecated in Python 3.12+. The project is currently tested on Python 3.14 with no deprecation warnings escalated, but a future upgrade path should switch to `datetime.now(timezone.utc)`.
- **DocumentViewPage joins chunks**: The frontend concatenates all chunk contents with `\n\n` to render as one continuous Markdown document. Chunk overlap (50 chars by default) means ~50 chars of duplicated text may appear at chunk boundaries in the rendered view. The highlight feature splits the joined text into three ReactMarkdown renders (before/highlight/after), which can break Markdown syntax that spans chunk boundaries (rare in practice).
