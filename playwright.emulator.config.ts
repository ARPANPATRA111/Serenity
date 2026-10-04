import { defineConfig, devices } from '@playwright/test';

/**
 * Full-flow E2E suite against the local Firebase emulators (demo-serenity).
 *
 * Covers what the public suite cannot: sign-in, template loading, batch
 * generation, verification of generated and legacy certificates, email
 * delivery (local JSON outbox), and the operator console. Nothing here can
 * reach production: the app runs with scripts/lib/emulator-env.mjs, which
 * shadows every production secret, and all data lives in the emulators.
 *
 *   1. pnpm emulators                (separate terminal)
 *   2. pnpm build:emulator
 *   3. pnpm test:e2e:emulator        (starts `next start` if it is not running)
 */
const PORT = 3000;
const baseURL = `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: './e2e/emulator',
  // Tests share one emulator dataset, so they run in order on one worker.
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 180_000,
  expect: { timeout: 20_000 },
  reporter: [['list']],
  globalSetup: './e2e/emulator/global-setup.ts',
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    acceptDownloads: true,
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] }, testIgnore: /mobile\.spec\.ts/ },
    { name: 'mobile', use: { ...devices['Pixel 7'] }, testMatch: /mobile\.spec\.ts/ },
  ],
  webServer: {
    command: `node scripts/run-with-emulator-env.mjs start ${PORT}`,
    url: baseURL,
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
