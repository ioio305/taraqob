-- 024 — التنبيهات السعرية للسوق السعودي
-- المستخدم يضع سعراً (أعلى/أدنى)، ويُفحص عند فتح المنصة وبعد إغلاق كل جلسة (أعلى وأدنى سعر اليوم).

BEGIN;

CREATE TABLE IF NOT EXISTS public.saudi_price_alerts (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  symbol          text        NOT NULL CHECK (symbol ~ '^[0-9]{4}$'),
  direction       text        NOT NULL CHECK (direction IN ('above', 'below')),
  price           numeric     NOT NULL CHECK (price > 0),
  note            text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  triggered_at    timestamptz,
  triggered_price numeric,
  notified        boolean     NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS saudi_price_alerts_user_idx ON public.saudi_price_alerts (user_id, created_at);
CREATE INDEX IF NOT EXISTS saudi_price_alerts_open_idx ON public.saudi_price_alerts (symbol) WHERE triggered_at IS NULL;

ALTER TABLE public.saudi_price_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY saudi_price_alerts_owner_select ON public.saudi_price_alerts FOR SELECT TO authenticated USING ((SELECT auth.uid()) = user_id);
CREATE POLICY saudi_price_alerts_owner_insert ON public.saudi_price_alerts FOR INSERT TO authenticated WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY saudi_price_alerts_owner_update ON public.saudi_price_alerts FOR UPDATE TO authenticated USING ((SELECT auth.uid()) = user_id) WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY saudi_price_alerts_owner_delete ON public.saudi_price_alerts FOR DELETE TO authenticated USING ((SELECT auth.uid()) = user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.saudi_price_alerts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.saudi_price_alerts TO service_role;

COMMIT;
