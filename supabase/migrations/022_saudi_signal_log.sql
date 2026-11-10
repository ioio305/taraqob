-- 022 — سجل الأداء الشفاف للسوق السعودي
-- كل «مرشّح قوي» يُسجَّل يوم ظهوره (مجدول /api/v2/saudi/track بعد إغلاق تداول)،
-- ثم تُتابَع نتيجته بعد 5 و10 و20 جلسة. القراءة والكتابة عبر الخادم فقط (service_role).

BEGIN;

CREATE TABLE IF NOT EXISTS public.saudi_signal_log (
  id               bigserial PRIMARY KEY,
  signal_date      date        NOT NULL,
  symbol           text        NOT NULL,
  name             text        NOT NULL,
  sector           text,
  score            integer     NOT NULL,
  entry_price      numeric     NOT NULL,
  stop_price       numeric     NOT NULL,
  atr              numeric,
  market_return    numeric,
  sessions_tracked integer     NOT NULL DEFAULT 0,
  price_5          numeric,
  ret_5            numeric,
  price_10         numeric,
  ret_10           numeric,
  price_20         numeric,
  ret_20           numeric,
  hit_stop         boolean     NOT NULL DEFAULT false,
  stop_hit_date    date,
  max_gain         numeric,
  max_drawdown     numeric,
  status           text        NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'done')),
  created_at       timestamptz NOT NULL DEFAULT now(),
  evaluated_at     timestamptz,
  UNIQUE (signal_date, symbol)
);

CREATE INDEX IF NOT EXISTS saudi_signal_log_status_idx ON public.saudi_signal_log (status, signal_date);

-- خدمة فقط: RLS مفعّل بلا سياسات، والخادم يقرأ ويكتب بدور service_role.
ALTER TABLE public.saudi_signal_log ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.saudi_signal_log TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.saudi_signal_log_id_seq TO service_role;

COMMIT;
