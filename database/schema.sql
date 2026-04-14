-- ============================================================
-- PropAgent.AI — PostgreSQL Schema (Supabase + pgvector)
-- ============================================================
-- Extensions
-- ============================================================
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pg_trgm;   -- trigram search on text fields
CREATE EXTENSION IF NOT EXISTS btree_gin; -- composite GIN indexes


-- ============================================================
-- UTILITY: auto-updated updated_at trigger
-- ============================================================
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


-- ============================================================
-- BUILDERS  (tenants)
-- ============================================================
CREATE TABLE builders (
  id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  name            TEXT        NOT NULL,
  email           TEXT        UNIQUE NOT NULL,
  password        TEXT        NOT NULL,              -- bcrypt hashed
  phone           TEXT,
  company_name    TEXT,
  logo_url        TEXT,
  plan            TEXT        NOT NULL DEFAULT 'starter'
                              CHECK (plan IN ('starter','growth','scale','enterprise')),
  api_key         TEXT        UNIQUE NOT NULL DEFAULT uuid_generate_v4()::TEXT,
  api_key_last_used TIMESTAMPTZ,
  -- Limits enforced at application layer
  max_bots        INT         NOT NULL DEFAULT 1,
  max_docs_per_bot INT        NOT NULL DEFAULT 5,
  max_messages_pm INT         NOT NULL DEFAULT 1000,  -- per month
  -- Status
  is_active       BOOLEAN     NOT NULL DEFAULT TRUE,
  email_verified  BOOLEAN     NOT NULL DEFAULT FALSE,
  verification_token TEXT,
  reset_token     TEXT,
  reset_token_exp TIMESTAMPTZ,
  -- Billing
  stripe_customer_id   TEXT   UNIQUE,
  stripe_subscription_id TEXT UNIQUE,
  subscription_status  TEXT   DEFAULT 'trialing'
                              CHECK (subscription_status IN
                                ('trialing','active','past_due','canceled','unpaid')),
  trial_ends_at   TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '14 days'),
  billing_period_start TIMESTAMPTZ,
  billing_period_end   TIMESTAMPTZ,
  -- Timestamps
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_builders_email       ON builders (email);
CREATE INDEX idx_builders_api_key     ON builders (api_key);
CREATE INDEX idx_builders_stripe_cust ON builders (stripe_customer_id);

CREATE TRIGGER trg_builders_updated_at
  BEFORE UPDATE ON builders
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ============================================================
-- BUILDER SESSIONS  (server-side auth sessions)
-- ============================================================
CREATE TABLE builder_sessions (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  builder_id  UUID        NOT NULL REFERENCES builders(id) ON DELETE CASCADE,
  token       TEXT        NOT NULL UNIQUE,   -- hashed JWT or opaque token
  ip_address  INET,
  user_agent  TEXT,
  expires_at  TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_builder_sessions_token      ON builder_sessions (token);
CREATE INDEX idx_builder_sessions_builder    ON builder_sessions (builder_id);
CREATE INDEX idx_builder_sessions_expires    ON builder_sessions (expires_at);


-- ============================================================
-- PLANS  (plan definitions — source of truth for limits)
-- ============================================================
CREATE TABLE plans (
  id                   TEXT        PRIMARY KEY,   -- 'starter' | 'growth' etc.
  display_name         TEXT        NOT NULL,
  price_monthly_cents  INT         NOT NULL DEFAULT 0,
  price_yearly_cents   INT         NOT NULL DEFAULT 0,
  max_bots             INT         NOT NULL,
  max_docs_per_bot     INT         NOT NULL,
  max_messages_pm      INT         NOT NULL,
  max_leads_pm         INT         NOT NULL,
  allow_custom_domain  BOOLEAN     NOT NULL DEFAULT FALSE,
  allow_white_label    BOOLEAN     NOT NULL DEFAULT FALSE,
  allow_api_access     BOOLEAN     NOT NULL DEFAULT FALSE,
  allow_webhooks       BOOLEAN     NOT NULL DEFAULT FALSE,
  is_active            BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_plans_updated_at
  BEFORE UPDATE ON plans
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ============================================================
-- BOTS  (one builder → many bots / chatbot instances)
-- ============================================================
CREATE TABLE bots (
  id                UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  builder_id        UUID        NOT NULL REFERENCES builders(id) ON DELETE CASCADE,
  name              TEXT        NOT NULL,
  description       TEXT,
  -- Appearance
  primary_color     TEXT        NOT NULL DEFAULT '#1a56db',
  bot_avatar_url    TEXT,
  welcome_message   TEXT        NOT NULL DEFAULT 'Hi! I''m your real estate assistant. How can I help you today?',
  placeholder       TEXT        NOT NULL DEFAULT 'Ask about projects, pricing, availability...',
  -- Behaviour
  system_prompt     TEXT        NOT NULL DEFAULT 'You are a helpful real estate assistant. Answer only based on the provided context about this project. If you don''t know, say so politely.',
  language          TEXT        NOT NULL DEFAULT 'en',
  temperature       NUMERIC(3,2) NOT NULL DEFAULT 0.3 CHECK (temperature BETWEEN 0 AND 2),
  max_context_chunks INT        NOT NULL DEFAULT 5,
  -- Lead capture
  capture_leads     BOOLEAN     NOT NULL DEFAULT TRUE,
  lead_form_title   TEXT        NOT NULL DEFAULT 'Get More Details',
  require_phone     BOOLEAN     NOT NULL DEFAULT TRUE,
  require_email     BOOLEAN     NOT NULL DEFAULT FALSE,
  -- Widget embed settings
  embed_domain      TEXT,                  -- domain whitelist (null = unrestricted)
  custom_css        TEXT,
  position          TEXT        NOT NULL DEFAULT 'bottom-right'
                                CHECK (position IN ('bottom-right','bottom-left','top-right','top-left')),
  -- Status
  status            TEXT        NOT NULL DEFAULT 'training'
                                CHECK (status IN ('training','ready','error','paused')),
  -- Counters (denormalised, updated via trigger)
  total_conversations INT       NOT NULL DEFAULT 0,
  total_messages    INT         NOT NULL DEFAULT 0,
  total_leads       INT         NOT NULL DEFAULT 0,
  -- Timestamps
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_bots_builder_id ON bots (builder_id);
CREATE INDEX idx_bots_status     ON bots (status);

CREATE TRIGGER trg_bots_updated_at
  BEFORE UPDATE ON bots
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ============================================================
-- PROPERTIES  (real estate listings linked to a bot/builder)
-- ============================================================
CREATE TABLE properties (
  id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  builder_id      UUID        NOT NULL REFERENCES builders(id) ON DELETE CASCADE,
  bot_id          UUID        REFERENCES bots(id) ON DELETE SET NULL,
  -- Identity
  title           TEXT        NOT NULL,
  slug            TEXT        UNIQUE NOT NULL,  -- URL-safe identifier
  description     TEXT,
  -- Location
  address         TEXT,
  city            TEXT        NOT NULL,
  locality        TEXT,
  state           TEXT,
  pincode         TEXT,
  latitude        NUMERIC(10,7),
  longitude       NUMERIC(10,7),
  -- Classification
  property_type   TEXT        NOT NULL
                              CHECK (property_type IN ('apartment','villa','plot','commercial','row_house','penthouse','studio')),
  listing_type    TEXT        NOT NULL DEFAULT 'sale'
                              CHECK (listing_type IN ('sale','rent','lease')),
  -- Specs
  bedrooms        SMALLINT,
  bathrooms       SMALLINT,
  balconies       SMALLINT,
  area_sqft       NUMERIC(10,2),
  carpet_area_sqft NUMERIC(10,2),
  floor_number    SMALLINT,
  total_floors    SMALLINT,
  facing          TEXT        CHECK (facing IN ('north','south','east','west','north-east','north-west','south-east','south-west')),
  age_years       SMALLINT,
  -- Pricing
  price           NUMERIC(15,2) NOT NULL,
  price_per_sqft  NUMERIC(10,2),
  maintenance_pm  NUMERIC(10,2),  -- monthly maintenance
  security_deposit NUMERIC(12,2), -- for rent/lease
  -- Features
  amenities       TEXT[]      NOT NULL DEFAULT '{}',
  nearby          JSONB       NOT NULL DEFAULT '{}',  -- {schools:[...], hospitals:[...]}
  possession_date DATE,
  rera_id         TEXT,           -- RERA registration number
  -- Media
  images          TEXT[]      NOT NULL DEFAULT '{}',
  brochure_url    TEXT,
  video_url       TEXT,
  -- Status
  is_available    BOOLEAN     NOT NULL DEFAULT TRUE,
  is_featured     BOOLEAN     NOT NULL DEFAULT FALSE,
  views           INT         NOT NULL DEFAULT 0,
  inquiry_count   INT         NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_properties_builder     ON properties (builder_id);
CREATE INDEX idx_properties_bot         ON properties (bot_id);
CREATE INDEX idx_properties_city        ON properties (city);
CREATE INDEX idx_properties_type        ON properties (property_type, listing_type);
CREATE INDEX idx_properties_price       ON properties (price);
CREATE INDEX idx_properties_available   ON properties (is_available);
CREATE INDEX idx_properties_slug        ON properties (slug);
CREATE INDEX idx_properties_title_trgm  ON properties USING gin (title gin_trgm_ops);

CREATE TRIGGER trg_properties_updated_at
  BEFORE UPDATE ON properties
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ============================================================
-- DOCUMENTS  (PDFs, URLs, text chunks per bot — RAG source)
-- ============================================================
CREATE TABLE documents (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  bot_id      UUID        NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
  property_id UUID        REFERENCES properties(id) ON DELETE SET NULL,
  type        TEXT        NOT NULL CHECK (type IN ('pdf','url','text','csv','docx')),
  name        TEXT        NOT NULL,
  source_url  TEXT,           -- original URL or S3/storage path
  file_size   BIGINT,         -- bytes
  mime_type   TEXT,
  status      TEXT        NOT NULL DEFAULT 'processing'
                          CHECK (status IN ('processing','ready','error','outdated')),
  error_msg   TEXT,
  chunk_count INT         NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_documents_bot_id  ON documents (bot_id);
CREATE INDEX idx_documents_status  ON documents (status);

CREATE TRIGGER trg_documents_updated_at
  BEFORE UPDATE ON documents
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ============================================================
-- CHUNKS  (text pieces after splitting docs, with embeddings)
-- ============================================================
CREATE TABLE chunks (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  bot_id      UUID        NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
  document_id UUID        NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  content     TEXT        NOT NULL,
  token_count INT,
  chunk_index INT         NOT NULL DEFAULT 0,  -- position within document
  metadata    JSONB       NOT NULL DEFAULT '{}',
  embedding   vector(1536),                     -- OpenAI text-embedding-3-small
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_chunks_bot_id      ON chunks (bot_id);
CREATE INDEX idx_chunks_document_id ON chunks (document_id);
CREATE INDEX chunks_embedding_ivfflat ON chunks
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);


-- ============================================================
-- LEADS
-- ============================================================
CREATE TABLE leads (
  id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  bot_id          UUID        NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
  builder_id      UUID        NOT NULL REFERENCES builders(id) ON DELETE CASCADE,
  property_id     UUID        REFERENCES properties(id) ON DELETE SET NULL,
  conversation_id UUID,                        -- FK added after conversations table
  -- Contact info
  name            TEXT        NOT NULL,
  phone           TEXT,
  email           TEXT,
  -- Context
  first_message   TEXT,
  intent_score    SMALLINT    NOT NULL DEFAULT 50 CHECK (intent_score BETWEEN 0 AND 100),
  intent_label    TEXT        NOT NULL DEFAULT 'warm'
                              CHECK (intent_label IN ('cold','warm','hot')),
  source_page     TEXT,
  utm_source      TEXT,
  utm_medium      TEXT,
  utm_campaign    TEXT,
  -- Status
  status          TEXT        NOT NULL DEFAULT 'new'
                              CHECK (status IN ('new','contacted','qualified','converted','lost')),
  assigned_to     UUID        REFERENCES builders(id) ON DELETE SET NULL,
  notes           TEXT,
  -- Timestamps
  last_contacted_at TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_leads_bot_id       ON leads (bot_id);
CREATE INDEX idx_leads_builder_id   ON leads (builder_id);
CREATE INDEX idx_leads_property_id  ON leads (property_id);
CREATE INDEX idx_leads_status       ON leads (status);
CREATE INDEX idx_leads_intent_score ON leads (intent_score DESC);
CREATE INDEX idx_leads_created_at   ON leads (created_at DESC);
CREATE INDEX idx_leads_email        ON leads (email);

CREATE TRIGGER trg_leads_updated_at
  BEFORE UPDATE ON leads
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ============================================================
-- LEAD ACTIVITIES  (audit trail of status changes and actions)
-- ============================================================
CREATE TABLE lead_activities (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  lead_id     UUID        NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  actor_id    UUID        REFERENCES builders(id) ON DELETE SET NULL,
  type        TEXT        NOT NULL
              CHECK (type IN ('status_change','note_added','called','emailed',
                              'whatsapp_sent','site_visit_scheduled','site_visit_done',
                              'document_shared','converted','lost')),
  old_value   TEXT,
  new_value   TEXT,
  note        TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_lead_activities_lead_id ON lead_activities (lead_id);
CREATE INDEX idx_lead_activities_created ON lead_activities (created_at DESC);


-- ============================================================
-- CONVERSATIONS  (one per chat session)
-- ============================================================
CREATE TABLE conversations (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  bot_id      UUID        NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
  lead_id     UUID        REFERENCES leads(id) ON DELETE SET NULL,
  session_id  TEXT        NOT NULL,
  ip_address  INET,
  user_agent  TEXT,
  source_page TEXT,
  resolved    BOOLEAN     NOT NULL DEFAULT FALSE,
  resolution_note TEXT,
  message_count INT       NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_conversations_bot_id     ON conversations (bot_id);
CREATE INDEX idx_conversations_lead_id    ON conversations (lead_id);
CREATE INDEX idx_conversations_session    ON conversations (session_id);
CREATE INDEX idx_conversations_created_at ON conversations (created_at DESC);

CREATE TRIGGER trg_conversations_updated_at
  BEFORE UPDATE ON conversations
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Now that conversations exists, add the FK on leads
ALTER TABLE leads
  ADD CONSTRAINT fk_leads_conversation
  FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE SET NULL;


-- ============================================================
-- MESSAGES  (individual chat messages within a conversation)
-- ============================================================
CREATE TABLE messages (
  id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID        NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role            TEXT        NOT NULL CHECK (role IN ('user','assistant','system')),
  content         TEXT        NOT NULL,
  sources         JSONB       NOT NULL DEFAULT '[]', -- [{doc_name, chunk_id, score}]
  tokens_used     INT         NOT NULL DEFAULT 0,
  latency_ms      INT,
  model_used      TEXT,
  flagged         BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_messages_conversation_id ON messages (conversation_id);
CREATE INDEX idx_messages_created_at      ON messages (created_at DESC);
CREATE INDEX idx_messages_role            ON messages (role);


-- ============================================================
-- API USAGE  (track token / request usage per builder per month)
-- ============================================================
CREATE TABLE api_usage (
  id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  builder_id      UUID        NOT NULL REFERENCES builders(id) ON DELETE CASCADE,
  bot_id          UUID        REFERENCES bots(id) ON DELETE SET NULL,
  period_year     SMALLINT    NOT NULL,  -- e.g. 2025
  period_month    SMALLINT    NOT NULL,  -- 1-12
  messages_count  INT         NOT NULL DEFAULT 0,
  tokens_input    BIGINT      NOT NULL DEFAULT 0,
  tokens_output   BIGINT      NOT NULL DEFAULT 0,
  embedding_calls INT         NOT NULL DEFAULT 0,
  estimated_cost_usd NUMERIC(10,6) NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (builder_id, bot_id, period_year, period_month)
);

CREATE INDEX idx_api_usage_builder  ON api_usage (builder_id, period_year, period_month);

CREATE TRIGGER trg_api_usage_updated_at
  BEFORE UPDATE ON api_usage
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ============================================================
-- BOT ANALYTICS  (daily aggregated stats per bot)
-- ============================================================
CREATE TABLE bot_analytics (
  id                  UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  bot_id              UUID        NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
  builder_id          UUID        NOT NULL REFERENCES builders(id) ON DELETE CASCADE,
  date                DATE        NOT NULL,
  -- Volume
  conversations       INT         NOT NULL DEFAULT 0,
  messages            INT         NOT NULL DEFAULT 0,
  unique_visitors     INT         NOT NULL DEFAULT 0,
  -- Leads
  leads_captured      INT         NOT NULL DEFAULT 0,
  hot_leads           INT         NOT NULL DEFAULT 0,
  warm_leads          INT         NOT NULL DEFAULT 0,
  cold_leads          INT         NOT NULL DEFAULT 0,
  -- Quality
  avg_session_length_sec NUMERIC(8,2) NOT NULL DEFAULT 0,
  avg_messages_per_conv  NUMERIC(6,2) NOT NULL DEFAULT 0,
  avg_intent_score       NUMERIC(5,2) NOT NULL DEFAULT 0,
  resolution_rate        NUMERIC(5,4) NOT NULL DEFAULT 0, -- 0.0-1.0
  -- Costs
  tokens_used         BIGINT      NOT NULL DEFAULT 0,
  cost_usd            NUMERIC(10,6) NOT NULL DEFAULT 0,
  UNIQUE (bot_id, date)
);

CREATE INDEX idx_bot_analytics_bot_date     ON bot_analytics (bot_id, date DESC);
CREATE INDEX idx_bot_analytics_builder_date ON bot_analytics (builder_id, date DESC);


-- ============================================================
-- WEBHOOKS  (builder-defined endpoints to receive lead events)
-- ============================================================
CREATE TABLE webhooks (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  builder_id  UUID        NOT NULL REFERENCES builders(id) ON DELETE CASCADE,
  url         TEXT        NOT NULL,
  secret      TEXT        NOT NULL,   -- HMAC signing secret
  events      TEXT[]      NOT NULL DEFAULT '{"lead.created","lead.updated"}',
  is_active   BOOLEAN     NOT NULL DEFAULT TRUE,
  -- Health tracking
  last_triggered_at TIMESTAMPTZ,
  last_status_code  SMALLINT,
  failure_count     INT     NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_webhooks_builder_id ON webhooks (builder_id);

CREATE TRIGGER trg_webhooks_updated_at
  BEFORE UPDATE ON webhooks
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ============================================================
-- WEBHOOK DELIVERIES  (log of every webhook attempt)
-- ============================================================
CREATE TABLE webhook_deliveries (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  webhook_id  UUID        NOT NULL REFERENCES webhooks(id) ON DELETE CASCADE,
  event_type  TEXT        NOT NULL,
  payload     JSONB       NOT NULL,
  status_code SMALLINT,
  response_body TEXT,
  duration_ms INT,
  success     BOOLEAN     NOT NULL DEFAULT FALSE,
  attempt     SMALLINT    NOT NULL DEFAULT 1,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_webhook_deliveries_webhook  ON webhook_deliveries (webhook_id);
CREATE INDEX idx_webhook_deliveries_created  ON webhook_deliveries (created_at DESC);


-- ============================================================
-- NOTIFICATIONS  (in-app notifications for builders)
-- ============================================================
CREATE TABLE notifications (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  builder_id  UUID        NOT NULL REFERENCES builders(id) ON DELETE CASCADE,
  type        TEXT        NOT NULL
              CHECK (type IN ('new_lead','hot_lead','bot_error','plan_limit',
                              'payment_failed','document_ready','system')),
  title       TEXT        NOT NULL,
  body        TEXT        NOT NULL,
  data        JSONB       NOT NULL DEFAULT '{}',  -- {lead_id, bot_id, etc.}
  is_read     BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notifications_builder_id ON notifications (builder_id, is_read);
CREATE INDEX idx_notifications_created_at ON notifications (created_at DESC);


-- ============================================================
-- DOCUMENT PROCESSING QUEUE  (async ingestion pipeline)
-- ============================================================
CREATE TABLE document_queue (
  id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id     UUID        NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  bot_id          UUID        NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
  status          TEXT        NOT NULL DEFAULT 'pending'
                              CHECK (status IN ('pending','processing','done','failed')),
  attempt         SMALLINT    NOT NULL DEFAULT 0,
  max_attempts    SMALLINT    NOT NULL DEFAULT 3,
  error_msg       TEXT,
  worker_id       TEXT,            -- which worker picked it up
  picked_at       TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_doc_queue_status     ON document_queue (status, created_at)
  WHERE status IN ('pending','failed');
CREATE INDEX idx_doc_queue_document   ON document_queue (document_id);


-- ============================================================
-- PROPERTY INQUIRIES  (direct inquiry form submissions)
-- ============================================================
CREATE TABLE property_inquiries (
  id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  property_id     UUID        NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  builder_id      UUID        NOT NULL REFERENCES builders(id) ON DELETE CASCADE,
  lead_id         UUID        REFERENCES leads(id) ON DELETE SET NULL,
  name            TEXT        NOT NULL,
  phone           TEXT,
  email           TEXT,
  message         TEXT,
  preferred_time  TEXT,
  inquiry_type    TEXT        NOT NULL DEFAULT 'general'
                              CHECK (inquiry_type IN ('general','site_visit','price','availability','callback')),
  status          TEXT        NOT NULL DEFAULT 'pending'
                              CHECK (status IN ('pending','responded','closed')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_property_inquiries_property   ON property_inquiries (property_id);
CREATE INDEX idx_property_inquiries_builder    ON property_inquiries (builder_id);
CREATE INDEX idx_property_inquiries_created_at ON property_inquiries (created_at DESC);

CREATE TRIGGER trg_property_inquiries_updated_at
  BEFORE UPDATE ON property_inquiries
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ============================================================
-- SITE VISITS  (scheduled physical visits to a property)
-- ============================================================
CREATE TABLE site_visits (
  id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  property_id     UUID        NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  lead_id         UUID        NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  builder_id      UUID        NOT NULL REFERENCES builders(id) ON DELETE CASCADE,
  scheduled_at    TIMESTAMPTZ NOT NULL,
  duration_min    SMALLINT    NOT NULL DEFAULT 60,
  status          TEXT        NOT NULL DEFAULT 'scheduled'
                              CHECK (status IN ('scheduled','confirmed','completed','cancelled','no_show')),
  notes           TEXT,
  feedback        TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_site_visits_property    ON site_visits (property_id);
CREATE INDEX idx_site_visits_lead        ON site_visits (lead_id);
CREATE INDEX idx_site_visits_builder     ON site_visits (builder_id);
CREATE INDEX idx_site_visits_scheduled   ON site_visits (scheduled_at);

CREATE TRIGGER trg_site_visits_updated_at
  BEFORE UPDATE ON site_visits
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ============================================================
-- PGVECTOR SEARCH FUNCTION
-- ============================================================
CREATE OR REPLACE FUNCTION match_chunks(
  query_embedding  vector(1536),
  match_bot_id     UUID,
  match_count      INT     DEFAULT 5,
  min_score        FLOAT   DEFAULT 0.7
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
    d.name   AS doc_name,
    1 - (c.embedding <=> query_embedding) AS score
  FROM   chunks c
  JOIN   documents d ON d.id = c.document_id
  WHERE  c.bot_id = match_bot_id
    AND  d.status = 'ready'
    AND  1 - (c.embedding <=> query_embedding) >= min_score
  ORDER  BY c.embedding <=> query_embedding
  LIMIT  match_count;
$$;


-- ============================================================
-- COUNTER FUNCTIONS  (keep denormalised counters in sync)
-- ============================================================

-- Increment bot.total_leads when a new lead is inserted
CREATE OR REPLACE FUNCTION inc_bot_total_leads()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  UPDATE bots SET total_leads = total_leads + 1 WHERE id = NEW.bot_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_inc_bot_total_leads
  AFTER INSERT ON leads
  FOR EACH ROW EXECUTE FUNCTION inc_bot_total_leads();


-- Increment bot.total_messages + conversation.message_count
CREATE OR REPLACE FUNCTION inc_message_counters()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  UPDATE conversations  SET message_count = message_count + 1    WHERE id = NEW.conversation_id;
  UPDATE bots           SET total_messages = total_messages + 1   WHERE id = (
    SELECT bot_id FROM conversations WHERE id = NEW.conversation_id
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_inc_message_counters
  AFTER INSERT ON messages
  FOR EACH ROW EXECUTE FUNCTION inc_message_counters();


-- Increment bot.total_conversations
CREATE OR REPLACE FUNCTION inc_bot_total_conversations()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  UPDATE bots SET total_conversations = total_conversations + 1 WHERE id = NEW.bot_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_inc_bot_total_conversations
  AFTER INSERT ON conversations
  FOR EACH ROW EXECUTE FUNCTION inc_bot_total_conversations();


-- Increment property.inquiry_count
CREATE OR REPLACE FUNCTION inc_property_inquiry_count()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  UPDATE properties SET inquiry_count = inquiry_count + 1 WHERE id = NEW.property_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_inc_property_inquiry_count
  AFTER INSERT ON property_inquiries
  FOR EACH ROW EXECUTE FUNCTION inc_property_inquiry_count();


-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE builders            ENABLE ROW LEVEL SECURITY;
ALTER TABLE builder_sessions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE bots                ENABLE ROW LEVEL SECURITY;
ALTER TABLE properties          ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents           ENABLE ROW LEVEL SECURITY;
ALTER TABLE chunks              ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads               ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_activities     ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations       ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages            ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_usage           ENABLE ROW LEVEL SECURITY;
ALTER TABLE bot_analytics       ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhooks            ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_deliveries  ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications       ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_queue      ENABLE ROW LEVEL SECURITY;
ALTER TABLE property_inquiries  ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_visits         ENABLE ROW LEVEL SECURITY;
ALTER TABLE plans               ENABLE ROW LEVEL SECURITY;

-- Builders: own row only
CREATE POLICY "builders_self"
  ON builders FOR ALL
  USING (id = auth.uid()::UUID);

-- Bots: builder sees only their bots
CREATE POLICY "bots_own"
  ON bots FOR ALL
  USING (builder_id = auth.uid()::UUID);

-- Properties: builder sees only their properties
CREATE POLICY "properties_own"
  ON properties FOR ALL
  USING (builder_id = auth.uid()::UUID);

-- Documents: scoped via bot ownership
CREATE POLICY "documents_own"
  ON documents FOR ALL
  USING (bot_id IN (SELECT id FROM bots WHERE builder_id = auth.uid()::UUID));

-- Chunks: scoped via bot ownership
CREATE POLICY "chunks_own"
  ON chunks FOR ALL
  USING (bot_id IN (SELECT id FROM bots WHERE builder_id = auth.uid()::UUID));

-- Leads: builder sees only their leads
CREATE POLICY "leads_own"
  ON leads FOR ALL
  USING (builder_id = auth.uid()::UUID);

-- Lead activities: scoped via lead ownership
CREATE POLICY "lead_activities_own"
  ON lead_activities FOR ALL
  USING (lead_id IN (SELECT id FROM leads WHERE builder_id = auth.uid()::UUID));

-- Conversations: scoped via bot ownership
CREATE POLICY "conversations_own"
  ON conversations FOR ALL
  USING (bot_id IN (SELECT id FROM bots WHERE builder_id = auth.uid()::UUID));

-- Messages: scoped via conversation → bot → builder
CREATE POLICY "messages_own"
  ON messages FOR ALL
  USING (conversation_id IN (
    SELECT c.id FROM conversations c
    JOIN bots b ON b.id = c.bot_id
    WHERE b.builder_id = auth.uid()::UUID
  ));

-- API usage: builder sees only their usage
CREATE POLICY "api_usage_own"
  ON api_usage FOR ALL
  USING (builder_id = auth.uid()::UUID);

-- Bot analytics: builder sees only their analytics
CREATE POLICY "bot_analytics_own"
  ON bot_analytics FOR ALL
  USING (builder_id = auth.uid()::UUID);

-- Webhooks: builder sees only their webhooks
CREATE POLICY "webhooks_own"
  ON webhooks FOR ALL
  USING (builder_id = auth.uid()::UUID);

-- Webhook deliveries: scoped via webhook ownership
CREATE POLICY "webhook_deliveries_own"
  ON webhook_deliveries FOR ALL
  USING (webhook_id IN (SELECT id FROM webhooks WHERE builder_id = auth.uid()::UUID));

-- Notifications: builder sees only their notifications
CREATE POLICY "notifications_own"
  ON notifications FOR ALL
  USING (builder_id = auth.uid()::UUID);

-- Document queue: scoped via bot ownership
CREATE POLICY "document_queue_own"
  ON document_queue FOR ALL
  USING (bot_id IN (SELECT id FROM bots WHERE builder_id = auth.uid()::UUID));

-- Property inquiries: builder sees only their inquiries
CREATE POLICY "property_inquiries_own"
  ON property_inquiries FOR ALL
  USING (builder_id = auth.uid()::UUID);

-- Site visits: builder sees only their visits
CREATE POLICY "site_visits_own"
  ON site_visits FOR ALL
  USING (builder_id = auth.uid()::UUID);

-- Builder sessions: own sessions only
CREATE POLICY "builder_sessions_own"
  ON builder_sessions FOR ALL
  USING (builder_id = auth.uid()::UUID);

-- Plans: readable by all authenticated users, writable by service role only
CREATE POLICY "plans_read"
  ON plans FOR SELECT
  USING (TRUE);