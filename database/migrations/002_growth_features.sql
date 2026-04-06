-- ============================================================
-- PropAgent.AI — PostgreSQL Migration 002: Growth Features
-- FILE: database/migrations/002_growth_features.sql
-- Run AFTER 001_init_core.sql
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- TEAM MEMBERS (sales agents invited by a builder)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS team_members (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  builder_id      UUID REFERENCES builders(id) ON DELETE CASCADE,
  email           VARCHAR(255) NOT NULL,
  name            VARCHAR(255),
  role            VARCHAR(30) DEFAULT 'agent',   -- agent | manager | viewer
  status          VARCHAR(20) DEFAULT 'invited', -- invited | active | suspended
  invite_token    VARCHAR(128) UNIQUE,
  invite_expires  TIMESTAMPTZ,
  mongo_user_id   VARCHAR(24),                   -- set after they accept & register
  permissions     JSONB DEFAULT '{"view_leads":true,"export_leads":false,"manage_docs":false}'::jsonb,
  last_login      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (builder_id, email)
);

-- ────────────────────────────────────────────────────────────
-- PRICE ALERTS (visitor subscribes to be notified when price drops)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS price_alerts (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  builder_id      UUID REFERENCES builders(id) ON DELETE CASCADE,
  lead_id         UUID REFERENCES leads(id) ON DELETE SET NULL,
  visitor_email   VARCHAR(255) NOT NULL,
  visitor_phone   VARCHAR(30),
  visitor_name    VARCHAR(255),
  property_name   TEXT,                          -- specific project if known
  bhk_preference  VARCHAR(20),
  budget_min      NUMERIC(15,2),
  budget_max      NUMERIC(15,2),
  alert_threshold NUMERIC(5,2) DEFAULT 5.0,     -- % drop required to trigger
  status          VARCHAR(20) DEFAULT 'active',  -- active | triggered | unsubscribed
  last_notified   TIMESTAMPTZ,
  notify_count    INTEGER DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ────────────────────────────────────────────────────────────
-- SEO BLOG POSTS (builder publishes property blog content)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS blog_posts (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  builder_id      UUID REFERENCES builders(id) ON DELETE CASCADE,
  title           VARCHAR(512) NOT NULL,
  slug            VARCHAR(512) NOT NULL,
  excerpt         TEXT,
  content         TEXT NOT NULL,                 -- Markdown
  cover_image_url TEXT,
  author_name     VARCHAR(255),
  tags            TEXT[] DEFAULT '{}',
  status          VARCHAR(20) DEFAULT 'draft',   -- draft | published | archived
  seo_title       VARCHAR(70),
  seo_description VARCHAR(160),
  seo_keywords    TEXT,
  view_count      INTEGER DEFAULT 0,
  published_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  -- Full-text search vector (auto-maintained by trigger below)
  search_vector   TSVECTOR,
  UNIQUE (builder_id, slug)
);

-- Full-text search trigger: keeps search_vector current on every save
CREATE OR REPLACE FUNCTION blog_search_vector_update()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('english', COALESCE(NEW.title, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(NEW.excerpt, '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(NEW.content, '')), 'C') ||
    setweight(to_tsvector('english', COALESCE(NEW.seo_keywords, '')), 'B');
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_blog_search_vector
  BEFORE INSERT OR UPDATE ON blog_posts
  FOR EACH ROW EXECUTE FUNCTION blog_search_vector_update();

-- GIN index: makes full-text search fast even on large tables
CREATE INDEX IF NOT EXISTS idx_blog_search ON blog_posts USING GIN(search_vector);
CREATE INDEX IF NOT EXISTS idx_blog_builder_status ON blog_posts(builder_id, status);
CREATE INDEX IF NOT EXISTS idx_blog_tags ON blog_posts USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_blog_slug ON blog_posts(builder_id, slug);

-- ────────────────────────────────────────────────────────────
-- WEBHOOK CONFIGS (HubSpot / Zoho CRM sync per builder)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS webhook_configs (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  builder_id      UUID REFERENCES builders(id) ON DELETE CASCADE UNIQUE,
  crm_type        VARCHAR(30),                   -- hubspot | zoho | custom
  endpoint_url    TEXT,
  api_key_enc     TEXT,                          -- AES-256 encrypted
  field_map       JSONB DEFAULT '{}'::jsonb,     -- maps PropAgent fields → CRM fields
  is_active       BOOLEAN DEFAULT TRUE,
  last_synced     TIMESTAMPTZ,
  sync_count      INTEGER DEFAULT 0,
  last_error      TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ────────────────────────────────────────────────────────────
-- WEBHOOK SYNC LOGS (audit trail of every CRM push)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS webhook_logs (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  builder_id      UUID REFERENCES builders(id) ON DELETE CASCADE,
  lead_id         UUID REFERENCES leads(id) ON DELETE SET NULL,
  crm_type        VARCHAR(30),
  status          VARCHAR(20),                   -- success | failed | retrying
  http_status     INTEGER,
  response_body   TEXT,
  error_message   TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_webhook_logs_builder ON webhook_logs(builder_id, created_at DESC);

-- ────────────────────────────────────────────────────────────
-- ADMIN LOGS (super-admin action trail)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS admin_logs (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  admin_email     VARCHAR(255) NOT NULL,
  action          VARCHAR(100) NOT NULL,
  target_type     VARCHAR(50),                   -- builder | lead | plan | blog
  target_id       TEXT,
  metadata        JSONB DEFAULT '{}'::jsonb,
  ip_address      INET,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_logs_created ON admin_logs(created_at DESC);

-- Trigger for blog updated_at
CREATE TRIGGER trg_blog_updated_at BEFORE UPDATE ON blog_posts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_webhook_configs_updated_at BEFORE UPDATE ON webhook_configs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();