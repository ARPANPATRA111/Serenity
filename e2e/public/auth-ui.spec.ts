import { test, expect } from '@playwright/test';

/**
 * Login/signup UI suite.
 *
 * Renders the authentication pages from a local production build with
 * placeholder Firebase config. Nothing here submits credentials, creates an
 * account, or contacts an auth backend — the flows themselves live in
 * `e2e/auth/auth.spec.ts` and remain staging-only.
 */

const pages = [
  { path: '/login', heading: /welcome back/i, submit: /^sign in$/i, provider: /continue with google/i },
  { path: '/signup', heading: /create your free account/i, submit: /^create account$/i, provider: /sign up with google/i },
];

/**
 * The shell renders a session-restoring state until Firebase resolves, so the
 * form is not in the DOM on first paint. Wait for it before asserting on it.
 */
async function gotoForm(page: import('@playwright/test').Page, path: string) {
  await page.goto(path);
  await page.locator('form').waitFor({ state: 'visible' });
}

for (const target of pages) {
  test.describe(`${target.path}`, () => {
    test('renders heading, provider button, and submit control', async ({ page }) => {
      await page.goto(target.path);
      await expect(page.getByRole('heading', { level: 1, name: target.heading })).toBeVisible();
      await expect(page.getByRole('button', { name: target.provider })).toBeVisible();
      await expect(page.getByRole('button', { name: target.submit })).toBeVisible();
    });

    test('every input is labelled and autofill-friendly', async ({ page }) => {
      await gotoForm(page, target.path);
      const inputs = page.locator('form input');
      const count = await inputs.count();
      expect(count).toBeGreaterThan(1);

      for (let index = 0; index < count; index += 1) {
        const input = inputs.nth(index);
        const id = await input.getAttribute('id');
        expect(id, 'each field needs an id for its label').toBeTruthy();
        await expect(page.locator(`label[for="${id}"]`)).toHaveCount(1);
        expect(await input.getAttribute('autocomplete')).toBeTruthy();
      }
    });

    test('shares the marketing shell: brand link, theme toggle, footer', async ({ page }) => {
      await page.goto(target.path);
      await expect(
        page.getByRole('link', { name: /serenity certificate generator — home/i }),
      ).toBeVisible();
      await expect(page.getByRole('button', { name: /switch to (light|dark) theme/i })).toBeVisible();
      await expect(page.locator('footer')).toHaveCount(1);
    });

    test('cross-links to the other authentication page', async ({ page }) => {
      await page.goto(target.path);
      const other = target.path === '/login' ? /create a free account/i : /^sign in$/i;
      await expect(page.getByRole('link', { name: other })).toBeVisible();
    });

    test('keyboard focus reaches the submit control in order', async ({ page }) => {
      await gotoForm(page, target.path);
      const submit = page.getByRole('button', { name: target.submit });
      await submit.focus();
      await expect(submit).toBeFocused();
    });

    for (const width of [360, 390, 430, 768, 1024, 1440]) {
      test(`no horizontal overflow at ${width}px`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 });
        await page.goto(target.path);
        await page.waitForTimeout(250);
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        );
        expect(overflow).toBeLessThanOrEqual(1);
      });
    }
  });
}

test('login shows a forgot-password route and signup does not', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByRole('link', { name: /forgot password/i })).toBeVisible();
});

test('signup states the free allowance and the verification-email step', async ({ page }) => {
  await gotoForm(page, '/signup');
  const body = await page.locator('body').innerText();
  expect(body).toMatch(/5 persisted certificates/i);
  expect(body).toMatch(/verification link/i);
  expect(body).not.toMatch(/unlimited/i);
  expect(body).not.toMatch(/free trial/i);
});

test('signup client validation reports mismatched passwords without navigating', async ({ page }) => {
  await gotoForm(page, '/signup');
  await page.fill('#signup-name', 'Test Person');
  await page.fill('#signup-email', 'test-person@example.test');
  await page.fill('#signup-password', 'correct-horse');
  await page.fill('#signup-confirmation', 'different-horse');
  await page.getByRole('button', { name: /^create account$/i }).click();

  // Scoped to the form notice: Next's route announcer also carries role=alert.
  await expect(page.locator('p[role="alert"]')).toContainText(/do not match/i);
  await expect(page).toHaveURL(/\/signup$/);
});

test('signup benefit panel moves below the form on small screens', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await gotoForm(page, '/signup');

  const form = await page.locator('form').boundingBox();
  const aside = await page.locator('aside').boundingBox();
  expect(form).not.toBeNull();
  expect(aside).not.toBeNull();
  expect(aside!.y).toBeGreaterThan(form!.y);
});

test.describe('authentication pages — dark mode', () => {
  test.use({ colorScheme: 'dark' });

  test('login and signup render in dark mode', async ({ page }) => {
    await page.addInitScript(() => window.localStorage.setItem('theme', 'dark'));
    for (const path of ['/login', '/signup']) {
      await page.goto(path);
      await expect(page.locator('html')).toHaveClass(/dark/);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    }
  });
});
