-- ============================================================
-- PropAgent.AI — Full-Text Search Indexes & Helper Views
-- FILE: database/search/fulltext_index.sql
-- Run AFTER migrations 001 and 002
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- LEADS FULL-TEXT SEARCH
-- Allows builders to search leads by name, email, phone, notes
-- ────────────────────────────────────────────────────────────
ALTER TABLE leads ADD COLUMN IF NOT EXISTS search_vector TSVECTOR;

CREATE OR REPLACE FUNCTION leads_search_vector_update()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('simple', COALESCE(NEW.name, '')), 'A') ||
    setweight(to_tsvector('simple', COALESCE(NEW.email, '')), 'B') ||
    setweight(to_tsvector('simple', COALESCE(NEW.phone, '')), 'A') ||
    setweight(to_tsvector('simple', COALESCE(NEW.buyer_type, '')), 'C');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_leads_search_vector
  BEFORE INSERT OR UPDATE ON leads
  FOR EACH ROW EXECUTE FUNCTION leads_search_vector_update();

-- GIN index on leads search vector
CREATE INDEX IF NOT EXISTS idx_leads_search ON leads USING GIN(search_vector);

-- Trigram index on name + email for "LIKE" style partial matching
CREATE INDEX IF NOT EXISTS idx_leads_name_trgm  ON leads USING GIN(name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_leads_email_trgm ON leads USING GIN(email gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_leads_phone_trgm ON leads USING GIN(phone gin_trgm_ops);

-- ────────────────────────────────────────────────────────────
-- HELPER VIEW: Builder analytics summary (used by admin dashboard)
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW vw_builder_summary AS
SELECT
  b.id,
  b.mongo_id,
  b.brand_name,
  b.email,
  b.plan,
  b.is_active,
  b.created_at                                              AS joined_at,
  COUNT(DISTINCT l.id)                                      AS total_leads,
  COUNT(DISTINCT l.id) FILTER (WHERE l.intent_label='HIGH') AS hot_leads,
  COUNT(DISTINCT l.id) FILTER (WHERE l.buyer_type='nri')    AS nri_leads,
  COUNT(DISTINCT cs.id)                                     AS total_chats,
  ROUND(AVG(l.intent_score), 1)                             AS avg_intent,
  COUNT(DISTINCT tm.id)                                     AS team_size,
  MAX(l.created_at)                                         AS last_lead_at
FROM builders b
LEFT JOIN leads       l  ON l.builder_id = b.id
LEFT JOIN chat_sessions cs ON cs.builder_id = b.id
LEFT JOIN team_members tm ON tm.builder_id = b.id AND tm.status = 'active'
GROUP BY b.id;

-- ────────────────────────────────────────────────────────────
-- HELPER VIEW: 30-day rolling lead funnel per builder
-- Used by monthly analytics email
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW vw_monthly_funnel AS
SELECT
  builder_id,
  date_trunc('month', created_at)                          AS month,
  COUNT(*)                                                 AS total_leads,
  COUNT(*) FILTER (WHERE intent_label = 'HIGH')            AS hot_leads,
  COUNT(*) FILTER (WHERE intent_label = 'MEDIUM')          AS medium_leads,
  COUNT(*) FILTER (WHERE intent_label = 'LOW')             AS cold_leads,
  COUNT(*) FILTER (WHERE buyer_type = 'nri')               AS nri_leads,
  COUNT(*) FILTER (WHERE buyer_type = 'investor')          AS investor_leads,
  COUNT(*) FILTER (WHERE status = 'converted')             AS conversions,
  ROUND(
    100.0 * COUNT(*) FILTER (WHERE status = 'converted')
    / NULLIF(COUNT(*), 0), 2
  )                                                        AS conversion_rate_pct
FROM leads
WHERE created_at >= NOW() - INTERVAL '13 months'
GROUP BY builder_id, date_trunc('month', created_at)
ORDER BY builder_id, month DESC;

-- ────────────────────────────────────────────────────────────
-- MATERIALIZED VIEW: Platform-wide admin stats
-- Refresh daily via cron: SELECT refresh_admin_stats();
-- ────────────────────────────────────────────────────────────
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_admin_platform_stats AS
SELECT
  COUNT(DISTINCT b.id)                                     AS total_builders,
  COUNT(DISTINCT b.id) FILTER (WHERE b.is_active)          AS active_builders,
  COUNT(DISTINCT b.id) FILTER (WHERE b.plan = 'pro')       AS pro_builders,
  COUNT(DISTINCT b.id) FILTER (WHERE b.plan = 'enterprise')AS enterprise_builders,
  COUNT(DISTINCT l.id)                                     AS total_leads,
  COUNT(DISTINCT l.id) FILTER (WHERE l.created_at > NOW() - INTERVAL '30 days') AS leads_last_30d,
  COUNT(DISTINCT cs.id)                                    AS total_chats,
  ROUND(AVG(l.intent_score), 2)                            AS platform_avg_intent
FROM builders b
LEFT JOIN leads l        ON l.builder_id = b.id
LEFT JOIN chat_sessions cs ON cs.builder_id = b.id
WITH DATA;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_admin_stats ON mv_admin_platform_stats((1));

-- Helper function to refresh materialized view
CREATE OR REPLACE FUNCTION refresh_admin_stats()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_admin_platform_stats;
END;
$$ LANGUAGE plpgsql;