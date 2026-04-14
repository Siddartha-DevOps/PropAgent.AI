# PropAgent.AI

AI-powered real estate chatbot SaaS. Builders upload property documents, configure a chatbot, embed it on their website, and let it capture and qualify leads automatically.

---

## Architecture

```
Browser / Embed Widget
        │
        ▼
┌──────────────────────┐
│  Node.js Express API │  ← Auth, leads, bots, analytics, webhooks
│  backend/  (port 5000)│
└──────────┬───────────┘
           │ internal HTTP (X-Internal-Secret)
           ▼
┌──────────────────────┐
│  Python FastAPI      │  ← Embeddings, RAG, document ingestion
│  app/      (port 8000)│
└──────────┬───────────┘
           │
     ┌─────┴──────┐
     ▼            ▼
Supabase       MongoDB
(Postgres +    (chat sessions,
 pgvector)      conversations)
```

**Why two backends?**
- Node.js handles everything that is a typical web API: auth, CRUD, billing, webhooks.
- Python handles everything AI: PDF parsing, text splitting, OpenAI embeddings, streaming RAG. Python's ML ecosystem (pymupdf, LangChain, unstructured) has no Node equivalent.
- They communicate over HTTP on localhost. Users only ever hit the Node API.

**Why pgvector over Pinecone?**
- Already in Supabase — zero extra cost, zero extra managed service.
- Sufficient for up to ~5 million vectors. Migrate to Pinecone when you exceed that.

---

## Prerequisites

| Tool | Version | Notes |
|------|---------|-------|
| Node.js | 20+ | |
| npm | 10+ | |
| Python | 3.11+ | |
| pip | latest | |
| MongoDB | 7+ | local or Atlas |
| Redis | 7+ | local or Upstash |
| Supabase account | — | free tier works for dev |

---

## Local Setup

### 1. Clone and install

```bash
git clone https://github.com/Siddartha-DevOps/PropAgent.AI.git
cd PropAgent.AI
```

```bash
# Node dependencies
cd backend
npm install
cd ..
```

```bash
# Python dependencies
python -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

### 2. Environment variables

```bash
cp .env.example .env
```

Open `.env` and fill in every value. Required keys are marked below.

| Key | Required | Where to get it |
|-----|----------|-----------------|
| `SUPABASE_URL` | ✅ | Supabase Dashboard → Settings → API |
| `SUPABASE_ANON_KEY` | ✅ | Same page |
| `SUPABASE_SERVICE_KEY` | ✅ | Same page — keep secret |
| `POSTGRES_URI` | ✅ | Supabase → Settings → Database → URI |
| `MONGO_URI` | ✅ | Local: `mongodb://localhost:27017/propagent` |
| `REDIS_URL` | ✅ | Local: `redis://localhost:6379` |
| `OPENAI_API_KEY` | ✅ | platform.openai.com/api-keys |
| `INTERNAL_API_SECRET` | ✅ | Run: `openssl rand -hex 32` |
| `JWT_SECRET` | ✅ | Run: `openssl rand -hex 64` |
| `EMAIL_USER` / `EMAIL_PASS` | ✅ | Gmail App Password |
| `STRIPE_SECRET_KEY` | For billing | dashboard.stripe.com |

### 3. Database setup

Run the schema in Supabase:

1. Go to **Supabase Dashboard → SQL Editor**
2. Open `database/schema.sql`
3. Paste and click **Run**

This creates all tables, indexes, triggers, RLS policies, and the `match_chunks` pgvector function.

### 4. Start services

Open three terminals:

```bash
# Terminal 1 — Node.js API
cd backend
npm run dev
# Runs on http://localhost:5000
```

```bash
# Terminal 2 — Python AI service
source .venv/bin/activate
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
# Runs on http://localhost:8000
# Swagger docs: http://localhost:8000/docs
```

```bash
# Terminal 3 — Frontend (if applicable)
cd frontend
npm run dev
# Runs on http://localhost:3000 or 5173
```

---

## Project Structure

```
PropAgent.AI/
│
├── app/                          # Python FastAPI — AI service
│   ├── main.py                   # App entry point, middleware
│   ├── config.py                 # Pydantic settings from .env
│   ├── routers/
│   │   ├── embed.py              # POST /embed/text|url|pdf — ingest documents
│   │   ├── rag.py                # POST /rag/query|context — retrieval
│   │   └── health.py             # GET /health
│   └── services/
│       ├── db.py                 # asyncpg connection pool
│       ├── splitter.py           # PDF extraction, URL fetch, text splitting
│       ├── embedder.py           # OpenAI embeddings + pgvector bulk insert
│       └── retriever.py          # pgvector cosine similarity search
│
├── backend/                      # Node.js Express — main API
│   └── src/
│       ├── models/               # ← CANONICAL Mongoose models (only here)
│       │   ├── index.js
│       │   ├── Session.js
│       │   ├── Lead.js
│       │   └── Conversation.js
│       ├── routes/
│       │   ├── auth.js
│       │   ├── bots.js
│       │   ├── chat.js           # Calls Python /rag/context internally
│       │   ├── properties.js
│       │   ├── leads.js
│       │   ├── analytics.js
│       │   └── webhooks.js
│       ├── config/
│       │   └── db.js             # MongoDB + Supabase client init
│       └── middleware/
│           ├── auth.js           # JWT verification
│           └── rateLimiter.js
│
├── frontend/                     # React / Next.js (your existing frontend)
│
├── database/
│   └── schema.sql                # Full Supabase schema — run once on setup
│
├── requirements.txt              # Python dependencies
├── .env.example                  # All required env vars with descriptions
└── README.md
```

### What to delete

The root-level `models/` folder is an orphaned duplicate. Delete it:

```bash
rm -rf models/
```

The canonical models live in `backend/src/models/`. Update any imports:

```js
// Before (broken after delete)
const Lead = require("../../models/Lead");

// After (correct)
const { Lead } = require("../models");
```

---

## API Overview

### Node.js API (port 5000)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/register` | Builder registration |
| POST | `/api/auth/login` | Builder login → JWT |
| GET | `/api/bots` | List all bots for builder |
| POST | `/api/bots` | Create bot |
| POST | `/api/bots/:id/documents` | Upload document (triggers Python ingestion) |
| POST | `/api/chat` | Send chat message (calls Python RAG internally) |
| GET | `/api/chat/:sessionId/history` | Get session history |
| GET | `/api/leads` | List leads with filters |
| PATCH | `/api/leads/:id` | Update lead status |
| GET | `/api/properties` | List properties |
| POST | `/api/properties` | Create property listing |
| GET | `/api/analytics/overview` | Real aggregated stats |
| POST | `/api/webhooks` | Register a webhook |

### Python AI Service (port 8000) — internal only

| Method | Path | Description |
|--------|------|-------------|
| POST | `/embed/text` | Ingest raw text |
| POST | `/embed/url` | Fetch URL and ingest |
| POST | `/embed/pdf` | Upload and ingest PDF |
| DELETE | `/embed/document/:id` | Remove document chunks |
| GET | `/embed/status/:id` | Poll ingestion status |
| POST | `/rag/context` | Retrieve relevant chunks only |
| POST | `/rag/query` | Full RAG: retrieve + stream LLM answer |
| GET | `/health` | Service health check |

Full interactive docs at `http://localhost:8000/docs` when the Python service is running.

---

## How Document Ingestion Works

```
Builder uploads PDF
        │
        ▼
Node: creates documents row (status=processing) in Supabase
        │
        ▼
Node: POST /embed/pdf → Python AI service
        │
        ▼
Python: extract text (pymupdf)
        │
        ▼
Python: split into ~512-token chunks with 64-token overlap
        │
        ▼
Python: batch embed via OpenAI text-embedding-3-small (100 chunks/batch)
        │
        ▼
Python: bulk INSERT into chunks table (bot_id, embedding, content, metadata)
        │
        ▼
Python: UPDATE documents SET status='ready', chunk_count=N
        │
        ▼
Node: bot status → 'ready', builder notified
```

## How a Chat Message Works

```
User sends message
        │
        ▼
Node: append to MongoDB Session
        │
        ▼
Node: POST /rag/context → Python (question + bot_id)
        │
        ▼
Python: embed question → cosine similarity search in pgvector
        │
        ▼
Python: return top-K chunks + scores
        │
        ▼
Node: build prompt (system_prompt + context + conversation history)
        │
        ▼
Node: stream OpenAI response back to user
        │
        ▼
Node: save assistant reply to MongoDB, update analytics
```

---

## Common Issues

**`match_chunks` function not found**
You haven't run the schema yet. Open Supabase SQL Editor, paste `database/schema.sql`, and run it.

**Python service returns 401**
`INTERNAL_API_SECRET` in `.env` must be identical in both Node and Python processes.

**Embeddings are slow on first batch**
Normal — OpenAI rate limits new accounts to 3,000 RPM. Subsequent batches will be faster. Progress is logged per batch in the Python terminal.

**MongoDB connection refused**
Start MongoDB: `brew services start mongodb-community` (macOS) or `sudo systemctl start mongod` (Linux).

**`vector` type not found in Postgres**
The `CREATE EXTENSION IF NOT EXISTS vector` in `schema.sql` requires Supabase — plain Postgres needs the pgvector extension installed first via `apt install postgresql-16-pgvector`.