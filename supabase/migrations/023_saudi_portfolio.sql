-- 023 — محفظتي في السوق السعودي: مراكز المستخدم (أسهم فورية)
-- كل مستخدم يرى ويعدّل مراكزه فقط (RLS بالمالك)، والخادم يصل بدور service_role.

BEGIN;

CREATE TABLE IF NOT EXISTS public.saudi_portfolio (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  symbol       text        NOT NULL CHECK (symbol ~ '^[0-9]{4}$'),
  qty          numeric     NOT NULL CHECK (qty > 0),
  buy_price    numeric     NOT NULL CHECK (buy_price > 0),
  buy_date     date,
  stop_price   numeric     CHECK (stop_price IS NULL OR stop_price > 0),
  target_price numeric     CHECK (target_price IS NULL OR target_price > 0),
  note         text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS saudi_portfolio_user_idx ON public.saudi_portfolio (user_id, created_at);

ALTER TABLE public.saudi_portfolio ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS saudi_portfolio_owner_select ON public.saudi_portfolio;
DROP POLICY IF EXISTS saudi_portfolio_owner_insert ON public.saudi_portfolio;
DROP POLICY IF EXISTS saudi_portfolio_owner_update ON public.saudi_portfolio;
DROP POLICY IF EXISTS saudi_portfolio_owner_delete ON public.saudi_portfolio;
CREATE POLICY saudi_portfolio_owner_select ON public.saudi_portfolio FOR SELECT TO authenticated USING ((SELECT auth.uid()) = user_id);
CREATE POLICY saudi_portfolio_owner_insert ON public.saudi_portfolio FOR INSERT TO authenticated WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY saudi_portfolio_owner_update ON public.saudi_portfolio FOR UPDATE TO authenticated USING ((SELECT auth.uid()) = user_id) WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY saudi_portfolio_owner_delete ON public.saudi_portfolio FOR DELETE TO authenticated USING ((SELECT auth.uid()) = user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.saudi_portfolio TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.saudi_portfolio TO service_role;

COMMIT;
