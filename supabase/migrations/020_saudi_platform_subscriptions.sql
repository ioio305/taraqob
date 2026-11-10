-- 020 — السماح بمنصة السوق السعودي في الاشتراكات + تجربة التسجيل لها
-- قبل هذا الترحيل كان قيد platform يرفض 'saudi' (فيفشل تفعيل اشتراكات السوق السعودي
-- عبر الدفع)، وكانت تجربة التسجيل تُفرض دائماً على 'spx'.

BEGIN;

ALTER TABLE public.platform_subscriptions
  DROP CONSTRAINT IF EXISTS platform_subscriptions_platform_check;

ALTER TABLE public.platform_subscriptions
  ADD CONSTRAINT platform_subscriptions_platform_check
  CHECK (platform IN ('spx', 'stocks', 'funds', 'saudi'));

-- كل حساب جديد يبدأ بتجربة سبعة أيام في منصة السوق الذي اختاره عند التسجيل.
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
  IF selected_platform IS NULL OR selected_platform NOT IN ('spx', 'stocks', 'funds', 'saudi') THEN
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

REVOKE EXECUTE ON FUNCTION public.create_initial_platform_subscription()
  FROM PUBLIC, anon, authenticated;

COMMIT;
