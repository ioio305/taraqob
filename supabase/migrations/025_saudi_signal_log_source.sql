-- 025 — سجل الأداء: فصل مصدر الترشيح (المرشّح القوي / فرصة الدخول) ونوع الإشارة
-- لكل مصدر سجل مستقل للسهم في اليوم، فتُقاس «فرص الدخول» المبنية على الدراسة بنتائج حقيقية.

BEGIN;

ALTER TABLE public.saudi_signal_log ADD COLUMN IF NOT EXISTS source    text    NOT NULL DEFAULT 'strong';
ALTER TABLE public.saudi_signal_log ADD COLUMN IF NOT EXISTS setup_key text;
ALTER TABLE public.saudi_signal_log ADD COLUMN IF NOT EXISTS proven    boolean;

ALTER TABLE public.saudi_signal_log DROP CONSTRAINT IF EXISTS saudi_signal_log_source_check;
ALTER TABLE public.saudi_signal_log ADD CONSTRAINT saudi_signal_log_source_check CHECK (source IN ('strong', 'entry'));

ALTER TABLE public.saudi_signal_log DROP CONSTRAINT IF EXISTS saudi_signal_log_signal_date_symbol_key;
CREATE UNIQUE INDEX IF NOT EXISTS saudi_signal_log_day_symbol_source_idx ON public.saudi_signal_log (signal_date, symbol, source);

COMMIT;
