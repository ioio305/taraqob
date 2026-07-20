-- Security hardening for the live v2 schema.
-- Review in a non-production project first, then apply as one transaction.

BEGIN;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  requested_token text;
  matched_invitation_id uuid;
  matched_role public.user_role;
  safe_role public.user_role := 'user'::public.user_role;
BEGIN
  requested_token := NEW.raw_user_meta_data->>'invitation_token';

  IF requested_token IS NOT NULL THEN
    SELECT i.id, i.role
      INTO matched_invitation_id, matched_role
      FROM public.invitations AS i
     WHERE i.token = requested_token
       AND lower(i.email) = lower(NEW.email)
       AND i.used_at IS NULL
       AND i.expires_at > now()
     LIMIT 1;

    IF matched_invitation_id IS NOT NULL THEN
      safe_role := matched_role;
    END IF;
  ELSE
    -- Transitional support for the currently deployed invitation page.
    -- The email is still verified against an active server-side invitation.
    SELECT i.id, i.role
      INTO matched_invitation_id, matched_role
      FROM public.invitations AS i
     WHERE lower(i.email) = lower(NEW.email)
       AND i.used_at IS NULL
       AND i.expires_at > now()
     ORDER BY i.created_at DESC
     LIMIT 1;

    IF matched_invitation_id IS NOT NULL THEN
      safe_role := matched_role;
    END IF;
  END IF;

  INSERT INTO public.user_profiles (
    id, email, full_name, role, is_active, subscription_tier
  )
  VALUES (
    NEW.id,
    NEW.email,
    coalesce(NEW.raw_user_meta_data->>'full_name', ''),
    safe_role,
    true,
    'radar'
  )
  ON CONFLICT (id) DO NOTHING;

  IF matched_invitation_id IS NOT NULL THEN
    UPDATE public.invitations
       SET used_at = now()
     WHERE id = matched_invitation_id;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS public.user_role
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT role FROM public.user_profiles WHERE id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT public.get_my_role() IN ('admin', 'moderator')
$$;

ALTER FUNCTION public.update_updated_at_column() SET search_path = '';

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_my_role() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_staff() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_role() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_staff() TO authenticated, service_role;

-- RLS limits the row. Column grants limit what its owner may change.
REVOKE UPDATE ON TABLE public.user_profiles FROM authenticated;
GRANT UPDATE (full_name, full_name_ar, avatar_url, last_seen_at)
  ON TABLE public.user_profiles TO authenticated;

DROP POLICY IF EXISTS "user_profiles_update_own" ON public.user_profiles;
CREATE POLICY "user_profiles_update_own"
  ON public.user_profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

COMMIT;
