-- Allow the server-only backup worker to read the protected recovery set.

BEGIN;

DO $$
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'user_profiles',
    'invitations',
    'v2_signals',
    'notifications',
    'audit_logs',
    'v2_leads',
    'v2_trades',
    'referral_claims',
    'stripe_webhook_events'
  ]
  LOOP
    IF to_regclass(format('public.%I', table_name)) IS NOT NULL THEN
      EXECUTE format('GRANT SELECT ON TABLE public.%I TO service_role', table_name);
    END IF;
  END LOOP;
END;
$$;

GRANT INSERT, SELECT ON TABLE public.backup_runs TO service_role;

COMMIT;
