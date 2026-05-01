-- ============================================================
-- TARAQOB PLATFORM — DATABASE SCHEMA
-- Migration 001: Core Schema
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- ENUMS
-- ============================================================

CREATE TYPE user_role AS ENUM ('admin', 'analyst', 'beta_user');

CREATE TYPE market_bias AS ENUM ('bullish', 'bearish', 'neutral', 'mixed', 'risk_off');

CREATE TYPE event_risk AS ENUM ('clear', 'caution', 'high_risk', 'block');

CREATE TYPE vwap_status AS ENUM ('above', 'below', 'at');

CREATE TYPE contract_type AS ENUM ('call', 'put');

CREATE TYPE contract_quality AS ENUM ('good', 'acceptable', 'weak', 'avoid');

CREATE TYPE execution_risk AS ENUM ('low', 'medium', 'high');

CREATE TYPE signal_status AS ENUM (
  'draft', 'pending_review', 'published',
  'watch', 'conditional', 'active',
  'exit', 'invalidated', 'closed', 'archived'
);

CREATE TYPE signal_direction AS ENUM ('bullish', 'bearish', 'neutral');

CREATE TYPE signal_strategy AS ENUM (
  'bull_call_debit_spread',
  'bear_put_debit_spread',
  'bull_put_credit_spread',
  'bear_call_credit_spread',
  'long_call',
  'long_put'
);

CREATE TYPE risk_level AS ENUM ('low', 'medium', 'high', 'extreme');

CREATE TYPE signal_update_type AS ENUM (
  'still_valid', 'move_to_watch', 'entry_triggered',
  'exit_triggered', 'invalidated', 'closed',
  'reduce_risk', 'take_partial_profit', 'cancel_setup', 'note'
);

CREATE TYPE signal_outcome AS ENUM ('win', 'loss', 'breakeven', 'invalidated', 'no_entry');

CREATE TYPE decision_state AS ENUM (
  'no_trade', 'watch', 'conditional', 'active', 'exit', 'invalidated'
);

CREATE TYPE notification_channel AS ENUM ('email', 'telegram');

CREATE TYPE notification_status AS ENUM ('sent', 'failed', 'pending');

CREATE TYPE performance_period AS ENUM ('daily', 'weekly', 'monthly', 'all_time');

-- ============================================================
-- USER PROFILES
-- ============================================================

CREATE TABLE user_profiles (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email         TEXT NOT NULL,
  full_name     TEXT,
  full_name_ar  TEXT,
  role          user_role NOT NULL DEFAULT 'beta_user',
  is_active     BOOLEAN NOT NULL DEFAULT true,
  invited_by    UUID REFERENCES user_profiles(id),
  avatar_url    TEXT,
  preferences   JSONB NOT NULL DEFAULT '{"language": "ar", "theme": "light"}',
  joined_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- INVITATIONS
-- ============================================================

CREATE TABLE invitations (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email       TEXT NOT NULL,
  role        user_role NOT NULL DEFAULT 'beta_user',
  invited_by  UUID NOT NULL REFERENCES user_profiles(id),
  token       TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  expires_at  TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '7 days'),
  used_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_invitations_email ON invitations(email);
CREATE INDEX idx_invitations_token ON invitations(token);

-- ============================================================
-- ECONOMIC EVENTS
-- ============================================================

CREATE TABLE economic_events (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_date    DATE NOT NULL,
  event_time    TIME,
  event_name    TEXT NOT NULL,
  event_name_ar TEXT,
  impact_level  TEXT NOT NULL CHECK (impact_level IN ('low', 'medium', 'high', 'critical')),
  description   TEXT,
  source        TEXT,
  created_by    UUID REFERENCES user_profiles(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_economic_events_date ON economic_events(event_date);

-- ============================================================
-- MARKET SESSIONS
-- ============================================================

CREATE TABLE market_sessions (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_date          DATE NOT NULL UNIQUE,
  -- SPX Data
  spx_open              NUMERIC(10,2),
  spx_high              NUMERIC(10,2),
  spx_low               NUMERIC(10,2),
  spx_close             NUMERIC(10,2),
  spx_previous_close    NUMERIC(10,2),
  spx_change_percent    NUMERIC(6,3),
  -- Volatility
  vix                   NUMERIC(6,2),
  -- Intraday
  vwap_level            NUMERIC(10,2),
  vwap_status           vwap_status,
  opening_range_high    NUMERIC(10,2),
  opening_range_low     NUMERIC(10,2),
  -- Expected Move
  expected_move_upper   NUMERIC(10,2),
  expected_move_lower   NUMERIC(10,2),
  expected_move_points  NUMERIC(8,2),
  -- Market Assessment
  economic_event_risk   event_risk NOT NULL DEFAULT 'clear',
  market_bias           market_bias,
  -- Notes & AI
  notes                 TEXT,
  ai_market_summary     TEXT,
  ai_summary_ar         TEXT,
  -- Metadata
  is_trading_day        BOOLEAN NOT NULL DEFAULT true,
  session_status        TEXT NOT NULL DEFAULT 'open' CHECK (session_status IN ('open', 'closed', 'holiday')),
  created_by            UUID REFERENCES user_profiles(id),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_market_sessions_date ON market_sessions(session_date DESC);

-- ============================================================
-- INDICATOR DEFINITIONS (Static Reference Data)
-- ============================================================

CREATE TABLE indicator_definitions (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code            TEXT NOT NULL UNIQUE,
  name_ar         TEXT NOT NULL,
  name_en         TEXT NOT NULL,
  description_ar  TEXT,
  description_en  TEXT,
  default_weight  NUMERIC(4,3) NOT NULL DEFAULT 0.143,
  sort_order      INT NOT NULL DEFAULT 0,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- INDICATOR SCORES (Per Session)
-- ============================================================

CREATE TABLE indicator_scores (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id       UUID NOT NULL REFERENCES market_sessions(id) ON DELETE CASCADE,
  indicator_id     UUID NOT NULL REFERENCES indicator_definitions(id),
  -- Scoring
  score            NUMERIC(5,2) CHECK (score BETWEEN 0 AND 100),
  status           TEXT,
  status_ar        TEXT,
  -- Weight (can be overridden per session)
  weight           NUMERIC(4,3),
  -- Inputs (raw data used to calculate)
  inputs           JSONB NOT NULL DEFAULT '{}',
  -- Outputs
  interpretation   TEXT,
  interpretation_ar TEXT,
  supports_entry   BOOLEAN,
  blocks_entry     BOOLEAN,
  block_reason     TEXT,
  -- Notes
  analyst_notes    TEXT,
  ai_explanation   TEXT,
  ai_explanation_ar TEXT,
  -- Metadata
  last_updated_by  UUID REFERENCES user_profiles(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(session_id, indicator_id)
);

CREATE INDEX idx_indicator_scores_session ON indicator_scores(session_id);

-- ============================================================
-- RISK RULES
-- ============================================================

CREATE TABLE risk_rules (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  rule_code       TEXT NOT NULL UNIQUE,
  name_ar         TEXT NOT NULL,
  name_en         TEXT NOT NULL,
  description_ar  TEXT,
  is_hard_block   BOOLEAN NOT NULL DEFAULT false,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  sort_order      INT DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- OPTION CONTRACTS WATCHLIST
-- ============================================================

CREATE TABLE option_contracts (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id        UUID NOT NULL REFERENCES market_sessions(id) ON DELETE CASCADE,
  -- Contract Identity
  contract_type     contract_type NOT NULL,
  expiry            DATE NOT NULL,
  dte               INT,
  strike            NUMERIC(10,2) NOT NULL,
  -- Pricing
  bid               NUMERIC(8,4),
  ask               NUMERIC(8,4),
  mid               NUMERIC(8,4),
  last_price        NUMERIC(8,4),
  -- Greeks
  delta             NUMERIC(6,4),
  gamma             NUMERIC(8,6),
  theta             NUMERIC(8,4),
  vega              NUMERIC(8,4),
  iv                NUMERIC(6,4),
  iv_rank           NUMERIC(5,2),
  -- Volume & OI
  volume            INT,
  open_interest     INT,
  -- Quality Assessment
  liquidity_score   NUMERIC(5,2) CHECK (liquidity_score BETWEEN 0 AND 100),
  contract_quality  contract_quality,
  execution_risk    execution_risk,
  -- Notes
  notes             TEXT,
  is_selected       BOOLEAN DEFAULT false,
  -- Metadata
  created_by        UUID REFERENCES user_profiles(id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_contracts_session ON option_contracts(session_id);

-- ============================================================
-- SIGNALS (Core Table — Immutable after publish)
-- ============================================================

CREATE TABLE signals (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  signal_ref      TEXT UNIQUE, -- e.g. TRQ-2024-001

  -- Session Link
  session_id      UUID REFERENCES market_sessions(id),

  -- Classification
  asset           TEXT NOT NULL DEFAULT 'SPX',
  direction       signal_direction,
  strategy        signal_strategy,

  -- Status
  status          signal_status NOT NULL DEFAULT 'draft',
  market_bias     market_bias,

  -- Entry
  entry_condition     TEXT,
  entry_range_low     NUMERIC(10,2),
  entry_range_high    NUMERIC(10,2),
  entry_notes         TEXT,
  entry_notes_ar      TEXT,

  -- Risk Management
  invalidation_level      NUMERIC(10,2),
  invalidation_condition  TEXT,
  invalidation_condition_ar TEXT,
  exit_plan               TEXT,
  exit_plan_ar            TEXT,
  profit_target           NUMERIC(10,2),
  max_risk_percent        NUMERIC(5,2),
  risk_level              risk_level,

  -- Scoring
  confidence_score        INT CHECK (confidence_score BETWEEN 0 AND 100),
  composite_indicator_score NUMERIC(5,2),
  decision_state          decision_state,

  -- Content (Arabic primary)
  rationale               TEXT,
  ai_generated_summary    TEXT,
  user_summary            TEXT,  -- compliance-safe, shown to Beta Users
  user_summary_ar         TEXT,
  analyst_notes           TEXT,

  -- Contract
  selected_contract_id    UUID REFERENCES option_contracts(id),
  expiry                  DATE,

  -- Frozen Snapshots (saved at publish time — NEVER modified after)
  indicator_snapshot      JSONB NOT NULL DEFAULT '{}',
  decision_engine_output  JSONB NOT NULL DEFAULT '{}',
  market_snapshot         JSONB NOT NULL DEFAULT '{}',
  risk_rules_check        JSONB NOT NULL DEFAULT '{}',

  -- Workflow Tracking
  created_by              UUID REFERENCES user_profiles(id),
  submitted_by            UUID REFERENCES user_profiles(id),
  submitted_at            TIMESTAMPTZ,
  reviewed_by             UUID REFERENCES user_profiles(id),
  reviewed_at             TIMESTAMPTZ,
  published_by            UUID REFERENCES user_profiles(id),
  published_at            TIMESTAMPTZ,
  closed_by               UUID REFERENCES user_profiles(id),
  closed_at               TIMESTAMPTZ,
  archived_by             UUID REFERENCES user_profiles(id),
  archived_at             TIMESTAMPTZ,

  -- Post-close Documentation
  close_reason            TEXT,
  was_plan_followed       BOOLEAN,
  post_close_notes        TEXT,

  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_signals_status    ON signals(status);
CREATE INDEX idx_signals_session   ON signals(session_id);
CREATE INDEX idx_signals_published ON signals(published_at DESC NULLS LAST);

-- Auto-generate signal reference
CREATE OR REPLACE FUNCTION generate_signal_ref()
RETURNS TRIGGER AS $$
DECLARE
  year_str TEXT;
  seq_num  INT;
  ref_str  TEXT;
BEGIN
  year_str := TO_CHAR(now(), 'YYYY');
  SELECT COUNT(*) + 1 INTO seq_num
  FROM signals
  WHERE EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM now());
  ref_str := 'TRQ-' || year_str || '-' || LPAD(seq_num::TEXT, 3, '0');
  NEW.signal_ref := ref_str;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_signal_ref
  BEFORE INSERT ON signals
  FOR EACH ROW
  WHEN (NEW.signal_ref IS NULL)
  EXECUTE FUNCTION generate_signal_ref();

-- ============================================================
-- SIGNAL UPDATES (Append-Only — Never modify or delete)
-- ============================================================

CREATE TABLE signal_updates (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  signal_id     UUID NOT NULL REFERENCES signals(id) ON DELETE RESTRICT,
  -- Update Info
  update_type   signal_update_type NOT NULL,
  new_status    signal_status,
  -- Content (Arabic primary)
  content       TEXT NOT NULL,
  content_ar    TEXT,
  -- Notification
  is_notified   BOOLEAN NOT NULL DEFAULT false,
  notified_at   TIMESTAMPTZ,
  -- Metadata
  created_by    UUID REFERENCES user_profiles(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
  -- NO updated_at intentionally — append-only table
);

CREATE INDEX idx_signal_updates_signal ON signal_updates(signal_id, created_at DESC);

-- Prevent updates and deletes on signal_updates
CREATE OR REPLACE FUNCTION prevent_signal_update_modification()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'سجلات تحديثات الإشارة غير قابلة للتعديل أو الحذف';
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER no_update_signal_updates
  BEFORE UPDATE ON signal_updates
  FOR EACH ROW EXECUTE FUNCTION prevent_signal_update_modification();

CREATE TRIGGER no_delete_signal_updates
  BEFORE DELETE ON signal_updates
  FOR EACH ROW EXECUTE FUNCTION prevent_signal_update_modification();

-- ============================================================
-- SIGNAL RESULTS
-- ============================================================

CREATE TABLE signal_results (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  signal_id            UUID UNIQUE NOT NULL REFERENCES signals(id),
  outcome              signal_outcome NOT NULL,
  pnl_percent          NUMERIC(8,4),
  entry_price_actual   NUMERIC(10,4),
  exit_price_actual    NUMERIC(10,4),
  max_adverse_move     NUMERIC(8,4),
  duration_minutes     INT,
  rule_adherence_score INT CHECK (rule_adherence_score BETWEEN 0 AND 100),
  post_analysis        TEXT,
  post_analysis_ar     TEXT,
  recorded_by          UUID REFERENCES user_profiles(id),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- PERFORMANCE SNAPSHOTS
-- ============================================================

CREATE TABLE performance_snapshots (
  id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  snapshot_date           DATE NOT NULL,
  period                  performance_period NOT NULL,
  -- Counts
  total_signals           INT NOT NULL DEFAULT 0,
  closed_signals          INT NOT NULL DEFAULT 0,
  open_signals            INT NOT NULL DEFAULT 0,
  invalidated_signals     INT NOT NULL DEFAULT 0,
  no_entry_signals        INT NOT NULL DEFAULT 0,
  -- Performance
  win_count               INT NOT NULL DEFAULT 0,
  loss_count              INT NOT NULL DEFAULT 0,
  win_rate                NUMERIC(5,2),
  avg_gain_percent        NUMERIC(8,4),
  avg_loss_percent        NUMERIC(8,4),
  max_drawdown            NUMERIC(8,4),
  avg_duration_minutes    NUMERIC(10,2),
  rule_adherence_rate     NUMERIC(5,2),
  -- Breakdown
  best_strategy           signal_strategy,
  worst_strategy          signal_strategy,
  breakdown_by_strategy   JSONB NOT NULL DEFAULT '{}',
  breakdown_by_regime     JSONB NOT NULL DEFAULT '{}',
  breakdown_by_risk_level JSONB NOT NULL DEFAULT '{}',
  -- AI Report
  ai_weekly_report        TEXT,
  ai_weekly_report_ar     TEXT,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(snapshot_date, period)
);

-- ============================================================
-- NOTIFICATION PREFERENCES
-- ============================================================

CREATE TABLE notification_preferences (
  id                       UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id                  UUID UNIQUE NOT NULL REFERENCES user_profiles(id),
  email_signal_published   BOOLEAN NOT NULL DEFAULT true,
  email_signal_updated     BOOLEAN NOT NULL DEFAULT true,
  email_signal_closed      BOOLEAN NOT NULL DEFAULT true,
  email_signal_invalidated BOOLEAN NOT NULL DEFAULT true,
  email_daily_summary      BOOLEAN NOT NULL DEFAULT false,
  email_weekly_report      BOOLEAN NOT NULL DEFAULT false,
  telegram_enabled         BOOLEAN NOT NULL DEFAULT false,
  telegram_chat_id         TEXT,
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- NOTIFICATION LOG
-- ============================================================

CREATE TABLE notification_log (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID REFERENCES user_profiles(id),
  type       TEXT NOT NULL,
  channel    notification_channel NOT NULL,
  signal_id  UUID REFERENCES signals(id),
  subject    TEXT,
  content    TEXT,
  status     notification_status NOT NULL DEFAULT 'pending',
  sent_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  error_msg  TEXT
);

CREATE INDEX idx_notification_log_user ON notification_log(user_id, sent_at DESC);

-- ============================================================
-- AUDIT TRAIL (Append-Only)
-- ============================================================

CREATE TABLE audit_logs (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  actor_id     UUID REFERENCES user_profiles(id),
  actor_email  TEXT,
  action       TEXT NOT NULL,
  entity_type  TEXT NOT NULL,
  entity_id    UUID,
  entity_ref   TEXT,
  old_values   JSONB,
  new_values   JSONB,
  ip_address   TEXT,
  user_agent   TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_logs_entity   ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_logs_actor    ON audit_logs(actor_id);
CREATE INDEX idx_audit_logs_created  ON audit_logs(created_at DESC);

-- Prevent modification of audit logs
CREATE OR REPLACE FUNCTION prevent_audit_modification()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'سجلات المراجعة غير قابلة للتعديل أو الحذف';
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER no_update_audit
  BEFORE UPDATE ON audit_logs
  FOR EACH ROW EXECUTE FUNCTION prevent_audit_modification();

CREATE TRIGGER no_delete_audit
  BEFORE DELETE ON audit_logs
  FOR EACH ROW EXECUTE FUNCTION prevent_audit_modification();

-- ============================================================
-- UPDATED_AT TRIGGER
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_user_profiles_updated_at
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_market_sessions_updated_at
  BEFORE UPDATE ON market_sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_indicator_scores_updated_at
  BEFORE UPDATE ON indicator_scores
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_option_contracts_updated_at
  BEFORE UPDATE ON option_contracts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_signals_updated_at
  BEFORE UPDATE ON signals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- AUTO-CREATE USER PROFILE ON SIGNUP
-- ============================================================

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO user_profiles (id, email, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(
      (NEW.raw_user_meta_data->>'role')::user_role,
      'beta_user'
    )
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
