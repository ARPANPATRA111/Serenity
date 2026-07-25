# Phase 1 Staging Verification Runbook

This checkpoint is for staging only. Do not deploy to production, do not connect this worktree to production Firebase, and do not email real users.

## Current Local Gate

- Current branch: `phase-4-saas-readiness`.
- Latest commits include Phase 1 security hardening, Phase 2 performance hardening, Phase 3 reliability hardening, Phase 4 SaaS readiness docs, and the implementation checkpoint.
- `git status --short`: tracked worktree clean at the start of staging-prep verification, with ignored local/build files excluded.
- `pnpm lint`: passed on the current machine.
- `pnpm build`: passed on the current machine. Next.js reported `.env.local` was loaded, but no secret values were printed.
- Staging verification remains blocked until an operator provides a confirmed staging URL, staging Firebase project, User A/User B test accounts, safe test inbox, and staging/test email settings.

## Preflight

Run these locally before any staging test pass:

```powershell
git status --short
pnpm lint
pnpm build
pnpm run check:staging-env
```

If using a local staging-only env file, run:

```powershell
pnpm run check:staging-env -- --env-file .env.staging.local
```

Do not run the checker against `.env.local` unless an operator has explicitly confirmed that `.env.local` contains staging-only values.
Use `.env.staging.local.example` only as a placeholder reference; it must not contain real secrets.

## Required Operator Inputs

- Confirmed staging Vercel URL.
- Confirmed staging Firebase project ID.
- Confirmed staging Firebase Web app config.
- Confirmed staging Firebase Admin credentials in Vercel staging env only.
- Confirmed staging storage/blob configuration.
- Confirmed email provider test mode or safe single-recipient test setup.
- Safe test inbox.
- User A staging account.
- User B staging account.
- Decision on whether `ENABLE_BULK_EMAIL_API` remains unset/false or is temporarily enabled in staging for the enabled-path bulk ownership test.
  Default is disabled.

## User A Normal Flow

1. Open the confirmed staging URL.
2. Log in as User A.
3. Create a new template.
4. Save the template.
5. Upload media files:
   - PNG
   - JPG or JPEG
   - WebP
6. Import a small spreadsheet with at least `Name` and `Email` columns.
7. Generate certificates.
8. Confirm certificates save successfully.
9. Send one email only to the safe test inbox.
10. Open History.
11. Open the public verification page for one generated certificate.

Expected results:

- All normal User A flows work.
- Certificate records are owned by User A.
- The email send works only for User A's own certificate.
- The verification page renders.
- Verification UI/API does not expose recipient email, row metadata, owner/user ID, or template ID.

Record:

- User A template ID:
- User A certificate ID:
- User A media asset ID:
- Verification URL:
- Safe test inbox used:

## User B Cross-User Checks

Log in as User B and attempt these operations using User A IDs from the previous section:

- Fetch User A private template ID with `GET /api/templates/:id`.
- Update User A private template ID with `PUT /api/templates/:id`.
- Delete User A private template ID with `DELETE /api/templates/:id`.
- Fetch User B private template list and confirm User A private template is absent.
- Try User A media asset ID with `DELETE /api/media?assetId=<USER_A_MEDIA_ID>`.
- Try User A certificate ID in `POST /api/email/send`.
- Try User A certificate ID in `POST /api/email/bulk`.
- Try autosave/template save routes with mismatched `userId`, `id`, or `x-user-id` where the client exposes those parameters.

Expected results:

- Responses are `403`, `401`, or safe not-found behavior.
- No private User A data is returned to User B.
- No email is queued or sent.
- No cross-user records are modified.

## Unauthenticated API Checks

Call these without an `Authorization` header:

- `GET /api/users`
- `GET /api/templates`
- `GET /api/certificates`
- `GET /api/media`
- `POST /api/migrate-user`
- `POST /api/email/send`
- `POST /api/email/bulk`

Expected results:

- Each private endpoint returns `401`.
- No private user data is returned.
- No writes or sends occur.

## Public Route Checks

Without login:

- `GET /api/templates?public=true`
- `GET /api/verify/:id`

Expected for public templates:

- Route works without auth.
- Public template list does not expose owner identifiers.
- Public template list does not expose creator email.
- Public template list does not expose private `canvasJSON`.

Expected for verification:

- Route works without auth for an active certificate.
- Response does not include `recipientEmail`.
- Response does not include `metadata`.
- Response does not include original spreadsheet row data.
- Response does not include `ownerId` or `userId`.
- Response does not include `templateId`.

## Upload Checks

As User A:

- Upload PNG.
- Upload JPG/JPEG.
- Upload WebP.
- Attempt SVG.
- Attempt GIF.

Expected results:

- PNG, JPG/JPEG, and WebP are accepted.
- SVG and GIF return `400`.
- Existing SVG records are not deleted or migrated.

## Bulk Email Checks

Default staging env:

- Call `POST /api/email/bulk` with a valid authenticated User A request.

Expected result:

- Response is `501`.
- No Firestore queue/send/write happens.
- No email is sent.

If `ENABLE_BULK_EMAIL_API=true` is temporarily tested in staging:

- User B submits a bulk request containing User A's certificate ID.

Expected result:

- Response is `403`.
- Whole batch is rejected.
- Nothing is partially queued or sent.

Reset `ENABLE_BULK_EMAIL_API` to disabled after the test unless staging explicitly needs it enabled.

## Dashboard Public Templates

1. User A creates or owns a public template.
2. Ensure another user's public template exists.
3. User A opens the dashboard public templates tab.

Expected results:

- User A's own public template does not appear in the public tab.
- Other users' public templates still appear.
- Public API responses do not expose `userId`.

## Evidence to Capture

Capture only non-secret evidence:

- Endpoint, method, status code, and short response shape.
- Template/certificate/media IDs created for staging tests.
- Screenshots of UI pass/fail states if useful.
- Email provider test-mode evidence or safe-inbox receipt, with recipient limited to the safe test inbox.

Do not capture secret values, service account keys, full tokens, or real user email lists.

## Production Decision

Production deployment is not allowed until every section above passes in a confirmed staging environment.

Final staging verdict options:

- `PHASE 1 STAGING PASSED - PRODUCTION CANDIDATE`
- `PHASE 1 STAGING FAILED - FIX REQUIRED`
- `BLOCKED - ENVIRONMENT/ACCESS ISSUE`
