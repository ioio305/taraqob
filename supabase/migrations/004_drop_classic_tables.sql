-- ════════════════════════════════════════════════════════════
-- Migration 004: حذف جداول النسخة الكلاسيكية
-- يُحتفظ بـ: user_profiles, v2_signals, invitations, audit_logs
-- ════════════════════════════════════════════════════════════

-- ── حذف الجداول الكلاسيكية بالترتيب (foreign keys أولاً) ──

DROP TABLE IF EXISTS session_indicators CASCADE;
DROP TABLE IF EXISTS session_contracts  CASCADE;
DROP TABLE IF EXISTS analyses           CASCADE;
DROP TABLE IF EXISTS contracts          CASCADE;
DROP TABLE IF EXISTS signals            CASCADE;
DROP TABLE IF EXISTS sessions           CASCADE;
DROP TABLE IF EXISTS indicators         CASCADE;

-- ── حذف الدوال الكلاسيكية غير المستخدمة ────────────────────

DROP FUNCTION IF EXISTS update_updated_at() CASCADE;

-- ── إعادة إنشاء trigger updated_at للجداول المتبقية ────────

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ── التحقق من وجود v2_signals (تُنشأ إن لم تكن موجودة) ────

CREATE TABLE IF NOT EXISTS v2_signals (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  signal_ref       TEXT,
  contract_symbol  TEXT NOT NULL,
  contract_type    TEXT CHECK (contract_type IN ('call','put')),
  strike           NUMERIC,
  expiry           DATE,
  dte              INTEGER,
  total_score      INTEGER,
  decision         TEXT,
  status           TEXT DEFAULT 'active' CHECK (status IN ('active','watching','closed_win','closed_loss','expired')),
  entry_price      NUMERIC,
  stop_loss_level  NUMERIC,
  target_level     NUMERIC,
  risk_reward_ratio NUMERIC,
  pnl_percent      NUMERIC,
  summary_ar       TEXT,
  spx_at_signal    NUMERIC,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

-- RLS على v2_signals
ALTER TABLE v2_signals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_own_signals"   ON v2_signals;
DROP POLICY IF EXISTS "admins_all_signals"  ON v2_signals;

CREATE POLICY "users_own_signals" ON v2_signals
  FOR ALL TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "admins_all_signals" ON v2_signals
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role IN ('admin','moderator')
    )
  );
