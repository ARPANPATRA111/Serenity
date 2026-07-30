import { test } from '@playwright/test';

/**
 * Cross-tenant security — STAGING ONLY.
 *
 * Requires two synthetic staging accounts (User A / User B) and a verified
 * staging Firebase via E2E_BASE_URL. Marked `fixme` so they never run
 * against production. The isolation guarantees they assert are already
 * covered at the rules layer by the emulator suite (`pnpm test:rules`);
 * these add end-to-end HTTP coverage once staging exists.
 */
test.describe('cross-user security (staging only)', () => {
  test.fixme('missing token returns 401 on private APIs', async () => {});
  test.fixme('invalid token returns 401', async () => {});
  test.fixme('mismatched client identity returns 403', async () => {});
  test.fixme('User A cannot read User B template / certificate / media', async () => {});
  test.fixme('User A cannot modify User B autosave', async () => {});
  test.fixme('user cannot self-grant premium or alter usage counters', async () => {});
  test.fixme('anonymous certificate enumeration is denied', async () => {});
  test.fixme('public verification returns name only (no email/userId/templateId/metadata)', async () => {});
  test.fixme('SVG/SVGZ/GIF and spoofed-MIME uploads are rejected', async () => {});
  test.fixme('single-email send for another user\'s certificate is denied', async () => {});
  test.fixme('bulk email is disabled by default (501/safe)', async () => {});
  test.fixme('migration route remains disabled', async () => {});
});
