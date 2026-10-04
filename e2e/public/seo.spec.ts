import { test, expect } from '@playwright/test';

/**
 * Public SEO / crawlability suite — runs locally, no backend contacted.
 */
test.describe('public SEO', () => {
  test('robots.txt allows crawl and disallows private routes', async ({ request }) => {
    const res = await request.get('/robots.txt');
    expect(res.status()).toBe(200);
    const body = await res.text();
    expect(body).toContain('Disallow: /api/');
    expect(body).toContain('Disallow: /dashboard');
    expect(body).toContain('Sitemap:');
  });

  test('sitemap.xml lists public pages and excludes private/app routes', async ({ request }) => {
    const res = await request.get('/sitemap.xml');
    expect(res.status()).toBe(200);
    const body = await res.text();
    expect(body).toContain('<loc>');
    expect(body).not.toContain('/dashboard');
    expect(body).not.toContain('/editor');
    // recipient verification pages must not be enumerated
    expect(body).not.toMatch(/\/verify\/[A-Za-z0-9]/);
  });

  test('manifest and favicon are served', async ({ request }) => {
    expect((await request.get('/manifest.webmanifest')).status()).toBe(200);
    expect((await request.get('/icon.svg')).status()).toBe(200);
  });

  test('landing exposes JSON-LD structured data', async ({ page }) => {
    await page.goto('/');
    const scripts = page.locator('script[type="application/ld+json"]');
    expect(await scripts.count()).toBeGreaterThanOrEqual(3);
    const types = await scripts.evaluateAll((nodes) =>
      nodes.map((n) => {
        try {
          return JSON.parse(n.textContent || '{}')['@type'];
        } catch {
          return null;
        }
      }),
    );
    expect(types).toContain('SoftwareApplication');
    expect(types).toContain('FAQPage');
  });
});
