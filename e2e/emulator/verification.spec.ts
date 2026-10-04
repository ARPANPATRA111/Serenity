import { expect, test } from '@playwright/test';
import { REAL_BROWSER_UA, admin } from './helpers';

/**
 * Verification must keep working for every certificate ever issued, through
 * every way a link reaches a verifier. The legacy records used here are
 * shaped exactly as the deployed release stored them (see the seed script).
 */

test.describe('verification pages', () => {
  test('a legacy certificate verifies from server-rendered HTML, without JavaScript', async ({ request }) => {
    const response = await request.get('/verify/LegacyMain01');
    expect(response.status()).toBe(200);
    const html = await response.text();
    expect(html).toContain('Verified certificate');
    expect(html).toContain('Legacy Recipient');
    expect(html).toContain('Legacy Organization');
    // Link previews (LinkedIn, WhatsApp) get a real title; search engines are kept out.
    expect(html).toMatch(/property="og:title" content="Certificate of Completion — Legacy Recipient"/);
    expect(html).toMatch(/name="robots" content="noindex, follow"/);
  });

  test('the page is complete with JavaScript disabled', async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    await page.goto('/verify/LegacyMain01');
    await expect(page.getByTestId('verification-status')).toHaveText(/Verified certificate/);
    await expect(page.getByTestId('recipient-name')).toHaveText('Legacy Recipient');
    await context.close();
  });

  test('a record without the isActive flag still verifies; an explicit revocation does not', async ({ page }) => {
    await page.goto('/verify/LegacyNoFlag1');
    await expect(page.getByTestId('recipient-name')).toHaveText('Record Without Active Flag');

    await page.goto('/verify/Revoked_Cert-01');
    await expect(page.getByRole('heading', { name: 'Certificate revoked' })).toBeVisible();
    await expect(page.getByTestId('verification-status')).toHaveCount(0);
  });

  test('an unknown ID explains what to check and is not indexed', async ({ page }) => {
    await page.goto('/verify/DoesNotExist99');
    await expect(page.getByRole('heading', { name: 'Certificate not found' })).toBeVisible();
    // Next emits the layout's robots tag alongside its not-found "noindex";
    // crawlers apply the most restrictive one.
    const robots = await page.locator('meta[name="robots"]').evaluateAll((tags) => tags.map((tag) => tag.getAttribute('content')));
    expect(robots.some((content) => content?.includes('noindex'))).toBe(true);
  });

  for (const damaged of [
    '/verify/LegacyMain01.',
    '/verify/LegacyMain01)',
    '/verify/%22LegacyMain01%22',
    '/verify/%E2%80%8BLegacyMain01',
    '/verify/LegacyMain01/extra',
    '/verify/LegacyMain01/',
    '//verify/LegacyMain01',
    '/verify/LegacyMain01?utm_source=linkedin&utm_medium=social',
  ]) {
    test(`a link damaged in transit still verifies: ${damaged}`, async ({ page, baseURL }) => {
      // Absolute form, so "//verify/..." is a path rather than a protocol-relative host.
      await page.goto(`${baseURL}${damaged}`);
      await expect(page).toHaveURL(/\/verify\/LegacyMain01(\?.*)?$/);
      await expect(page.getByTestId('recipient-name')).toHaveText('Legacy Recipient');
    });
  }

  test('the verify search box accepts pasted links and text', async ({ page }) => {
    await page.goto('/verify');
    const input = page.getByLabel('Certificate ID or verification URL');

    await input.fill('not a certificate');
    await page.getByRole('button', { name: /verify certificate/i }).click();
    await expect(page.locator('#verify-input-error')).toContainText('does not look like a certificate ID');

    await input.fill('Certificate ID: https://serenity-three-kappa.vercel.app//verify/LegacyMain01.');
    await page.getByRole('button', { name: /verify certificate/i }).click();
    await expect(page).toHaveURL(/\/verify\/LegacyMain01$/);
    await expect(page.getByTestId('recipient-name')).toHaveText('Legacy Recipient');
  });
});

test.describe('verification API contract', () => {
  test('keeps the status codes and response shape of earlier releases', async ({ request }) => {
    const valid = await request.get('/api/verify/LegacyMain01', { headers: { 'User-Agent': REAL_BROWSER_UA } });
    expect(valid.status()).toBe(200);
    const body = await valid.json();
    expect(body).toMatchObject({
      success: true,
      isValid: true,
      certificate: {
        id: 'LegacyMain01',
        certificateId: 'LegacyMain01',
        recipientName: 'Legacy Recipient',
        issuerName: 'Legacy Organization',
        status: 'active',
      },
    });
    expect(typeof body.isNewView).toBe('boolean');
    expect(Date.parse(body.certificate.issuedAt)).not.toBeNaN();
    expect(body.certificate).not.toHaveProperty('recipientEmail');
    expect(body.certificate).not.toHaveProperty('userId');

    const revoked = await request.get('/api/verify/Revoked_Cert-01');
    expect(revoked.status()).toBe(410);
    expect(await revoked.json()).toMatchObject({ success: false, isValid: false, error: 'Certificate has been revoked' });

    const missing = await request.get('/api/verify/DoesNotExist99');
    expect(missing.status()).toBe(404);
    expect(await missing.json()).toMatchObject({ success: false, isValid: false, error: 'Certificate not found' });

    const invalid = await request.get('/api/verify/ab');
    expect(invalid.status()).toBe(400);
  });
});

test.describe('verification views', () => {
  test('a real visit counts once per viewer per day; crawlers never count', async ({ browser }) => {
    const { db } = admin();
    // A fresh record per run: visitor markers persist in the emulator between runs.
    const id = `ViewTest${Date.now().toString(36)}`;
    const reference = db.collection('certificates').doc(id);
    await reference.set({
      id,
      userId: 'user-a',
      recipientName: 'View Counter',
      title: 'Course Completion',
      issuerName: 'Demo Organization',
      issuedAt: Date.now(),
      createdAt: new Date().toISOString(),
      isActive: true,
      viewCount: 0,
    });
    const before = 0;

    // A link-preview crawler fetch does not count.
    const crawler = await browser.newContext({ userAgent: 'LinkedInBot/1.0 (compatible; Mozilla/5.0; Apache-HttpClient)' });
    await (await crawler.newPage()).goto(`/verify/${id}`);
    await crawler.close();

    const visitor = await browser.newContext({ userAgent: REAL_BROWSER_UA });
    const page = await visitor.newPage();
    await page.goto(`/verify/${id}`);
    await expect(page.getByTestId('verification-status')).toBeVisible();
    await expect.poll(async () => (await reference.get()).get('viewCount'), { timeout: 15_000 }).toBe(before + 1);

    // Same viewer again later the same day (a fresh session) is a repeat.
    const repeat = await browser.newContext({ userAgent: REAL_BROWSER_UA });
    const repeatPage = await repeat.newPage();
    const beacon = repeatPage.waitForResponse((response) => response.url().includes(`/api/verify/${id}/view`));
    await repeatPage.goto(`/verify/${id}`);
    expect(await (await beacon).json()).toMatchObject({ outcome: 'repeat' });
    expect((await reference.get()).get('viewCount')).toBe(before + 1);

    await visitor.close();
    await repeat.close();
  });
});
