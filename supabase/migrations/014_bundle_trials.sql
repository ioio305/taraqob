-- 014 — تجربة موحدة للباقات الجديدة: سبعة أيام ألفا على المنصات الثلاث

BEGIN;

CREATE OR REPLACE FUNCTION public.create_initial_platform_subscription()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  platform_name text;
BEGIN
  FOREACH platform_name IN ARRAY ARRAY['spx', 'stocks', 'funds']
  LOOP
    INSERT INTO public.platform_subscriptions (
      user_id, platform, tier, status, current_period_end
    )
    VALUES (
      NEW.id, platform_name, 'alpha', 'active', now() + interval '7 days'
    )
    ON CONFLICT (user_id, platform) DO NOTHING;
  END LOOP;

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
