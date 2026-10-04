import path from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { CONSOLE_PATH, expectNoHorizontalOverflow, signIn, unlockConsole } from './helpers';

/**
 * Phone-width layout checks (Pixel 7 at 412px, then 360px, the narrowest
 * common Android width). A page fails if anything forces horizontal scroll.
 * Screenshots land in test-results/mobile for visual review.
 */

const WIDTHS = [412, 360];

async function settle(page: Page) {
  await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => undefined);
}

async function checkAtWidths(page: Page, label: string) {
  for (const width of WIDTHS) {
    await page.setViewportSize({ width, height: 800 });
    await settle(page);
    await expectNoHorizontalOverflow(page, `${label} @${width}px`);
    await page.screenshot({ path: path.join('test-results', 'mobile', `${label.replace(/[^a-z0-9]+/gi, '-')}-${width}.png`) });
  }
}

test.describe('phone layouts', () => {
  test('public pages', async ({ page }) => {
    for (const [route, label] of [
      ['/', 'home'],
      ['/verify', 'verify-search'],
      ['/verify/LegacyMain01', 'verify-valid'],
      ['/verify/Revoked_Cert-01', 'verify-revoked'],
      ['/verify/DoesNotExist99', 'verify-not-found'],
      ['/login', 'login'],
      ['/signup', 'signup'],
      ['/forgot-password', 'forgot-password'],
      ['/premium', 'premium'],
      [CONSOLE_PATH, 'console-lock-screen'],
    ] as const) {
      await page.goto(route);
      await checkAtWidths(page, label);
    }
  });

  test('verification page share sheet fits', async ({ page }) => {
    await page.goto('/verify/LegacyMain01');
    await page.getByRole('button', { name: 'Share award' }).click();
    await expect(page.getByRole('button', { name: 'Copy link' })).toBeVisible();
    await checkAtWidths(page, 'verify-share-sheet');
  });

  test('signed-in application pages', async ({ page }) => {
    await signIn(page, 'user-a@example.test');
    for (const [route, label] of [
      ['/dashboard', 'dashboard'],
      ['/history', 'history'],
      ['/my-templates', 'my-templates'],
      ['/templates', 'templates'],
      ['/settings', 'settings'],
      ['/editor', 'editor'],
    ] as const) {
      await page.goto(route);
      await checkAtWidths(page, label);
    }
  });

  test('operator console tabs and drawers', async ({ page }) => {
    await unlockConsole(page);
    await checkAtWidths(page, 'console-overview');
    for (const tab of ['Users', 'Certificates', 'Batches', 'Deliveries', 'Pro requests', 'Audit log']) {
      await page.getByRole('button', { name: tab, exact: true }).click();
      await checkAtWidths(page, `console-${tab}`);
    }
    await page.getByRole('button', { name: 'Users', exact: true }).click();
    await page.getByRole('button', { name: /User B/ }).click();
    await expect(page.getByRole('dialog', { name: 'User B' })).toBeVisible();
    await checkAtWidths(page, 'console-user-drawer');
  });
});
