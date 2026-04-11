-- PropAgent.AI - PostgreSQL Schema with pgvector
-- Run this in your Supabase SQL Editor

-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─────────────────────────────────────────
-- BUILDERS (multi-tenant)
-- ─────────────────────────────────────────
CREATE TABLE builders (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        TEXT NOT NULL,
  email       TEXT UNIQUE NOT NULL,
  password    TEXT NOT NULL,           -- bcrypt hashed
  plan        TEXT DEFAULT 'starter',  -- starter | growth | scale | enterprise
  api_key     TEXT UNIQUE DEFAULT uuid_generate_v4()::TEXT,
  logo_url    TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────
-- BOTS (one builder → many bots)
-- ─────────────────────────────────────────
CREATE TABLE bots (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  builder_id      UUID REFERENCES builders(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  description     TEXT,
  -- Appearance
  primary_color   TEXT DEFAULT '#1a56db',
  bot_avatar_url  TEXT,
  welcome_message TEXT DEFAULT 'Hi! I''m your real estate assistant. How can I help you today?',
  placeholder     TEXT DEFAULT 'Ask about projects, pricing, availability...',
  -- Behaviour
  system_prompt   TEXT DEFAULT 'You are a helpful real estate assistant. Answer only based on the provided context about this project. If you don''t know, say so politely.',
  language        TEXT DEFAULT 'en',
  -- Lead capture settings
  capture_leads   BOOLEAN DEFAULT TRUE,
  lead_form_title TEXT DEFAULT 'Get More Details',
  require_phone   BOOLEAN DEFAULT TRUE,
  -- Status
  status          TEXT DEFAULT 'training', -- training | ready | error
  total_messages  INT DEFAULT 0,
  total_leads     INT DEFAULT 0,
  embed_domain    TEXT,   -- domain whitelist
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────
-- DOCUMENTS (PDFs, URLs, text uploaded per bot)
-- ─────────────────────────────────────────
CREATE TABLE documents (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  bot_id      UUID REFERENCES bots(id) ON DELETE CASCADE,
  type        TEXT NOT NULL,  -- pdf | url | text | csv
  name        TEXT NOT NULL,
  source_url  TEXT,           -- original URL or S3 path
  status      TEXT DEFAULT 'processing', -- processing | ready | error
  chunk_count INT DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────
-- CHUNKS (text pieces after splitting docs)
-- ─────────────────────────────────────────
CREATE TABLE chunks (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  bot_id      UUID REFERENCES bots(id) ON DELETE CASCADE,
  document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
  content     TEXT NOT NULL,
  metadata    JSONB DEFAULT '{}',
  embedding   vector(1536),   -- OpenAI text-embedding-3-small = 1536 dims
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast vector similarity search
CREATE INDEX chunks_embedding_idx ON chunks
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- ─────────────────────────────────────────
-- LEADS
-- ─────────────────────────────────────────
CREATE TABLE leads (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  bot_id       UUID REFERENCES bots(id) ON DELETE CASCADE,
  builder_id   UUID REFERENCES builders(id) ON DELETE CASCADE,
  -- Contact info
  name         TEXT NOT NULL,
  phone        TEXT,
  email        TEXT,
  -- Context
  first_message TEXT,           -- what they asked first
  intent_score  INT DEFAULT 50, -- 0-100 AI scored
  intent_label  TEXT DEFAULT 'warm', -- cold | warm | hot
  source_page   TEXT,           -- which page embed was on
  -- Status
  status        TEXT DEFAULT 'new', -- new | contacted | qualified | converted | lost
  notes         TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────
-- CONVERSATIONS
-- ─────────────────────────────────────────
CREATE TABLE conversations (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  bot_id      UUID REFERENCES bots(id) ON DELETE CASCADE,
  lead_id     UUID REFERENCES leads(id),
  session_id  TEXT NOT NULL,   -- browser session
  resolved    BOOLEAN DEFAULT FALSE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────
-- MESSAGES
-- ─────────────────────────────────────────
CREATE TABLE messages (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  role            TEXT NOT NULL,  -- user | assistant
  content         TEXT NOT NULL,
  sources         JSONB DEFAULT '[]',  -- [{doc_name, chunk_id, score}]
  tokens_used     INT DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────
-- FUNCTIONS (for pgvector search)
-- ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION match_chunks(
  query_embedding vector(1536),
  match_bot_id    UUID,
  match_count     INT DEFAULT 5,
  min_score       FLOAT DEFAULT 0.7
)
RETURNS TABLE (
  id        UUID,
  content   TEXT,
  metadata  JSONB,
  doc_name  TEXT,
  score     FLOAT
)
LANGUAGE sql STABLE
AS $$
  SELECT
    c.id,
    c.content,
    c.metadata,
    d.name AS doc_name,
    1 - (c.embedding <=> query_embedding) AS score
  FROM chunks c
  JOIN documents d ON d.id = c.document_id
  WHERE c.bot_id = match_bot_id
    AND 1 - (c.embedding <=> query_embedding) >= min_score
  ORDER BY c.embedding <=> query_embedding
  LIMIT match_count;
$$;

-- ─────────────────────────────────────────
-- ROW LEVEL SECURITY
-- ─────────────────────────────────────────
ALTER TABLE builders     ENABLE ROW LEVEL SECURITY;
ALTER TABLE bots         ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents    ENABLE ROW LEVEL SECURITY;
ALTER TABLE chunks       ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads        ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages     ENABLE ROW LEVEL SECURITY;

-- Builders can only see their own data
CREATE POLICY "builders_own" ON bots
  FOR ALL USING (builder_id = auth.uid()::UUID);

CREATE POLICY "docs_own" ON documents
  FOR ALL USING (bot_id IN (SELECT id FROM bots WHERE builder_id = auth.uid()::UUID));

CREATE POLICY "leads_own" ON leads
  FOR ALL USING (builder_id = auth.uid()::UUID);