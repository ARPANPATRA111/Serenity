import path from 'node:path';
import { defineConfig } from 'vitest/config';

/**
 * Unit/rules tests live in `tests/`. Playwright specs live in `e2e/` and
 * must NOT be collected by vitest (they use @playwright/test). Scope the
 * include to `tests/` and exclude the Playwright directory explicitly.
 */
export default defineConfig({
  resolve: {
    // Mirror the `@/*` path alias from tsconfig.json.
    alias: { '@': path.resolve(__dirname, 'src') },
  },
  test: {
    include: ['tests/**/*.test.ts'],
    exclude: ['e2e/**', 'node_modules/**', '.next/**', 'playwright-report/**', 'test-results/**'],
  },
});
