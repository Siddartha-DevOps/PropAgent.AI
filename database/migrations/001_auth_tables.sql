-- PropAgent.AI — Auth & Multi-tenancy Migration
-- Run once against your Supabase / Postgres instance

-- ── Organizations (one per builder account / tenant) ──────────────────────────
CREATE TABLE IF NOT EXISTS organizations (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mongo_id      VARCHAR(24) UNIQUE,              -- mirrors MongoDB User._id
  name          TEXT NOT NULL,
  slug          TEXT UNIQUE NOT NULL,            -- url-safe, e.g. "prestige-builders"
  plan          TEXT NOT NULL DEFAULT 'starter', -- starter | growth | enterprise
  is_active     BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── OAuth accounts (Google SSO, extensible to GitHub etc.) ───────────────────
CREATE TABLE IF NOT EXISTS oauth_accounts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mongo_user_id   VARCHAR(24) NOT NULL,
  provider        TEXT NOT NULL,                 -- 'google'
  provider_uid    TEXT NOT NULL,                 -- Google sub / UID
  email           TEXT NOT NULL,
  display_name    TEXT,
  avatar_url      TEXT,
  access_token    TEXT,
  refresh_token   TEXT,
  token_expiry    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(provider, provider_uid)
);
CREATE INDEX IF NOT EXISTS idx_oauth_mongo_user ON oauth_accounts(mongo_user_id);

-- ── Refresh token registry (for JWT rotation) ─────────────────────────────────
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mongo_user_id VARCHAR(24) NOT NULL,
  token_hash    TEXT UNIQUE NOT NULL,            -- SHA-256 of the raw token
  family_id     UUID NOT NULL,                   -- rotation family — invalidate all on reuse
  user_agent    TEXT,
  ip_address    INET,
  expires_at    TIMESTAMPTZ NOT NULL,
  revoked_at    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_rt_user  ON refresh_tokens(mongo_user_id);
CREATE INDEX IF NOT EXISTS idx_rt_family ON refresh_tokens(family_id);

-- ── Auth audit log ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS auth_audit_logs (
  id            BIGSERIAL PRIMARY KEY,
  mongo_user_id VARCHAR(24),
  action        TEXT NOT NULL,                   -- LOGIN | LOGOUT | REGISTER | OAUTH_LOGIN | PASSWORD_RESET | TOKEN_REFRESH | TOKEN_REVOKE | ROLE_CHANGE
  ip_address    INET,
  user_agent    TEXT,
  metadata      JSONB DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_aal_user   ON auth_audit_logs(mongo_user_id);
CREATE INDEX IF NOT EXISTS idx_aal_action ON auth_audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_aal_time   ON auth_audit_logs(created_at DESC);

-- ── Password reset tokens ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mongo_user_id VARCHAR(24) NOT NULL,
  token_hash    TEXT UNIQUE NOT NULL,
  expires_at    TIMESTAMPTZ NOT NULL,
  used_at       TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── team_members — extend existing table with org FK ─────────────────────────
ALTER TABLE team_members
  ADD COLUMN IF NOT EXISTS org_id        UUID REFERENCES organizations(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS mongo_user_id VARCHAR(24),
  ADD COLUMN IF NOT EXISTS role          TEXT NOT NULL DEFAULT 'agent',
  ADD COLUMN IF NOT EXISTS status        TEXT NOT NULL DEFAULT 'invited',
  ADD COLUMN IF NOT EXISTS permissions   JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS invite_token  TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS invite_expires TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_login    TIMESTAMPTZ;

-- Roles: superadmin | builder | manager | agent | viewer
-- superadmin — PropAgent platform owner
-- builder    — real estate developer (tenant owner)
-- manager    — builder's team lead (can export, manage docs)
-- agent      — sales agent (view + update leads)
-- viewer     — read-only dashboard access

-- ── Helper function: updated_at trigger ──────────────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_orgs_updated_at
  BEFORE UPDATE ON organizations
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_oauth_updated_at
  BEFORE UPDATE ON oauth_accounts
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── Cleanup: expire refresh tokens older than 35 days (run via cron or pg_cron)
-- DELETE FROM refresh_tokens WHERE expires_at < NOW() - INTERVAL '35 days';