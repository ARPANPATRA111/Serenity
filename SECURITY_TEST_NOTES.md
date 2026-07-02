# Phase 1 Security Test Notes

These scenarios are intended for a staging Firebase/Vercel environment or Firebase emulator setup. Do not run them against production data.

## Verification Gate Commands

- 2026-07-02 recovery pass: `node_modules` was present, so dependency install was skipped.
- 2026-07-02 recovery pass: `pnpm lint` passed with no ESLint warnings or errors.
- 2026-07-02 recovery pass: `pnpm build` passed. Next reported that `.env.local` was loaded and emitted only the standard Browserslist staleness notice; no secret values were printed.
- 2026-07-02 recovery pass: no existing test script, test files, or test config were found, so no automated tests were run.
- 2026-07-02 recovery pass: `git diff --check` reported no whitespace errors, only existing LF-to-CRLF working-copy warnings.

## Auth Rejection

- Request `GET /api/users`, private `GET /api/templates`, `GET /api/certificates`, `GET /api/media`, `GET /api/autosave`, and `POST /api/migrate-user` without `Authorization: Bearer <Firebase ID token>`.
- Expected: each private route returns `401` and does not read or mutate user data.

## Mismatched User IDs

- Authenticate as User A and send User B's UID in query/body/header fields such as `userId`, `id`, or `x-user-id` to `/api/users`, `/api/users/premium`, `/api/templates`, `/api/certificates`, `/api/media`, and `/api/autosave`.
- Expected: routes return `403` or ignore the client ID while deriving ownership from User A's token; no User B data is returned or changed.

## Templates

- Create a private template as User B.
- Authenticate as User A and try to fetch, update, delete, and list/search User B's private template.
- Expected: direct private fetch/update/delete return `403` or `401`; private list/search returns only User A templates.
- Fetch public templates with `GET /api/templates?public=true`.
- Expected: route remains public, does not require a token, and does not include private owner email or `canvasJSON` in list responses.

## Certificates

- Create a certificate as User B.
- Authenticate as User A and try to list certificates, send email for User B's certificate, and POST a certificate payload using User B's UID or an existing User B certificate ID.
- Expected: User A only sees User A certificates; mismatched UID and cross-user overwrite attempts return `403`; email send returns `403`.

## Public Verification

- Fetch `GET /api/verify/:id` for a valid certificate.
- Expected: response includes only public-safe fields such as certificate ID, recipient name, title, issuer, issued date, status, view count, and public certificate image URL.
- Expected: response does not include `recipientEmail`, spreadsheet `metadata`, owner UID, template ID, or private template data.

## Media

- Authenticate as User A and upload PNG, JPEG/JPG, and WebP files to `/api/media`.
- Expected: uploads succeed and new asset records are owned by User A's token UID.
- Try uploading `image/svg+xml`, GIF files, spoofed `.svg`/`.svgz`/`.gif` filenames, and files whose first bytes contain obvious SVG/GIF signatures.
- Expected: route returns `400`; existing stored SVG assets are not deleted or migrated.
- Try deleting User B's media asset as User A.
- Expected: route returns `403`.

## Premium

- Authenticate as User A and call `POST /api/users/premium` with `{"action":"incrementCount","count":1}`.
- Expected: route increments only User A's generation count.
- Authenticate as User A and call `POST /api/users/premium` with a direct premium grant payload for any user.
- Expected: route returns `403`; premium grants require a separate admin-controlled workflow.

## Migration

- Authenticate as any normal user and call `POST /api/migrate-user` with arbitrary `oldUserId` and `newUserId`.
- Expected: route returns `403` and performs no reassignment.

## Email

- Authenticate as User A and send `/api/email/send` for a certificate owned by User A.
- Expected: send path can proceed in staging with provider calls mocked or disabled.
- Authenticate as User A and send for a certificate owned by User B.
- Expected: route returns `403` before rate-limit increment, provider send, email log write, or certificate status update.
- Send a payload with `certificatePdfBase64.length > 8_000_000`.
- Expected: route returns `413` and does not call the email provider.
- Request `POST /api/email/bulk` without a token, with a mismatched `userId`, or with a client-claimed paid tier while the authenticated user is free.
- Expected: missing token returns `401`, mismatched user ID returns `403`, and the tier decision is derived from the authenticated user record.
- With `ENABLE_BULK_EMAIL_API` unset or not equal to `true`, authenticate as User A and call `/api/email/bulk` with valid-looking payload data.
- Expected: route returns `501` and queues or sends nothing.
- In a staging/emulator environment with `ENABLE_BULK_EMAIL_API=true`, authenticate as User A and include User B's `certificateId` in a `/api/email/bulk` request.
- Expected: route returns `403` and queues or sends nothing for User B's certificate.
- In the enabled path, include a missing or blank `certificateId`.
- Expected: route returns `400` and queues or sends nothing.

## Leads

- POST `/api/leads/capture` with an unsupported `feature`, malformed email, or metadata larger than 2 KB.
- Expected: route returns `400`.
- POST with an allowlisted feature and valid optional email.
- Expected: route records the lead. Add IP/email rate limiting before broad public rollout.
