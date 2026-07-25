# Serenity Staging Setup

This document describes the staging resources and operator steps needed to unblock Phase 1 security verification. Do not use production Firebase, production Vercel, or real recipient email lists for these tests.

## Required Staging Resources

- Staging Vercel URL.
- Separate staging Firebase project.
- Staging Firebase Web app config.
- Staging Firebase Admin credentials stored only in staging server environment variables.
- Staging storage/blob configuration.
- Staging email provider configured for test mode or a single safe recipient.
- Safe test inbox for the one single-email test.
- User A staging account.
- User B staging account.

## Environment Variables

Set values in the staging environment only. This table lists names and purpose only; never paste secret values into docs or chat.

| Variable | Classification |
| --- | --- |
| `FB_CREDENTIAL` | required for build |
| `FB_AUTH_DOMAIN` | required for build |
| `FB_PROJECT` | required for build |
| `FB_BUCKET` | required for build |
| `FB_SENDER` | required for build |
| `FB_APP` | required for build |
| `NEXT_PUBLIC_SITE_URL` | required for build |
| `FIREBASE_ADMIN_PROJECT_ID` | required for server runtime |
| `FIREBASE_ADMIN_CLIENT_EMAIL` | required for server runtime |
| `FIREBASE_ADMIN_PRIVATE_KEY` | required for server runtime |
| `BLOB_READ_WRITE_TOKEN` | required for server runtime |
| `DAILY_IP_SALT` | required for server runtime |
| `SEND_IN_BLUE_API_KEY` | required for email test |
| `BREVO_SENDER_EMAIL` | required for email test |
| `EMAIL_SENDER_NAME` | required for email test |
| `DAILY_EMAIL_LIMIT` | optional |
| `FREE_BULK_EMAIL_LIMIT` | optional |
| `ENABLE_BULK_EMAIL_API` | optional, default disabled |
| `RESEND_API_KEY` | optional legacy/alternate email setting |

Example placeholders are available in `.env.staging.local.example`. Copy it to `.env.staging.local` only when filling staging values locally. Never commit `.env.staging.local`.

Before staging tests, run:

```powershell
pnpm run check:staging-env
```

If using a staging-only local env file:

```powershell
pnpm run check:staging-env -- --env-file .env.staging.local
```

Do not use `.env.local` for staging verification unless an operator explicitly confirms that it contains staging-only values.

## Vercel Setup

### Option A: Vercel Dashboard Setup

1. Create or import a staging Vercel project, or configure a preview deployment for branch `phase-4-saas-readiness`.
2. Connect the GitHub branch `phase-4-saas-readiness`.
3. Add the environment variables above to the staging or preview environment only.
4. Confirm `NEXT_PUBLIC_SITE_URL` points to the staging URL.
5. Confirm no production domain is attached to this staging/preview deployment.
6. Confirm Firebase variables point to the staging Firebase project.
7. Confirm email variables are test-mode/safe-inbox only.
8. Keep `ENABLE_BULK_EMAIL_API=false` unless temporarily testing the enabled ownership path in staging.
9. Deploy only to staging or preview.
10. Do not deploy production.

### Option B: Vercel CLI Setup

Use this only if the Vercel CLI is already installed and the project is intentionally linked to a staging/preview target. Do not install the CLI as part of Phase 1.

1. Confirm the CLI target is staging/preview, not production.
2. Confirm the linked Vercel project is not production.
3. Pull or set staging/preview environment variables only.
4. Run the staging env checker.
5. Deploy only to preview/staging if an operator explicitly requests it.
6. Do not pass `--prod`.

## Firebase Setup

1. Create or select a separate Firebase project for staging.
2. Enable the Auth providers used by the app, such as email/password and any social providers intentionally used in staging.
3. Create User A staging account.
4. Create User B staging account.
5. Configure Firestore rules and indexes only for the staging project.
6. Configure storage only for staging.
7. Confirm staging Web app config uses the staging project.
8. Confirm Firebase Admin credentials use the staging project service account.
9. Confirm no production Firebase project IDs, auth domains, buckets, or service accounts are used.
10. Do not point the staging app at production Firebase.
11. Do not run migrations.

## Email Setup

1. Use test mode, sandbox mode, or one safe test inbox.
2. Send only one single-email test during Phase 1 staging verification.
3. Do not email real users.
4. Do not upload or import real user email lists.
5. Keep bulk email disabled by default with `ENABLE_BULK_EMAIL_API` unset or not equal to `true`.
6. If the enabled bulk path must be tested, enable it only in staging and disable it again after the ownership-check test.

## Rollback

Staging rollback options:

- Revert to the previous staging deployment from the Vercel dashboard.
- Redeploy the previous known-good staging commit.
- Remove or correct staging environment variables if the checker flags production-looking values.
- Disable `ENABLE_BULK_EMAIL_API` after any temporary enabled-path test.

Production must remain untouched throughout Phase 1 staging setup and verification.
