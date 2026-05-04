-- ============================================================
-- Migration 006: Trade Tracking
-- تشغّل في Supabase SQL Editor
-- ============================================================

ALTER TABLE user_analyses 
  ADD COLUMN IF NOT EXISTS entry_price      NUMERIC(8,4),
  ADD COLUMN IF NOT EXISTS entry_time       TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS entry_spx_price  NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS target2          NUMERIC(8,4),
  ADD COLUMN IF NOT EXISTS target3          NUMERIC(8,4),
  ADD COLUMN IF NOT EXISTS trade_status     TEXT DEFAULT 'analyzed' 
    CHECK (trade_status IN ('analyzed','entered','target1_hit','target2_hit','target3_hit','stopped','expired')),
  ADD COLUMN IF NOT EXISTS exit_price       NUMERIC(8,4),
  ADD COLUMN IF NOT EXISTS exit_time        TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS exit_reason      TEXT,
  ADD COLUMN IF NOT EXISTS pnl_pct          NUMERIC(8,4);
