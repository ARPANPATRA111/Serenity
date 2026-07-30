# Serenity Admin And Support Plan

Status: planning groundwork only.

## Current State

- There is no dedicated admin role model.
- `/api/users/premium` rejects client-facing premium grants.
- `/api/migrate-user` is intentionally blocked and points to an admin/support-controlled workflow.
- User settings allow profile-name updates only.
- Account deletion marks the user as deleted but does not remove all related data.

## Required Admin Capabilities

1. User lookup
   - Search by Firebase UID and email.
   - Show plan status, generation count, email usage, and account status.
   - Never expose spreadsheet metadata or certificate private fields unless needed for a specific support case.

2. Premium grants
   - Grant, revoke, and expire premium access.
   - Require admin role authorization.
   - Require reason text.
   - Write audit log entries.

3. Support recovery
   - Restore soft-deleted accounts after identity verification.
   - Re-send verification or password reset through Firebase-supported flows.
   - Diagnose failed certificate save/email states without sending new emails automatically.

4. Data requests
   - Export user-owned templates, certificates, and media references.
   - Delete or anonymize user-owned data after confirmation.
   - Preserve audit logs according to retention policy.

## Admin Authorization Requirements

- Use Firebase custom claims or a server-side admin allowlist.
- Never rely on client-supplied `userId` for admin authority.
- Require fresh authentication for sensitive admin operations.
- Log admin UID, target UID, action, timestamp, and reason.
- Keep admin APIs out of public navigation until authorization is complete.

## Audit Log Shape

Recommended collection: `adminAuditLogs`

Fields:

- `adminUid`
- `targetUid`
- `action`
- `reason`
- `createdAt`
- `requestId`
- `metadata`

Do not store secrets, full ID tokens, or raw private keys in audit logs.

## Support Runbook

1. Confirm the request is for staging or production.
2. Verify identity before account or data changes.
3. Read-only inspection first.
4. Perform the smallest necessary mutation.
5. Record the reason and outcome.
6. Ask the user to confirm resolution.

## Production Blockers

- No admin role enforcement exists yet.
- No admin audit log exists yet.
- No reviewed support identity-proofing process exists yet.
- No operator runbook exists for paid plan disputes, refunds, or account deletion.
