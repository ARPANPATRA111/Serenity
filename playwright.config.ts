import { defineConfig, devices } from '@playwright/test';

/**
 * E2E configuration.
 *
 * - Public/SEO specs run against a LOCAL production build started with
 *   placeholder Firebase config (they never contact any backend).
 * - Auth / security / editor / generation specs are marked fixme and only
 *   run when `E2E_BASE_URL` points at a VERIFIED, isolated staging
 *   deployment (separate staging Firebase, safe inbox). They must never be
 *   pointed at production.
 */
const STAGING_BASE_URL = process.env.E2E_BASE_URL;
const PORT = 3210;
const baseURL = STAGING_BASE_URL || `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'off',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
  // Only boot a local server when testing locally (no external staging URL).
  webServer: STAGING_BASE_URL
    ? undefined
    : {
        command: `pnpm exec next start -p ${PORT}`,
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
        // Placeholder-only: the public suite never reaches Firebase/Blob/email.
        env: {
          FB_CREDENTIAL: 'placeholder',
          FB_AUTH_DOMAIN: 'placeholder.firebaseapp.com',
          FB_PROJECT: 'placeholder-project',
          FB_BUCKET: 'placeholder.appspot.com',
          FB_SENDER: '000000000000',
          FB_APP: '1:000000000000:web:placeholder',
          NEXT_PUBLIC_SITE_URL: baseURL,
          NEXT_PUBLIC_EVENTS_ENABLED: 'false',
          ENABLE_BULK_EMAIL_API: 'false',
        },
      },
});
