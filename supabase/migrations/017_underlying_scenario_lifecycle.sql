-- 017 — متابعة التوصية من حركة الأصل حتى الهدف الثاني أو انتهاء السيناريو.
BEGIN;

ALTER TABLE public.v2_signals
  ADD COLUMN IF NOT EXISTS target2_level numeric,
  ADD COLUMN IF NOT EXISTS scenario_stage text NOT NULL DEFAULT 'active';

ALTER TABLE public.v2_signals DROP CONSTRAINT IF EXISTS v2_signals_scenario_stage_check;
ALTER TABLE public.v2_signals ADD CONSTRAINT v2_signals_scenario_stage_check
  CHECK (scenario_stage IN ('active','target_one','completed','invalidated','expired'));

CREATE INDEX IF NOT EXISTS v2_signals_active_scenario_idx
  ON public.v2_signals (status, valid_until)
  WHERE status = 'active';

COMMENT ON COLUMN public.v2_signals.target2_level IS 'الهدف الثاني للأصل، وليس سعراً متوقعاً للعقد';
COMMENT ON COLUMN public.v2_signals.scenario_stage IS 'مرحلة سيناريو الأصل أثناء إدارة الصفقة';

COMMIT;
