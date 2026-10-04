import { test } from '@playwright/test';

/**
 * Authentication flows — STAGING ONLY.
 *
 * These require a verified, isolated staging deployment (separate staging
 * Firebase + safe inbox) reachable via E2E_BASE_URL. They are marked
 * `fixme` so they never run against production and never report a false
 * pass without a real staging target. Implement the bodies once staging
 * exists; do not point them at production.
 */
test.describe('auth (staging only)', () => {
  test.fixme('User A can sign up, verify email, and reach the dashboard', async () => {});
  test.fixme('User A can log in and log out', async () => {});
  test.fixme('forgot/reset password sends only to the safe inbox', async () => {});
  test.fixme('invalid credentials show an accessible error', async () => {});
  test.fixme('identity renders without blocking on profile/premium calls', async () => {});
  test.fixme('internal redirect allowlist rejects external redirect targets', async () => {});
});
