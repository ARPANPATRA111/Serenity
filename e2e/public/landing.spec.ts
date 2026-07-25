import { test, expect } from '@playwright/test';

/**
 * Public landing suite — runs against a local production build with
 * placeholder Firebase config. No backend is contacted.
 */

const FABRICATED_CLAIMS = [
  /trusted by (more than |over )?[\d,]+/i,
  /trusted by thousands/i,
  /loved by teams/i,
  /\b\d[\d,]*\+? (users|customers|organizations|organisations|teams|companies)\b/i,
  /\b\d(\.\d)? out of 5\b/i,
  /\b\d[\d,]* certificates (issued|generated|delivered)\b/i,
  /unlimited certificates/i,
  /\bworld['’]s (leading|best)\b/i,
];

test.describe('public landing', () => {
  test('hero states the product category and outcome', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Serenity Certificate Generator/i);

    const heading = page.getByRole('heading', { level: 1 });
    await expect(heading).toBeVisible();
    await expect(heading).toContainText(/certificates/i);

    // "Serenity" alone is not descriptive; the full product name must be present.
    await expect(page.getByText('Serenity Certificate Generator').first()).toBeVisible();
  });

  test('primary and secondary CTAs are present above the fold', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('link', { name: /create a free account/i }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: /see how it works/i }).first()).toBeVisible();
  });

  test('the whole workflow is described on the page', async ({ page }) => {
    await page.goto('/');
    const body = await page.locator('body').innerText();
    for (const term of ['Design', 'Import', 'Personalise', 'Generate', 'Deliver', 'Verify']) {
      expect(body).toContain(term);
    }
    expect(body).toMatch(/CSV/);
    expect(body).toMatch(/Excel/);
    expect(body).toMatch(/QR/i);
    expect(body).toMatch(/PDF/);
  });

  test('product evidence is real optimised imagery with alt text', async ({ page }) => {
    await page.goto('/');
    const shots = page.locator('figure.sr-shot img');
    expect(await shots.count()).toBeGreaterThanOrEqual(3);

    for (let index = 0; index < (await shots.count()); index += 1) {
      const image = shots.nth(index);
      const alt = await image.getAttribute('alt');
      expect(alt, 'every product screenshot needs descriptive alt text').toBeTruthy();
      expect((alt || '').length).toBeGreaterThan(30);
    }
  });

  test('FAQ answers core product questions', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: /frequently asked questions/i })).toBeVisible();
    await expect(page.getByText(/What is Serenity Certificate Generator\?/i)).toBeVisible();
    await expect(page.getByText(/import recipients from CSV or Excel/i).first()).toBeVisible();
  });

  test('pricing stays truthful about the free allowance and Pro', async ({ page }) => {
    await page.goto('/');
    const body = await page.locator('body').innerText();
    expect(body).toMatch(/5 persisted certificates/i);
    expect(body).toMatch(/no self-serve checkout|arranged through a request/i);
  });

  test('no fabricated social proof, ratings, or usage counts', async ({ page }) => {
    await page.goto('/');
    const body = await page.locator('body').innerText();
    for (const pattern of FABRICATED_CLAIMS) {
      expect(body, `landing must not claim: ${pattern}`).not.toMatch(pattern);
    }
  });

  test('events feature stays hidden while its flag is disabled', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('link', { name: /^Events$/ })).toHaveCount(0);
  });

  test('page exposes a skip link and the expected landmarks', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('link', { name: /skip to content/i })).toHaveCount(1);
    await expect(page.locator('header')).toHaveCount(1);
    await expect(page.locator('main#main')).toHaveCount(1);
    await expect(page.locator('footer')).toHaveCount(1);
    await expect(page.getByRole('navigation', { name: /primary/i })).toBeVisible();
  });

  test('desktop navigation reaches every landing section', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto('/');
    for (const target of ['#how-it-works', '#verification', '#templates', '#pricing', '#faq']) {
      await expect(page.locator(target)).toHaveCount(1);
    }
  });

  test('mobile navigation opens, links out, and closes', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');

    const toggle = page.getByRole('button', { name: /open menu/i });
    await expect(toggle).toBeVisible();
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');

    await toggle.click();
    await expect(page.getByRole('button', { name: /close menu/i })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    await expect(page.locator('#marketing-menu').getByRole('link', { name: /sign in/i })).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(page.locator('#marketing-menu')).toHaveCount(0);
  });

  for (const width of [360, 390, 430, 768, 1024, 1280, 1440]) {
    test(`no horizontal overflow at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/');
      await page.waitForTimeout(300);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow).toBeLessThanOrEqual(1);
    });
  }
});

test.describe('public landing — dark mode', () => {
  test.use({ colorScheme: 'dark' });

  test('renders in dark mode without overflow and keeps CTAs visible', async ({ page }) => {
    await page.addInitScript(() => window.localStorage.setItem('theme', 'dark'));
    await page.goto('/');
    await expect(page.locator('html')).toHaveClass(/dark/);
    await expect(page.getByRole('link', { name: /create a free account/i }).first()).toBeVisible();

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);
  });
});
