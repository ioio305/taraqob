-- ─────────────────────────────────────────────────────────────────────────────
-- 006 — Subscription tiers + Notifications
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Subscription tier enum ──────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE subscription_tier AS ENUM ('radar', 'signal', 'edge', 'alpha');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS subscription_tier subscription_tier NOT NULL DEFAULT 'radar';

-- ── 2. Notifications table ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type        text NOT NULL DEFAULT 'info',   -- info | alert | signal | system
  title       text NOT NULL,
  body        text,
  url         text,
  is_read     boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS notifications_user_unread
  ON notifications (user_id, is_read, created_at DESC);

-- ── 3. RLS ────────────────────────────────────────────────────────────────
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users read own notifications"  ON notifications;
DROP POLICY IF EXISTS "staff insert notifications"     ON notifications;
DROP POLICY IF EXISTS "users mark own read"            ON notifications;

CREATE POLICY "users read own notifications"
  ON notifications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "staff insert notifications"
  ON notifications FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role IN ('admin', 'moderator')
    )
  );

CREATE POLICY "users mark own read"
  ON notifications FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── 4. mark_all_notifications_read helper ─────────────────────────────────
CREATE OR REPLACE FUNCTION mark_all_notifications_read(p_user_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
  UPDATE notifications
  SET is_read = true
  WHERE user_id = p_user_id AND is_read = false;
$$;
