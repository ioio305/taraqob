-- ============================================================
-- TARAQOB — Migration 005: User Contract Analyses
-- ============================================================

-- جدول تحليلات المستخدمين
CREATE TABLE IF NOT EXISTS user_analyses (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  
  -- بيانات العقد
  contract_type   TEXT NOT NULL CHECK (contract_type IN ('call', 'put')),
  strike          NUMERIC(10,2) NOT NULL,
  expiry          DATE,
  dte             INT,
  bid             NUMERIC(8,4),
  ask             NUMERIC(8,4),
  mid             NUMERIC(8,4),
  delta           NUMERIC(6,4),
  iv              NUMERIC(6,4),
  volume          INT,
  open_interest   INT,
  
  -- نتيجة التحليل
  composite_score INT,
  decision        TEXT,
  risk_profile    TEXT DEFAULT 'معتدل',
  
  -- بيانات السوق وقت التحليل
  spx_price       NUMERIC(10,2),
  vix_price       NUMERIC(6,2),
  
  -- بطاقة التداول
  entry_zone_low  NUMERIC(8,4),
  entry_zone_high NUMERIC(8,4),
  target1         NUMERIC(8,4),
  target2         NUMERIC(8,4),
  stop_loss       NUMERIC(8,4),
  
  -- الحالة
  status          TEXT DEFAULT 'open' CHECK (status IN ('open', 'closed', 'expired')),
  notes           TEXT,
  
  -- نتيجة فعلية (اختياري بعد الإغلاق)
  actual_exit_price NUMERIC(8,4),
  actual_pnl_pct    NUMERIC(8,4),
  
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_user_analyses_user ON user_analyses(user_id, created_at DESC);

-- RLS
ALTER TABLE user_analyses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "analyses_own" ON user_analyses
  FOR ALL USING (user_id = auth.uid());

CREATE POLICY "analyses_admin_read" ON user_analyses
  FOR SELECT USING (
    (SELECT role FROM user_profiles WHERE id = auth.uid()) IN ('admin', 'moderator')
  );

-- Updated_at trigger
CREATE TRIGGER update_user_analyses_updated_at
  BEFORE UPDATE ON user_analyses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
