import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/**
 * Automated accessibility scan of the public surfaces.
 *
 * Runs axe-core against the landing page, login, and signup at a desktop and a
 * phone width in both themes, from a local production build with placeholder
 * Firebase config.
 *
 * Scope note: axe catches roughly a third of WCAG issues. Passing here is a
 * regression guard, NOT a conformance claim — colour meaning, focus order,
 * copy clarity, and assistive-technology behaviour still need a human pass.
 */

const WCAG = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

const surfaces = [
  { name: 'landing', path: '/' },
  { name: 'login', path: '/login' },
  { name: 'signup', path: '/signup' },
];

const viewports = [
  { name: 'desktop', width: 1440, height: 1000 },
  { name: 'mobile', width: 390, height: 844 },
];

for (const theme of ['light', 'dark'] as const) {
  test.describe(`axe — ${theme} mode`, () => {
    test.use({ colorScheme: theme });

    for (const surface of surfaces) {
      for (const viewport of viewports) {
        test(`${surface.name} has no ${theme} violations at ${viewport.name}`, async ({ page }) => {
          await page.addInitScript((value) => {
            window.localStorage.setItem('theme', value);
          }, theme);
          await page.setViewportSize({ width: viewport.width, height: viewport.height });
          await page.goto(surface.path);

          // The auth shell renders a session-restoring card until Firebase
          // resolves; scan the real form, not the placeholder.
          if (surface.path !== '/') {
            await page.locator('form').waitFor({ state: 'visible' });
          }

          const results = await new AxeBuilder({ page }).withTags(WCAG).analyze();

          const summary = results.violations.map(
            (violation) =>
              `${violation.id} (${violation.impact}) x${violation.nodes.length}: ${violation.help}\n` +
              violation.nodes.map((node) => `    ${node.target.join(' ')}`).join('\n'),
          );

          expect(summary, summary.join('\n')).toEqual([]);
        });
      }
    }
  });
}

test('the open mobile menu is still accessible', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByRole('button', { name: /open menu/i }).click();
  await expect(page.locator('#marketing-menu')).toBeVisible();

  const results = await new AxeBuilder({ page }).withTags(WCAG).analyze();
  const summary = results.violations.map((violation) => `${violation.id}: ${violation.help}`);
  expect(summary, summary.join('\n')).toEqual([]);
});
