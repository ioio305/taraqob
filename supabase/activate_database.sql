-- ============================================================
-- TARAQOB V2 — Database Activation / Repair
-- Safe to run in Supabase SQL Editor for a fresh or partially migrated DB.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('admin', 'moderator', 'analyst', 'beta_user', 'user');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'moderator';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'user';

DO $$ BEGIN
  CREATE TYPE subscription_tier AS ENUM ('radar', 'signal', 'edge', 'alpha');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS user_profiles (
  id                 UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email              TEXT NOT NULL,
  full_name          TEXT,
  full_name_ar       TEXT,
  role               user_role NOT NULL DEFAULT 'beta_user',
  subscription_tier  subscription_tier NOT NULL DEFAULT 'radar',
  is_active          BOOLEAN NOT NULL DEFAULT true,
  invited_by         UUID REFERENCES user_profiles(id),
  avatar_url         TEXT,
  preferences        JSONB NOT NULL DEFAULT '{"language": "ar", "theme": "dark"}',
  joined_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at       TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS subscription_tier subscription_tier NOT NULL DEFAULT 'radar';
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS preferences JSONB NOT NULL DEFAULT '{"language": "ar", "theme": "dark"}';

CREATE TABLE IF NOT EXISTS invitations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email       TEXT NOT NULL,
  role        user_role NOT NULL DEFAULT 'beta_user',
  invited_by  UUID REFERENCES user_profiles(id),
  token       TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  expires_at  TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '7 days'),
  used_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS v2_signals (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  signal_ref         TEXT,
  contract_symbol    TEXT NOT NULL,
  contract_type      TEXT CHECK (contract_type IN ('call','put')),
  strike             NUMERIC,
  expiry             DATE,
  dte                INTEGER,
  total_score        INTEGER,
  decision           TEXT,
  status             TEXT DEFAULT 'active' CHECK (status IN ('active','watching','closed_win','closed_loss','expired','invalidated')),
  entry_price        NUMERIC,
  stop_loss_level    NUMERIC,
  target_level       NUMERIC,
  risk_reward_ratio  NUMERIC,
  pnl_percent        NUMERIC,
  summary_ar         TEXT,
  spx_at_signal      NUMERIC,
  created_at         TIMESTAMPTZ DEFAULT now(),
  updated_at         TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS notifications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type        TEXT NOT NULL DEFAULT 'info',
  title       TEXT NOT NULL,
  body        TEXT,
  url         TEXT,
  is_read     BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS notifications_user_unread ON notifications (user_id, is_read, created_at DESC);

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_user_profiles_updated_at ON user_profiles;
CREATE TRIGGER update_user_profiles_updated_at
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_v2_signals_updated_at ON v2_signals;
CREATE TRIGGER update_v2_signals_updated_at
  BEFORE UPDATE ON v2_signals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  requested_role TEXT;
  safe_role user_role;
BEGIN
  requested_role := NEW.raw_user_meta_data->>'role';

  IF requested_role IS NOT NULL AND EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'user_role' AND e.enumlabel = requested_role
  ) THEN
    safe_role := requested_role::user_role;
  ELSE
    safe_role := 'beta_user'::user_role;
  END IF;

  INSERT INTO user_profiles (id, email, role, is_active)
  VALUES (NEW.id, NEW.email, safe_role, true)
  ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email,
        updated_at = now();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

INSERT INTO user_profiles (id, email, role, is_active)
SELECT u.id, u.email, 'beta_user'::user_role, true
FROM auth.users u
LEFT JOIN user_profiles p ON p.id = u.id
WHERE p.id IS NULL;

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE v2_signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION get_my_role()
RETURNS user_role AS $$
  SELECT role FROM user_profiles WHERE id = auth.uid()
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION is_staff()
RETURNS BOOLEAN AS $$
  SELECT get_my_role() IN ('admin', 'moderator', 'analyst')
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

DROP POLICY IF EXISTS "user_profiles_read_own" ON user_profiles;
DROP POLICY IF EXISTS "user_profiles_staff_read_all" ON user_profiles;
DROP POLICY IF EXISTS "user_profiles_update_own" ON user_profiles;
DROP POLICY IF EXISTS "user_profiles_staff_update" ON user_profiles;

CREATE POLICY "user_profiles_read_own" ON user_profiles
  FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "user_profiles_staff_read_all" ON user_profiles
  FOR SELECT TO authenticated USING (is_staff());
CREATE POLICY "user_profiles_update_own" ON user_profiles
  FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "user_profiles_staff_update" ON user_profiles
  FOR UPDATE TO authenticated USING (is_staff());

DROP POLICY IF EXISTS "users_own_signals" ON v2_signals;
DROP POLICY IF EXISTS "staff_all_signals" ON v2_signals;
CREATE POLICY "users_own_signals" ON v2_signals
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "staff_all_signals" ON v2_signals
  FOR ALL TO authenticated USING (is_staff()) WITH CHECK (is_staff());

DROP POLICY IF EXISTS "users read own notifications" ON notifications;
DROP POLICY IF EXISTS "users mark own read" ON notifications;
DROP POLICY IF EXISTS "staff insert notifications" ON notifications;
CREATE POLICY "users read own notifications" ON notifications
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "users mark own read" ON notifications
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "staff insert notifications" ON notifications
  FOR INSERT TO authenticated WITH CHECK (is_staff());

DROP POLICY IF EXISTS "invitations_staff_all" ON invitations;
DROP POLICY IF EXISTS "invitations_read_by_token" ON invitations;
CREATE POLICY "invitations_staff_all" ON invitations
  FOR ALL TO authenticated USING (is_staff()) WITH CHECK (is_staff());
CREATE POLICY "invitations_read_by_token" ON invitations
  FOR SELECT USING (true);
