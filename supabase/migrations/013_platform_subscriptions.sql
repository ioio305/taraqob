-- 013 — اشتراكات مستقلة لمنصات SPX والشركات والصناديق

BEGIN;

CREATE TABLE IF NOT EXISTS public.platform_subscriptions (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  platform           text NOT NULL CHECK (platform IN ('spx', 'stocks', 'funds')),
  tier               text NOT NULL DEFAULT 'radar' CHECK (tier IN ('radar', 'signal', 'edge', 'alpha')),
  status             text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'canceled', 'past_due')),
  current_period_end timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, platform)
);

CREATE INDEX IF NOT EXISTS platform_subscriptions_user_idx
  ON public.platform_subscriptions (user_id);

ALTER TABLE public.platform_subscriptions ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.platform_subscriptions TO service_role;
GRANT SELECT ON public.platform_subscriptions TO authenticated;

DROP POLICY IF EXISTS "read own platform subs" ON public.platform_subscriptions;
CREATE POLICY "read own platform subs" ON public.platform_subscriptions
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "service manages platform subs" ON public.platform_subscriptions;
CREATE POLICY "service manages platform subs" ON public.platform_subscriptions
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- حفظ وصول مستخدمي SPX الحاليين دون تغيير.
INSERT INTO public.platform_subscriptions (user_id, platform, tier)
SELECT
  id,
  'spx',
  CASE WHEN subscription_tier::text IN ('radar', 'signal', 'edge', 'alpha')
       THEN subscription_tier::text ELSE 'radar' END
FROM public.user_profiles
ON CONFLICT (user_id, platform) DO NOTHING;

-- كل حساب جديد يبدأ بتجربة سبعة أيام في المنصة التي اختارها عند التسجيل.
CREATE OR REPLACE FUNCTION public.create_initial_platform_subscription()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  selected_platform text;
BEGIN
  selected_platform := NEW.raw_user_meta_data->>'selected_platform';
  IF selected_platform NOT IN ('spx', 'stocks', 'funds') THEN
    selected_platform := 'spx';
  END IF;

  INSERT INTO public.platform_subscriptions (
    user_id, platform, tier, status, current_period_end
  )
  VALUES (
    NEW.id, selected_platform, 'edge', 'active', now() + interval '7 days'
  )
  ON CONFLICT (user_id, platform) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_platform_subscription ON auth.users;
CREATE TRIGGER on_auth_user_platform_subscription
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.create_initial_platform_subscription();

REVOKE EXECUTE ON FUNCTION public.create_initial_platform_subscription()
  FROM PUBLIC, anon, authenticated;

COMMIT;
