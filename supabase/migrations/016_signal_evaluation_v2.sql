-- 016 — قياس محافظ وشفاف لأداء التوصيات الجديدة.
-- لا يعيد احتساب النتائج التاريخية المغلقة.
BEGIN;

ALTER TABLE public.v2_signals
  ADD COLUMN IF NOT EXISTS entry_bid numeric,
  ADD COLUMN IF NOT EXISTS entry_ask numeric,
  ADD COLUMN IF NOT EXISTS contract_stop_price numeric,
  ADD COLUMN IF NOT EXISTS contract_target_price numeric,
  ADD COLUMN IF NOT EXISTS evaluation_version text,
  ADD COLUMN IF NOT EXISTS evaluation_method text,
  ADD COLUMN IF NOT EXISTS outcome_reason text,
  ADD COLUMN IF NOT EXISTS outcome_at timestamptz,
  ADD COLUMN IF NOT EXISTS outcome_price numeric,
  ADD COLUMN IF NOT EXISTS mfe numeric,
  ADD COLUMN IF NOT EXISTS mae numeric,
  ADD COLUMN IF NOT EXISTS realized_r numeric,
  ADD COLUMN IF NOT EXISTS signal_date date,
  ADD COLUMN IF NOT EXISTS telegram_status text NOT NULL DEFAULT 'not_required',
  ADD COLUMN IF NOT EXISTS telegram_attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS telegram_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS telegram_last_attempt_at timestamptz,
  ADD COLUMN IF NOT EXISTS valid_until timestamptz,
  ADD COLUMN IF NOT EXISTS max_entry_price numeric,
  ADD COLUMN IF NOT EXISTS risk_budget_pct numeric;

ALTER TABLE public.v2_signals DROP CONSTRAINT IF EXISTS v2_signals_status_check;
ALTER TABLE public.v2_signals ADD CONSTRAINT v2_signals_status_check
  CHECK (status IN ('active','watching','closed_win','closed_loss','expired','invalidated'));

ALTER TABLE public.v2_signals DROP CONSTRAINT IF EXISTS v2_signals_telegram_status_check;
ALTER TABLE public.v2_signals ADD CONSTRAINT v2_signals_telegram_status_check
  CHECK (telegram_status IN ('not_required','pending','sent','failed'));

CREATE UNIQUE INDEX IF NOT EXISTS v2_signals_server_contract_day_uq
  ON public.v2_signals (contract_symbol, signal_date)
  WHERE user_id IS NULL AND signal_date IS NOT NULL;

COMMIT;
