# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

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
frontend/   → React 18 + TypeScript + Vite 5 + Tailwind CSS 3 + Zustand + React Query
backend/    → Python FastAPI + SQLAlchemy 2 (async) + SQLite + ChromaDB
```

### Backend layers (`backend/app/`)

| Layer | Location | Role |
|-------|----------|------|
| API routes | `api/` | 9 route files: auth, notebooks, documents, folders, chat (SSE), search, quiz, premium, payment |
| Core | `core/` | `database.py` (async engine/session with self-migration), `models.py` (10 ORM models), `schemas.py` (Pydantic request/response) |
| Services | `services/` | 6 singleton services: llm_service, embedding_service, vector_store, rag_service, parser_service, chunking_service |
| Utils | `utils/exceptions.py` | Custom `AppException` hierarchy |

**Service singletons**: All services are lazy-initialized module-level singletons — import them directly, no DI container beyond FastAPI's `Depends()`.

**LLM provider strategy — three-tier model architecture**:

| Tier | Property | Model Config | Temperature | Purpose |
|------|----------|-------------|-------------|---------|
| Flash | `.flash` | `LLM_FLASH_MODEL` (default `deepseek-v4-flash`) | 0.3 | Lightweight NLU: knowledge extraction, document reformatting, quiz generation, knowledge cards & mnemonics. Can be switched to local 8B (Ollama) via `use_local_for_flash()`. |
| Pro | `.pro` | `LLM_PRO_MODEL` (default `deepseek-v4-pro`) | 0.7 | Strong reasoning: RAG Q&A with citations, complex logical questions from users. |
| Local | `.local` | `LLM_LOCAL_MODEL` (default `qwen3:8b`) | — | Reserved for local Ollama 8B model. Set `LLM_LOCAL_BASE_URL=http://localhost:11434/v1` to activate. Can replace Flash to save API costs on NLU tasks. |

All providers implement `BaseLLMProvider` abstract class via `OpenAICompatibleProvider` (OpenAI SDK), supporting both DeepSeek API and local Ollama with the same interface. Flash and Pro model IDs are independently configurable in `.env`. Note: `deepseek-chat` / `deepseek-reasoner` are deprecated aliases (sunset 2026-07-24) and should not be used in new configs.

**Auth**: JWT (HS256, 7-day expiry) via `get_current_user` FastAPI dependency. All data queries filter by `user_id`. Passwords hashed with bcrypt (passlib). Premium gating via `require_premium` dependency (wraps `get_current_user`, raises 403 for free users). `get_current_user` also runs `check_premium_status()` on every request — auto-downgrades expired monthly members to free tier.

**Database**: SQLite via aiosqlite. Tables auto-created on startup via `Base.metadata.create_all` in the lifespan handler. `get_db()` async generator yields session, commits on success, rolls back on exception. All PKs are uuid4 hex strings. 10 ORM models: `User`, `Notebook`, `Folder`, `Document`, `Chunk`, `ChatSession`, `ChatMessage`, `PaymentOrder`, `KnowledgePoint`, `QuizAttempt`.

**Vector store**: ChromaDB embedded, one collection per notebook (`nb_{notebook_id}`), top-k=8 retrieval.

### API routes detail

| File | Prefix | Key endpoints |
|------|--------|--------------|
| `auth.py` | `/api/auth` | register, login, `/me` (GET/PUT profile), `/stats`, `/ask` (text selection Q&A) |
| `notebooks.py` | `/api/notebooks` | CRUD, summary, knowledge-points extract, notes CRUD |
| `documents.py` | `/api/documents` | upload, content get/update, re-vectorize, move, delete |
| `folders.py` | `/api` | folder CRUD under notebooks, hierarchical tree with cycle prevention |
| `chat.py` | `/api` | chat sessions CRUD, messages, SSE streaming Q&A |
| `search.py` | `/api/search` | global cross-notebook search |
| `quiz.py` | `/api` | quiz generation (Flash LLM), submit results, wrong-answer tracking (per-notebook + global), batch delete |
| `premium.py` | `/api` | knowledge cards & mnemonics generation (Flash LLM), card CRUD (get/update/delete by knowledge_point_id) |
| `payment.py` | `/api/payment` | order creation, simulated payment, order history |

**Free user limits** (enforced in config + notebooks route): 3 notebooks max, 5 documents per notebook, 10 daily chat messages.

### Key service files

| Service | `services/` file | Key responsibilities |
|---------|-----------------|---------------------|
| LLM | `llm_service.py` | Three-tier OpenAI-compatible provider, model routing |
| Embedding | `embedding_service.py` | BGE-small-zh sentence-transformers, 3-tier model loading fallback |
| Vector store | `vector_store.py` | ChromaDB collection management, add/search/delete |
| RAG | `rag_service.py` | Document processing pipeline, Q&A with citations, `generate_knowledge_cards()`, `generate_mnemonics()` |
| Parser | `parser_service.py` | PDF (PyMuPDF), DOCX (python-docx), TXT/MD extraction |
| Chunking | `chunking_service.py` | Text splitting with overlap, token estimation |

### Frontend layers (`frontend/src/`)

| Layer | Location | Role |
|-------|----------|------|
| Pages | `pages/` | 10 pages: Login, Register, Home (notebook list), Notebook (VSCode-style file tree + 4-tab content), Chat (SSE), DocumentView (Markdown + highlight), Settings, Membership, Quiz, About, Profile |
| Chat | `components/chat/` | `ChatPanel` — reusable SSE streaming chat with inline citation rendering, GenUI code block detection, HTML sandbox preview, "add to note" button |
| File tree | `components/file-tree/` | `FileTree` (searchable container), `FileTreeNode` (recursive expand/collapse, inline rename, drag), `FileContextMenu` (right-click actions: rename/move/delete) |
| Editor | `components/editor/` | `MarkdownEditor` — dual-mode preview/edit with synced line numbers, Ctrl+S save, word/char counter |
| Common | `components/common/` | `GenUI`, `GlobalSearchModal` (Ctrl+K, cross-notebook), `SelectionAsk` (text-select → ask AI), `KnowledgePanel` (cards + mnemonics CRUD), `KnowledgeCards`, `MnemonicsList`, `PendingVectorizeBar`, `PremiumGate`, `ObsidianMarkdown` (wikilinks, callouts, highlights) |
| Layout | `components/layout/` | `Layout` (wraps protected routes with drawer + `<Outlet/>`), `SideDrawer` |
| State | `store/` | `authStore.ts` (JWT + user + premium state, localStorage-backed, logout clears React Query cache), `uiStore.ts` (drawer, upload modal, global search, sidebar width, active file, pending vectorize count, 5 color themes) |
| API | `api/` | `client.ts` (Axios: dynamic base URL, 60s timeout, auto Bearer token, 401→redirect), `queryClient.ts` (React Query: retry 1, staleTime 30s, no refetchOnWindowFocus) |

**Provider stack** at mount: `StrictMode → QueryClientProvider → BrowserRouter → App`

**Routing** (`App.tsx`): `/login`, `/register`, `/` (protected layout wrapper) containing routes: index→Home, `notebook/:id`→Notebook, `notebook/:id/chat/:sid?`→Chat, `notebook/:id/quiz`→Quiz, `membership`, `about`, `profile`, `settings`. Standalone: `/document/:docId/view`.

**Chat SSE**: `ChatPage` / `ChatPanel` use native `fetch()` with `ReadableStream` to consume SSE events. Events: `token`, `status`, `citations`, `source` (`"rag"` | `"open"`), `done`, `error`.

**Color theme system**: `uiStore` supports 5 themes (`blue`/`purple`/`orange`/`green`/`pink`), persisted to localStorage, applied via `document.documentElement.dataset.theme`. Tailwind uses CSS variables for theming.

### Key data flows

**Upload pipeline**: file → save disk → `parser_service.extract_text()` → `_reformat_text_to_markdown()` (Flash LLM, batched, ~8000 char batches, max 50000 chars) → `chunking_service.split_text()` → `embedding_service.embed()` → ChromaDB add + SQLite chunks → Flash LLM extract knowledge points (structured JSON)

**Document edit → re-vectorize**: User edits Markdown in editor → `PUT /documents/{id}/content` → sets `needs_revectorize=1` → `PendingVectorizeBar` shows count → user clicks "一键向量化" → `POST /documents/{id}/re-vectorize` → deletes old chunks + vectors → re-chunks + re-embeds → clears flag. Or `POST /notebooks/{id}/vectorize-all` to batch-process all pending.

**Q&A (auto mode, hybrid retrieval)**: query → embed → ChromaDB vector search top-8 → keyword search via SQLite LIKE (sliding window 2–4 char substrings, weighted by match length) → merge + deduplicate + sort by score → filter by `RAG_DISTANCE_THRESHOLD=0.85` → if results found: build prompt with `[1]`,`[2]` citations → Pro LLM stream answer (source=`"rag"`) → SSE；if no results: fallback to Pro LLM open-knowledge answer with disclaimer (source=`"open"`) → SSE. User can save open answers as notes via "添加到笔记" → edit → `POST /notebooks/{id}/notes`.

**Obsidian-style AI reformatting**: `_reformat_text_to_markdown()` instructs Flash LLM to produce Obsidian-compatible Markdown: YAML frontmatter, `[[wikilinks]]`, `> [!callout]` blocks, `==highlights==`, tables, proper headings. Frontend `ObsidianMarkdown` component renders 14 callout types (note/tip/info/warning/danger/important/success/question/example/quote/bug/todo/abstract/failure) with distinct icons and colors.

**Notebook summary (SSE)**: `POST /notebooks/{id}/summarize` → Flash LLM generates ~300-char summary via SSE → auto-creates chat session → returns `session_id` for continued conversation.

**File tree API**: `GET /notebooks/{id}/tree` returns nested `TreeNode` structure combining folders and documents into a single hierarchy for the VSCode-style sidebar.

**Document viewing**: Navigate to DocumentViewPage → `GET /documents/{id}/content` returns all chunks → frontend joins with `\n\n` → render as single ReactMarkdown. Citation clicks append `?highlight={chunk_id}` → scroll to highlighted span.

**GenUI knowledge visualization**: LLM responses can include ` ```genui ` fenced code blocks with JSON data. ChatPage/SelectionAsk custom react-markdown `code` handler detects `language-genui`, parses JSON, renders `<GenUI>`. Supported types: `concept-card`, `key-points`, `comparison`, `steps`, `example-box`.

**Text selection → inline ask**: `SelectionAsk` component wraps content areas. User selects text → popup appears at selection position → type question → Flash LLM answers in-place. Used in DocumentViewPage and NotebookPage document previews.

**Search**: query → embed → ChromaDB search across all user notebooks → formatted results grouped by notebook with doc names + scores. Score = `1 - distance` (BGE cosine distance ∈ [0,2], so scores can be negative — don't interpret as percentage without clamping).

**Membership (simulated payment)**: Three tiers: free / monthly (¥19.9, 30d auto-renewal logic, stackable) / lifetime (¥299, permanent). Payment flow: `POST /api/payment/orders` → `POST /api/payment/orders/{id}/pay` → user upgraded + order marked paid. Payment order history at `GET /api/payment/orders`.

**Quiz (premium, live Flash LLM)**: NotebookPage "出题" → QuizPage → `POST /notebooks/{id}/quiz/generate` → Flash LLM generates questions from knowledge points (or falls back to document chunks) → interactive session with choice/fill/mixed types → auto-grading + explanations per question → submit saves to `quiz_attempts` table → wrong answers viewable in notebook + globally.

**Knowledge cards & mnemonics (premium, live Flash LLM)**: NotebookPage tabs (文档/知识点/卡片/口诀) → `POST /notebooks/{id}/premium/generate` → Flash LLM generates flip-cards and memory aids from knowledge points/documents. Cards stored in `knowledge_points` table with front/back in `content` field (`**front**\n\nback` format). CRUD endpoints for individual card edit/delete.

**Wrong answer book**: `QuizAttempt` model tracks every answer. Endpoints: per-notebook wrong stats (grouped by knowledge point), per-notebook wrong list, global wrong list (cross-notebook), single delete, batch delete. Used by QuizPage for "错题本" feature.

### Configuration

`backend/app/config.py` (Pydantic Settings) reads from `backend/.env`. Key defaults:
- `DEEPSEEK_API_KEY=""`, `DEEPSEEK_BASE_URL="https://api.deepseek.com"`
- `LLM_FLASH_MODEL=deepseek-v4-flash` — NLU tasks (knowledge extraction, document reformat, quiz, cards)
- `LLM_PRO_MODEL=deepseek-v4-pro` — reasoning tasks (RAG Q&A)
- `LLM_LOCAL_BASE_URL=""` — set to `http://localhost:11434/v1` to activate local Ollama
- `LLM_LOCAL_MODEL=qwen3:8b`
- `EMBEDDING_MODEL=BAAI/bge-small-zh-v1.5` — **identity** (HuggingFace model ID)
- `EMBEDDING_LOCAL_DIR=./models/bge-small-zh-v1.5` — **location** (relative to `backend/`). Loader tries 3 tiers: local dir → HF global cache → network download. See `embedding_service.py`.
- `CHUNK_SIZE=500`, `CHUNK_OVERLAP=50`, `RETRIEVAL_TOP_K=8`
- `MAX_UPLOAD_SIZE=10MB`
- `FREE_MAX_NOTEBOOKS=3`, `FREE_MAX_DOCUMENTS_PER_NOTEBOOK=5`, `FREE_DAILY_CHAT_MESSAGES=10`
- `HF_ENDPOINT=https://hf-mirror.com` — mirror for first-time downloads; must be set before `huggingface_hub` import in standalone scripts
- `JWT_SECRET` is a placeholder — replace for any non-local deployment

## Known gotchas

- **Embedding model loader has a 3-tier fallback**: `embedding_service.py` tries — `EMBEDDING_LOCAL_DIR` → HF global cache `~/.cache/huggingface/hub/` → network download via `HF_ENDPOINT`. The first hit wins. Use `python scripts/download_embedding.py <model-id>` to switch.
- **HF_ENDPOINT must be set early**: `main.py` sets it in lifespan, embedding service sets it lazily as backstop. Standalone scripts must set it before importing `huggingface_hub`: `os.environ.setdefault("HF_ENDPOINT", settings.HF_ENDPOINT)`.
- **Embedding model dimension change = wipe ChromaDB**: switching models with different dimensions (e.g. 512→1024) invalidates all vectors. Must `rm -rf backend/data/chroma_db` and re-upload.
- **Document upload is request-blocking**: full pipeline runs inline (parse → AI reformat → chunk → embed). Large docs can take 30–90s and hit uvicorn timeout. Consider `BackgroundTasks` before scaling.
- **AI reformat batching**: `_reformat_text_to_markdown()` processes up to 50k chars in ~8k char batches, each a Flash LLM call. Docs under 50 chars skip reformatting. Failures silently fall back to raw text; check logs for `[DocFormat]` prefix.
- **Missing `PUT /api/user/profile` endpoint**: `ProfilePage.tsx` saves display_name changes to local Zustand state only — no backend persistence. The endpoint needs to be created in `auth.py` to complete this feature.
- **GenUI renders only in ChatPage + SelectionAsk**: `GenUI` component only wired into ChatPage's ReactMarkdown `code` handler and SelectionAsk's Markdown renderer. DocumentViewPage and other Markdown contexts will show raw JSON for `genui` code blocks.
- **DocumentViewPage joins chunks**: concatenates all chunks with `\n\n`. Chunk overlap (50 chars) means ~50 chars duplicated at boundaries. Citation highlight splits into 3 ReactMarkdown renders (before/highlight/after), which can break Markdown spanning chunk boundaries.
- **`datetime.utcnow()` deprecation**: used in `models.py`, `payment.py`, `quiz.py`, `premium.py`. Deprecated in Python 3.12+. Should migrate to `datetime.now(timezone.utc)`.
- **Search score interpretation**: `score = 1 - distance`. BGE cosine distance ∈ [0,2], so scores can be negative. Don't treat as percentage without clamping.
- **Knowledge point extraction failures**: `_extract_knowledge_points` in `rag_service.py` logs with `[KP extract] batch N failed:` prefix. Check server logs if `knowledge_point_count: 0` after `status: completed`.
- **Card front/back encoding**: Knowledge cards store front/back in `KnowledgePoint.content` as `**{front}**\n\n{back}`. The `/premium/cards` GET endpoint parses this format; the PUT endpoint reconstructs it. Don't store cards as plain text or they won't render in KnowledgePanel.
- **Logout cache clearing**: `authStore.logout()` calls `queryClient.clear()` to prevent stale data flash when switching users. Any new cached queries should consider this pattern.
- **Premium gating**: Backend uses `require_premium` dependency (raises 403). Frontend uses `PremiumGate` component wrapper + `useAuthStore.isPremium` checks. Both must align on which features are premium.
