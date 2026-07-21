-- Platform hardening that does not change recommendation, indicator, or chart logic.

BEGIN;

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS referral_days integer NOT NULL DEFAULT 0
  CHECK (referral_days BETWEEN 0 AND 365);

UPDATE public.user_profiles AS profile
SET referral_days = LEAST(365, GREATEST(
  profile.referral_days,
  CASE
    WHEN auth_user.raw_user_meta_data->>'referral_days' ~ '^[0-9]{1,3}$'
      THEN (auth_user.raw_user_meta_data->>'referral_days')::integer
    ELSE 0
  END
))
FROM auth.users AS auth_user
WHERE auth_user.id = profile.id;

CREATE TABLE IF NOT EXISTS public.referral_claims (
  referred_user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  referrer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  credited_at timestamptz NOT NULL DEFAULT now(),
  CHECK (referred_user_id <> referrer_id)
);

CREATE INDEX IF NOT EXISTS referral_claims_referrer_idx
  ON public.referral_claims (referrer_id, credited_at DESC);

ALTER TABLE public.referral_claims ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.referral_claims FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.claim_referral(p_referrer uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  referred_id uuid := auth.uid();
  joined_at timestamptz;
  new_days integer;
BEGIN
  IF referred_id IS NULL OR p_referrer IS NULL OR referred_id = p_referrer THEN
    RETURN jsonb_build_object('credited', false, 'reason', 'invalid');
  END IF;

  SELECT created_at INTO joined_at FROM auth.users WHERE id = referred_id;
  IF joined_at IS NULL OR joined_at < now() - interval '14 days' THEN
    RETURN jsonb_build_object('credited', false, 'reason', 'ineligible');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = p_referrer AND is_active IS DISTINCT FROM false
  ) THEN
    RETURN jsonb_build_object('credited', false, 'reason', 'missing');
  END IF;

  INSERT INTO public.referral_claims (referred_user_id, referrer_id)
  VALUES (referred_id, p_referrer)
  ON CONFLICT (referred_user_id) DO NOTHING;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('credited', false, 'reason', 'already');
  END IF;

  UPDATE public.user_profiles
  SET referral_days = LEAST(365, referral_days + 7)
  WHERE id = p_referrer
  RETURNING referral_days INTO new_days;

  RETURN jsonb_build_object('credited', true, 'days', new_days);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.claim_referral(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_referral(uuid) TO authenticated;

CREATE TABLE IF NOT EXISTS public.request_limits (
  bucket text PRIMARY KEY,
  window_started_at timestamptz NOT NULL DEFAULT now(),
  request_count integer NOT NULL DEFAULT 0 CHECK (request_count >= 0),
  expires_at timestamptz NOT NULL
);

ALTER TABLE public.request_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.request_limits FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.check_request_limit(
  p_bucket text,
  p_max integer,
  p_window_seconds integer
)
RETURNS TABLE (allowed boolean, remaining integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  current_count integer;
  now_value timestamptz := clock_timestamp();
BEGIN
  IF length(p_bucket) < 16 OR p_max < 1 OR p_window_seconds < 1 THEN
    RAISE EXCEPTION 'invalid rate limit arguments';
  END IF;

  INSERT INTO public.request_limits AS limits (
    bucket, window_started_at, request_count, expires_at
  )
  VALUES (
    p_bucket, now_value, 1, now_value + make_interval(secs => p_window_seconds)
  )
  ON CONFLICT (bucket) DO UPDATE
  SET request_count = CASE
        WHEN limits.expires_at <= now_value THEN 1
        ELSE limits.request_count + 1
      END,
      window_started_at = CASE
        WHEN limits.expires_at <= now_value THEN now_value
        ELSE limits.window_started_at
      END,
      expires_at = CASE
        WHEN limits.expires_at <= now_value THEN now_value + make_interval(secs => p_window_seconds)
        ELSE limits.expires_at
      END
  RETURNING request_count INTO current_count;

  IF random() < 0.01 THEN
    DELETE FROM public.request_limits WHERE expires_at < now_value - interval '1 day';
  END IF;

  RETURN QUERY SELECT current_count <= p_max, GREATEST(0, p_max - current_count);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.check_request_limit(text, integer, integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_request_limit(text, integer, integer)
  TO service_role;

CREATE TABLE IF NOT EXISTS public.stripe_webhook_events (
  event_id text PRIMARY KEY,
  event_type text NOT NULL,
  processed_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.stripe_webhook_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.stripe_webhook_events FROM PUBLIC, anon, authenticated;

COMMIT;
