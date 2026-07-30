# Serenity Rate Limiting And Abuse Plan

Status: planning groundwork only.

## Current Controls

- Single email sends are limited per user through `DAILY_EMAIL_LIMIT`.
- Bulk email is default-off through `ENABLE_BULK_EMAIL_API`.
- Lead capture contains a TODO for IP/email rate limiting.
- Media upload blocks unsupported SVG and GIF content.
- Certificate image upload has a thumbnail size limit.
- Private APIs require Firebase ID token authentication after Phase 1.

## Remaining Abuse Risks

| Risk | Current Gap | Priority |
| --- | --- | --- |
| Repeated login/signup abuse | Depends on Firebase settings | High |
| Certificate generation bursts | Free-tier count exists, but no per-minute throttle | High |
| Media upload storage abuse | File type checks exist, broader quota not complete | High |
| Email endpoint abuse | Daily user limit exists, no IP/device velocity limit | High |
| Lead capture spam | No rate limiter yet | Medium |
| Public verification scraping | View-count hashing exists, no global throttle | Medium |
| Public template scraping | Public API is filtered, no request-rate limit | Medium |

## Recommended Controls

1. Per-user API velocity limits
   - Certificates POST.
   - Media POST.
   - Email send.
   - Template save/update.

2. Per-IP public route limits
   - Verify API.
   - Public templates API.
   - Lead capture.

3. Quotas
   - Media count per user.
   - Media total storage per user.
   - Certificates per day for free users.
   - Emails per day for free and premium users.

4. Abuse telemetry
   - Log rejected rate-limit events.
   - Alert on spikes.
   - Track provider failures separately from user validation failures.

## Implementation Guidance

- Prefer a server-side store that is shared across serverless instances.
- Do not trust client-side throttling for enforcement.
- Keep limits configurable by environment variable.
- Staging should use lower limits for easier manual testing.
- Production rollout should start in report-only mode if the limiter supports it.

## Safe Defaults Before Production

- Keep `ENABLE_BULK_EMAIL_API` disabled by default.
- Set an explicit `DAILY_EMAIL_LIMIT`.
- Use staging-only email provider settings during verification.
- Block unsupported media formats at MIME, extension, and signature layers.

## Follow-Up Engineering Tasks

- Add shared rate-limit helper for authenticated routes.
- Add public route limiter for unauthenticated APIs.
- Add upload quota checks before blob writes.
- Add admin override workflow with audit logs.
- Add dashboard messaging for quota errors.
