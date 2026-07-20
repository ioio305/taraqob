# Security rollout

These changes deliberately avoid the recommendation engines and market-data keys.

## Preflight

1. Create a database backup or logical export of `user_profiles`, `invitations`, `v2_signals`, and `v2_trades`.
2. Confirm `CRON_SECRET` exists in Production and Preview on Vercel.
3. Keep the current production deployment available for instant rollback.
4. Record one normal registration, one invitation, and representative analysis results before rollout.

## Order of operations

1. Run `007_security_hardening.sql` in a transaction.
2. Verify normal signup receives role `user` even if arbitrary role metadata is supplied.
3. Verify a valid staff invitation receives only the role stored in `invitations`.
4. Deploy the application branch to a Vercel Preview and test signup, login, invitation, admin access, and cron authorization.
5. Promote the tested deployment to Production.
6. Run `008_lock_invitation_reads.sql` after `/api/invite/validate` is live.
7. Run `009_private_staff_authorization.sql` and verify staff access still works.
8. Rerun Supabase Security Advisor and verify the exposed `SECURITY DEFINER` warnings are gone.

## Expected security behavior

- `/api/v2/signals/evaluate` returns `401` without the Vercel bearer secret.
- A browser user cannot update `role`, `subscription_tier`, `is_active`, or `preferences`.
- Invitation roles come from a valid, unused, unexpired database invitation.
- Anonymous clients cannot list the `invitations` table after migration 008.
- Staff authorization helpers are kept outside the exposed API schema after migration 009.

The remaining leaked-password warning requires a paid Supabase plan. Do not change the subscription without explicit approval.

Both database migrations are transactional. If a statement fails, PostgreSQL rolls that migration back automatically.
