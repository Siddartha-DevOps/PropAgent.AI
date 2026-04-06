-- ============================================================
-- PropAgent.AI — PostgreSQL Migration 001: Core Platform
-- FILE: database/migrations/001_init_core.sql
-- Run: psql -U postgres -d propagent -f 001_init_core.sql
-- ============================================================

-- Enable useful extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";      -- trigram for fuzzy search
CREATE EXTENSION IF NOT EXISTS "unaccent";     -- accent-insensitive search

-- ────────────────────────────────────────────────────────────
-- BUILDERS (synced from MongoDB via webhook/cron)
-- Postgres is the analytical + relational layer;
-- MongoDB remains the operational store.
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS builders (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  mongo_id      VARCHAR(24) UNIQUE NOT NULL,   -- MongoDB ObjectId reference
  email         VARCHAR(255) UNIQUE NOT NULL,
  brand_name    VARCHAR(255),
  plan          VARCHAR(50) DEFAULT 'free',    -- free | basic | pro | enterprise
  is_active     BOOLEAN DEFAULT TRUE,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ────────────────────────────────────────────────────────────
-- LEADS (analytics-optimised copy of MongoDB leads)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS leads (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  mongo_id        VARCHAR(24) UNIQUE,
  builder_id      UUID REFERENCES builders(id) ON DELETE CASCADE,
  name            VARCHAR(255),
  phone           VARCHAR(30),
  email           VARCHAR(255),
  intent_score    SMALLINT DEFAULT 0,           -- 0-100
  intent_label    VARCHAR(10) DEFAULT 'LOW',    -- HIGH | MEDIUM | LOW
  buyer_type      VARCHAR(20) DEFAULT 'local',  -- local | nri | investor
  budget_min      NUMERIC(15,2),
  budget_max      NUMERIC(15,2),
  preferred_bhk   VARCHAR(20),
  source_page     TEXT,
  status          VARCHAR(30) DEFAULT 'new',    -- new | contacted | site_visit | converted | lost
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ────────────────────────────────────────────────────────────
-- CHAT SESSIONS (for analytics + export)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS chat_sessions (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  mongo_id        VARCHAR(24) UNIQUE,
  builder_id      UUID REFERENCES builders(id) ON DELETE CASCADE,
  lead_id         UUID REFERENCES leads(id) ON DELETE SET NULL,
  message_count   INTEGER DEFAULT 0,
  duration_secs   INTEGER DEFAULT 0,
  rag_used        BOOLEAN DEFAULT FALSE,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ────────────────────────────────────────────────────────────
-- DAILY ANALYTICS SNAPSHOTS (pre-aggregated for fast dashboard)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS daily_analytics (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  builder_id      UUID REFERENCES builders(id) ON DELETE CASCADE,
  date            DATE NOT NULL,
  total_chats     INTEGER DEFAULT 0,
  total_leads     INTEGER DEFAULT 0,
  hot_leads       INTEGER DEFAULT 0,
  medium_leads    INTEGER DEFAULT 0,
  cold_leads      INTEGER DEFAULT 0,
  avg_intent_score NUMERIC(5,2) DEFAULT 0,
  nri_leads       INTEGER DEFAULT 0,
  investor_leads  INTEGER DEFAULT 0,
  UNIQUE (builder_id, date)
);

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_leads_builder_created  ON leads(builder_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_intent           ON leads(builder_id, intent_label);
CREATE INDEX IF NOT EXISTS idx_leads_buyer_type       ON leads(builder_id, buyer_type);
CREATE INDEX IF NOT EXISTS idx_daily_analytics_date   ON daily_analytics(builder_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_builder  ON chat_sessions(builder_id, created_at DESC);

-- Auto-update updated_at on row change
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_builders_updated_at BEFORE UPDATE ON builders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_leads_updated_at BEFORE UPDATE ON leads
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();