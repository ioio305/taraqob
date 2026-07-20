-- Apply only after the deployment containing /api/invite/validate is live.

BEGIN;

DROP POLICY IF EXISTS "invitations_read_by_token" ON public.invitations;
REVOKE SELECT ON TABLE public.invitations FROM anon;

COMMIT;
