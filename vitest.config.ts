import { defineConfig } from 'vitest/config';

/**
 * Unit/rules tests live in `tests/`. Playwright specs live in `e2e/` and
 * must NOT be collected by vitest (they use @playwright/test). Scope the
 * include to `tests/` and exclude the Playwright directory explicitly.
 */
export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    exclude: ['e2e/**', 'node_modules/**', '.next/**', 'playwright-report/**', 'test-results/**'],
  },
});
