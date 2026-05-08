-- ============================================================
-- Migration 006: Subscription Tiers + In-App Notifications
-- Run in Supabase SQL Editor
-- ============================================================

-- ── Subscription tier enum ────────────────────────────────────
CREATE TYPE subscription_tier AS ENUM ('radar', 'signal', 'edge', 'alpha');

-- ── Add tier column to user_profiles ─────────────────────────
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS subscription_tier subscription_tier NOT NULL DEFAULT 'radar';

-- Staff always get alpha tier
UPDATE user_profiles
  SET subscription_tier = 'alpha'
  WHERE role IN ('admin', 'moderator');

-- ── In-app notifications table ────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  body        TEXT NOT NULL,
  type        TEXT NOT NULL DEFAULT 'info',   -- info | warning | strategy | signal | system
  is_read     BOOLEAN NOT NULL DEFAULT false,
  action_url  TEXT,
  metadata    JSONB DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id
  ON notifications(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_unread
  ON notifications(user_id, is_read) WHERE NOT is_read;

-- ── RLS on notifications ──────────────────────────────────────
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Users can only read/update their own notifications
CREATE POLICY "users_read_own_notifications"
  ON notifications FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "users_update_own_notifications"
  ON notifications FOR UPDATE
  USING (user_id = auth.uid());

-- Service role (used by API routes) can insert for any user
CREATE POLICY "service_insert_notifications"
  ON notifications FOR INSERT
  WITH CHECK (true);

-- ── Helper: mark_notifications_read(user_id) ─────────────────
CREATE OR REPLACE FUNCTION mark_all_notifications_read(p_user_id UUID)
RETURNS void LANGUAGE sql SECURITY DEFINER AS $$
  UPDATE notifications SET is_read = true
  WHERE user_id = p_user_id AND is_read = false;
$$;
