import { test, expect } from '@playwright/test';

/**
 * Public landing suite — runs against a local production build with
 * placeholder Firebase config. No backend is contacted, so the template
 * gallery renders its curated fallback rather than live Firestore rows.
 * Assertions are therefore structural, never tied to a specific template name.
 */

const FABRICATED_CLAIMS = [
  /trusted by (more than |over )?[\d,]+/i,
  /trusted by thousands/i,
  /loved by teams/i,
  /\b\d[\d,]*\+? (users|customers|organizations|organisations|teams|companies)\b/i,
  /\b\d(\.\d)? out of 5\b/i,
  /\b\d[\d,]* certificates (issued|generated|delivered)\b/i,
  /unlimited certificates/i,
  /\b\d{2,}(\.\d+)?% uptime\b/i,
  /\bworld['’]s (leading|best)\b/i,
];

test.describe('public landing', () => {
  test('hero states the product category and outcome', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Serenity Certificate Generator/i);

    const heading = page.getByRole('heading', { level: 1 });
    await expect(heading).toBeVisible();
    await expect(heading).toContainText(/certificates/i);

    // "Serenity" alone is not descriptive; the full product name must be
    // present. The nav swaps the lockup for the mark alone below `sm`, so this
    // has to find a *visible* instance rather than the first in the DOM.
    await expect(
      page.getByText(/Serenity\s+Certificate Generator/).locator('visible=true').first(),
    ).toBeVisible();
  });

  test('primary and secondary CTAs are present above the fold', async ({ page }) => {
    await page.goto('/');
    await expect(
      page.getByRole('link', { name: /^create certificates$/i }).first(),
    ).toBeVisible();
    await expect(page.getByRole('link', { name: /explore templates/i }).first()).toBeVisible();
  });

  test('the whole workflow is described on the page', async ({ page }) => {
    await page.goto('/');
    const body = await page.locator('body').innerText();
    for (const term of ['Design', 'Import', 'Map', 'Generate', 'Deliver', 'Verify']) {
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

  test('template gallery renders server-side cards with previews', async ({ page }) => {
    await page.goto('/');
    const cards = page.locator('#templates li.sr-tpl');
    expect(await cards.count()).toBeGreaterThanOrEqual(3);

    // Every preview must carry alt text and resolve to an inline or https source.
    const previews = page.locator('#templates li.sr-tpl img');
    for (let index = 0; index < (await previews.count()); index += 1) {
      const source = await previews.nth(index).getAttribute('src');
      expect(source).toMatch(/^(data:image\/|https:\/\/)/);
      expect(await previews.nth(index).getAttribute('alt')).toBeTruthy();
    }
  });

  test('template gallery never leaks author identity', async ({ page }) => {
    await page.goto('/');
    const gallery = await page.locator('#templates').innerText();
    expect(gallery).not.toMatch(/@[a-z0-9.-]+\.[a-z]{2,}/i);
    expect(gallery).not.toMatch(/\bby\s+[A-Z][a-z]+\s+[A-Z][a-z]+/);
  });

  test('template filter narrows the grid without a reload', async ({ page }) => {
    await page.goto('/');
    const group = page.getByRole('group', { name: /filter templates/i });
    if ((await group.count()) === 0) test.skip();

    const cards = page.locator('#templates li.sr-tpl');
    const total = await cards.count();

    const firstCategory = group.getByRole('button').nth(1);
    await firstCategory.click();
    await expect(firstCategory).toHaveAttribute('aria-pressed', 'true');
    expect(await cards.count()).toBeLessThanOrEqual(total);

    await group.getByRole('button', { name: /^all$/i }).click();
    expect(await cards.count()).toBe(total);
  });

  test('FAQ uses native disclosure semantics and answers core questions', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: /common questions/i })).toBeVisible();

    const items = page.locator('#faq details.sr-acc');
    expect(await items.count()).toBeGreaterThanOrEqual(5);
    await expect(page.getByText(/What is Serenity Certificate Generator\?/i)).toBeVisible();

    // Answers ship in the HTML whether open or not, so they stay crawlable.
    // A closed <details> renders no text, so this reads textContent rather
    // than innerText.
    const closed = items.nth(2);
    expect(await closed.getAttribute('open')).toBeNull();
    const markup = await closed.evaluate((element) => element.textContent || '');
    expect(markup.length).toBeGreaterThan(80);
  });

  test('pricing stays truthful about the free allowance and Pro', async ({ page }) => {
    await page.goto('/');
    const body = await page.locator('body').innerText();
    expect(body).toMatch(/5 persisted certificates/i);
    expect(body).toMatch(/\$0/);
    expect(body).toMatch(/\$20/);
    expect(body).toMatch(/no self-serve checkout|arranged through a request/i);
    // The source design ships a "TBD" pro tier; ours must state the real price.
    expect(body).not.toMatch(/\bTBD\b/);
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
    for (const target of ['#how-it-works', '#product', '#verification', '#templates', '#pricing', '#faq']) {
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
    await expect(page.locator('#marketing-menu').getByRole('link', { name: /log in/i })).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(page.locator('#marketing-menu')).toHaveCount(0);
  });

  // The bar once squeezed the CTA until its label broke onto two lines, and a
  // longer label later clipped the menu button off the row entirely.
  for (const width of [360, 390, 430]) {
    test(`header CTA and menu button both fit at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 844 });
      await page.goto('/');

      const cta = page.locator('header').getByRole('link', { name: /create certificates/i });
      await expect(cta).toBeVisible();

      const box = await cta.evaluate((element) => ({
        width: element.getBoundingClientRect().width,
        right: element.getBoundingClientRect().right,
        overflow: element.scrollWidth - element.clientWidth,
      }));
      expect(box.overflow, 'the CTA label must fit its button').toBeLessThanOrEqual(1);

      // The menu control sits after the CTA; if the row overflows it is the
      // first thing pushed out of view.
      const menu = page.getByRole('button', { name: /open menu/i });
      await expect(menu).toBeInViewport();
      const menuBox = await menu.boundingBox();
      expect(menuBox!.x + menuBox!.width).toBeLessThanOrEqual(width);
    });
  }

  // `.sr-btn`'s inline padding used to beat Tailwind's `px-0`, collapsing the
  // icon's content box to zero width — an empty outline where the menu is.
  test('the mobile menu button renders a visible icon', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');

    const icon = page.getByRole('button', { name: /open menu/i }).locator('svg');

    // A single boundingBox() call reports null while the client component is
    // still hydrating, which reads as a collapsed icon. Poll so the assertion
    // measures settled layout instead of racing it.
    await expect
      .poll(async () => (await icon.boundingBox())?.width ?? 0, {
        message: 'the menu icon must not collapse',
      })
      .toBeGreaterThan(12);

    await expect.poll(async () => (await icon.boundingBox())?.height ?? 0).toBeGreaterThan(12);
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
    await expect(
      page.getByRole('link', { name: /^create certificates$/i }).first(),
    ).toBeVisible();

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);
  });

  test('the inverted bands actually change with the theme', async ({ page }) => {
    await page.addInitScript(() => window.localStorage.setItem('theme', 'dark'));
    await page.goto('/');

    // The source design has no dark mode; ours must not leave the deep bands
    // identical in both themes, which would read as unthemed sections.
    const deep = await page
      .locator('#templates')
      .evaluate((element) => getComputedStyle(element).backgroundColor);
    expect(deep).not.toBe('rgb(11, 24, 41)');
  });
});
