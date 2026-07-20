-- Move staff authorization helpers outside the exposed API schema.

BEGIN;

CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA private TO authenticated, service_role;

CREATE OR REPLACE FUNCTION private.is_staff()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT role IN ('admin', 'moderator')
  FROM public.user_profiles
  WHERE id = auth.uid()
$$;

REVOKE EXECUTE ON FUNCTION private.is_staff() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.is_staff() TO authenticated, service_role;

DROP POLICY IF EXISTS "invitations_staff_all" ON public.invitations;
CREATE POLICY "invitations_staff_all"
  ON public.invitations
  FOR ALL
  TO authenticated
  USING (private.is_staff())
  WITH CHECK (private.is_staff());

DROP POLICY IF EXISTS "staff insert notifications" ON public.notifications;
CREATE POLICY "staff insert notifications"
  ON public.notifications
  FOR INSERT
  TO authenticated
  WITH CHECK (private.is_staff());

DROP POLICY IF EXISTS "user_profiles_staff_read_all" ON public.user_profiles;
CREATE POLICY "user_profiles_staff_read_all"
  ON public.user_profiles
  FOR SELECT
  TO authenticated
  USING (private.is_staff());

DROP POLICY IF EXISTS "user_profiles_staff_update" ON public.user_profiles;
CREATE POLICY "user_profiles_staff_update"
  ON public.user_profiles
  FOR UPDATE
  TO authenticated
  USING (private.is_staff());

DROP POLICY IF EXISTS "staff_all_signals" ON public.v2_signals;
CREATE POLICY "staff_all_signals"
  ON public.v2_signals
  FOR ALL
  TO authenticated
  USING (private.is_staff())
  WITH CHECK (private.is_staff());

DROP FUNCTION IF EXISTS public.is_staff();
DROP FUNCTION IF EXISTS public.get_my_role();

COMMIT;
