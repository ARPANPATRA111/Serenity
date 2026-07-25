# Serenity SaaS Readiness Roadmap

Status: planning groundwork only. This document does not approve production deployment.

## Current Production Gate

Production remains blocked until Phase 1 staging verification is completed against staging Firebase, staging Vercel environment variables, and test email settings. Do not deploy production from this branch.

## Current SaaS Surface

- Free generation enforcement exists in `/api/certificates` and `/api/users/premium`.
- Premium status is represented as `users/{uid}.isPremium`.
- Client-facing premium grants are blocked; premium grants require an admin-controlled workflow.
- The premium page currently presents payment-gateway maintenance and a manual contact path.
- Single email has a per-user daily limit through `DAILY_EMAIL_LIMIT`.
- Bulk email is default-off unless `ENABLE_BULK_EMAIL_API=true`.
- Account deletion is soft delete only.
- Public certificate verification is privacy-reduced and should not expose private spreadsheet metadata.

## Must Fix Before Paid Launch

1. Define the source of truth for plan limits.
   - Free certificate generation count.
   - Premium email allowance.
   - Bulk email availability.
   - Storage/media limits.
   - Public template publishing limits.

2. Reconcile marketing and enforcement.
   - The app currently enforces 5 free certificate generations.
   - Any landing/pricing copy that implies unlimited free generation must be corrected before production.

3. Build a real billing path.
   - Choose payment provider and webhook model.
   - Store provider customer/subscription IDs.
   - Verify webhook signatures.
   - Make plan changes server-authoritative.
   - Add refund/cancel/downgrade handling.

4. Build admin/support authorization.
   - Add admin role claims or a dedicated admin allowlist.
   - Require admin auth for premium grants and support actions.
   - Add audit logs for every admin mutation.

5. Add operational monitoring.
   - Error tracking for API routes.
   - Email provider delivery failures.
   - Firebase Admin initialization failures.
   - Abuse and rate-limit alerts.

6. Finish privacy operations.
   - Export my data.
   - Delete my data.
   - Retention schedule.
   - Support identity verification.

## Safe Rollout Order

1. Finish Phase 1 staging verification.
2. Fix marketing and pricing copy to match enforced limits.
3. Add admin role model and audit logging.
4. Add billing provider in staging only.
5. Add webhook-driven premium status updates.
6. Run paid-plan staging tests with test-mode payments only.
7. Add privacy/legal pages with reviewed copy.
8. Production deployment review.

## Explicit Non-Goals For This Phase

- No payment provider integration.
- No production billing claims.
- No admin dashboard with mutation actions.
- No destructive data export/delete implementation.
- No production migrations.
- No production Firebase access.
