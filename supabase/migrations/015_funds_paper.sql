-- 015 — المحفظة التجريبية السحابية لمنصة الصناديق
-- صفقات افتراضية لكل مستخدم، تتبعه على كل أجهزته (مثل دفتر v2_trades).
-- تُطبَّق في محرر SQL في لوحة Supabase مرة واحدة. التطبيق يعمل محليًا إلى أن تُطبَّق.

BEGIN;

CREATE TABLE IF NOT EXISTS public.funds_paper_positions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  symbol      text NOT NULL,
  name_ar     text NOT NULL DEFAULT '',
  units       integer NOT NULL DEFAULT 0,
  entry       numeric NOT NULL,
  stop        numeric NOT NULL,
  t1          numeric NOT NULL,
  t2          numeric NOT NULL,
  added_at    timestamptz NOT NULL DEFAULT now(),
  closed_exit numeric,
  closed_at   timestamptz
);

CREATE INDEX IF NOT EXISTS funds_paper_user_idx
  ON public.funds_paper_positions (user_id);

ALTER TABLE public.funds_paper_positions ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.funds_paper_positions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.funds_paper_positions TO service_role;

DROP POLICY IF EXISTS "own paper positions" ON public.funds_paper_positions;
CREATE POLICY "own paper positions" ON public.funds_paper_positions
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

COMMIT;
