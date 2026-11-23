import { expect, test, type Page } from '@playwright/test';
import { admin, ensureUser, idTokenFor, signIn } from './helpers';

/**
 * Work package 2: lists never wait for account totals, the totals are shared
 * between pages, every list reports failures with Retry instead of looking
 * empty, and large libraries load a bounded page at a time without losing
 * older records.
 */

const USER = { uid: 'perf-contract-user', email: 'perf-contract@example.test' };
const TEMPLATE_NAME = 'Twin Template';

async function resetAccount() {
  const { db } = admin();
  for (const collection of ['certificates', 'templates', 'generationBatches', 'user-media']) {
    const owned = await db.collection(collection).where('userId', '==', USER.uid).get();
    await Promise.all(owned.docs.map((document) => document.ref.delete()));
  }
  await ensureUser(USER.uid, USER.email, { isPremium: true });

  // Two runs of the same template on the same day: separate batches.
  const now = Date.now();
  const batch = db.batch();
  const records = [
    { id: 'PerfTwinA1', name: 'Perf Recipient A', batchId: 'perf-batch-one', offset: 3000 },
    { id: 'PerfTwinA2', name: 'Perf Recipient B', batchId: 'perf-batch-one', offset: 2000 },
    { id: 'PerfTwinB1', name: 'Perf Recipient C', batchId: 'perf-batch-two', offset: 1000 },
  ];
  for (const record of records) {
    const created = new Date(now - record.offset).toISOString();
    batch.set(db.collection('certificates').doc(record.id), {
      id: record.id, userId: USER.uid, recipientName: record.name, recipientEmail: `${record.id.toLowerCase()}@example.test`,
      title: 'Performance Contract', issuerName: 'Serenity QA', templateName: TEMPLATE_NAME, templateId: 'perf-template',
      issuedAt: created, createdAt: created, isActive: true, viewCount: 1, emailStatus: 'not_sent',
      generationBatchId: record.batchId, metadata: { Name: record.name, Notes: 'x'.repeat(2000) },
    });
  }
  await batch.commit();
}

/** Holds matching requests until `release` is called (or fails them). */
async function holdRequests(page: Page, pattern: string, mode: 'hold' | 'fail' = 'hold') {
  let release!: () => void;
  const released = new Promise<void>((resolve) => { release = resolve; });
  let count = 0;
  await page.route(pattern, async (route) => {
    count += 1;
    if (mode === 'fail') {
      await route.fulfill({ status: 503, contentType: 'application/json', body: '{"success":false,"error":"Simulated outage"}' });
      return;
    }
    await released;
    await route.continue();
  });
  return { release: () => release(), count: () => count };
}

const statCard = (page: Page, label: string) => page.locator('div').filter({ hasText: new RegExp(`^${label}`) }).first();

test.describe('performance contracts', () => {
  test.beforeEach(resetAccount);

  test('dashboard and History show their rows while account totals are still loading', async ({ page }) => {
    await signIn(page, USER.email);
    // signIn lands on the dashboard; let its own requests finish before counting.
    await page.waitForLoadState('networkidle');
    const stats = await holdRequests(page, '**/api/certificates/stats');

    await page.goto('/dashboard');
    await expect(page.getByText('Certificate for Perf Recipient A')).toBeVisible({ timeout: 15_000 });
    expect(stats.count()).toBe(1);
    stats.release();
    await expect(statCard(page, 'Certificates Generated')).toContainText('3');

    // History reuses the totals the dashboard just loaded: no second request.
    await page.getByRole('link', { name: /History/ }).first().click();
    await page.waitForURL(/\/history/);
    await expect(page.getByRole('heading', { name: TEMPLATE_NAME })).toHaveCount(2);
    expect(stats.count()).toBe(1);
  });

  test('a failed totals request leaves both lists working with counts from the loaded records', async ({ page }) => {
    await signIn(page, USER.email);
    await holdRequests(page, '**/api/certificates/stats', 'fail');

    await page.goto('/dashboard');
    await expect(page.getByText('Certificate for Perf Recipient C')).toBeVisible();
    await expect(statCard(page, 'Certificates Generated')).toContainText('3');

    await page.goto('/history');
    // Two runs on the same day of the same template are two groups.
    await expect(page.getByRole('heading', { name: TEMPLATE_NAME })).toHaveCount(2);
    const tile = page.locator('p', { hasText: /^Total Certificates$/ }).locator('..');
    await expect(tile).toContainText('3');
  });

  test('History requests the lite list without imported spreadsheet rows', async ({ page }) => {
    await signIn(page, USER.email);
    const listResponse = page.waitForResponse((response) => response.url().includes('/api/certificates?') && response.request().method() === 'GET');
    await page.goto('/history');
    const response = await listResponse;
    expect(response.url()).toContain('view=lite');
    const body = await response.json();
    expect(body.items).toHaveLength(3);
    expect(body).not.toHaveProperty('certificates');
    expect(body).not.toHaveProperty('stats');
    expect(JSON.stringify(body)).not.toContain('xxxxxxxxxx');
    expect(response.headers()['server-timing']).toMatch(/auth;dur=.*list;dur=/);
  });

  test('clients that predate the lite responses still get the earlier response shapes', async ({ request }) => {
    const token = await idTokenFor(USER.email);
    const headers = { Authorization: `Bearer ${token}` };

    const history = await (await request.get('/api/certificates?limit=50', { headers })).json();
    expect(history.items).toHaveLength(3);
    expect(history.certificates).toEqual(history.items);
    expect(history.stats).toMatchObject({ totalCertificates: 3 });
    expect(history.items[0]).toHaveProperty('recipientEmail');

    const summary = await (await request.get('/api/dashboard-summary?templateLimit=6&certificateLimit=12', { headers })).json();
    expect(summary.stats).toMatchObject({ totalCertificates: 3 });
    expect(summary.recentCertificates).toHaveLength(3);

    const templates = await (await request.get('/api/templates', { headers })).json();
    expect(templates).toMatchObject({ success: true });
    expect(templates).not.toHaveProperty('nextCursor');
  });

  test('failed lists say so and recover with Retry instead of looking empty', async ({ page }) => {
    await signIn(page, USER.email);

    const summary = await holdRequests(page, '**/api/dashboard-summary*', 'fail');
    await page.goto('/dashboard');
    await expect(page.getByRole('alert').filter({ hasText: 'could not be loaded' })).toBeVisible();
    await page.unroute('**/api/dashboard-summary*');
    await page.getByRole('button', { name: 'Retry' }).click();
    await expect(page.getByText('Certificate for Perf Recipient A')).toBeVisible();
    expect(summary.count()).toBeGreaterThan(0);

    await page.route('**/api/certificates?*', (route) => route.fulfill({ status: 503, contentType: 'application/json', body: '{"success":false,"error":"History is temporarily unavailable."}' }));
    await page.goto('/history');
    await expect(page.getByRole('alert').filter({ hasText: 'temporarily unavailable' })).toBeVisible();
    await expect(page.getByText('No Certificates Yet')).toHaveCount(0);
    await page.unroute('**/api/certificates?*');
    await page.getByRole('button', { name: 'Retry' }).click();
    await expect(page.getByRole('heading', { name: TEMPLATE_NAME })).toHaveCount(2);
  });

  test('My Templates loads a bounded page and still reaches every template, including undated ones', async ({ page }) => {
    const { db } = admin();
    const batch = db.batch();
    const now = Date.now();
    for (let index = 0; index < 30; index += 1) {
      const id = `perf-template-${String(index).padStart(2, '0')}`;
      const at = new Date(now - index * 60_000).toISOString();
      batch.set(db.collection('templates').doc(id), {
        id, userId: USER.uid, name: `Paged template ${String(index).padStart(2, '0')}`, normalizedName: id,
        canvasJSON: '{"objects":[]}', isPublic: false, createdAt: at, updatedAt: at, certificateCount: 0, stars: 0, tags: [],
        creatorEmail: 'private@example.test',
      });
    }
    // Saved by a release that wrote no updatedAt.
    batch.set(db.collection('templates').doc('perf-template-undated'), {
      id: 'perf-template-undated', userId: USER.uid, name: 'Undated legacy template', canvasJSON: '{"objects":[]}',
      isPublic: false, certificateCount: 0, stars: 0,
    });
    await batch.commit();

    await signIn(page, USER.email);
    const firstPage = page.waitForResponse((response) => response.url().includes('/api/templates?') && response.url().includes('page=1'));
    await page.goto('/my-templates');
    const body = await (await firstPage).json();
    expect(body.templates).toHaveLength(24);
    expect(JSON.stringify(body)).not.toContain('private@example.test');
    await expect(page.getByText('Paged template 00')).toBeVisible();
    await expect(page.getByText('Paged template 29')).toHaveCount(0);

    await page.getByRole('button', { name: 'Load more templates' }).click();
    await expect(page.getByText('Paged template 29')).toBeVisible();
    await expect(page.getByText('Undated legacy template')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Load more templates' })).toHaveCount(0);
  });

  test('the editor makes one media request and offers Retry when it fails', async ({ page }) => {
    await signIn(page, USER.email);
    let mediaRequests = 0;
    await page.route('**/api/media', async (route) => {
      mediaRequests += 1;
      if (mediaRequests === 1) {
        await route.fulfill({ status: 500, contentType: 'application/json', body: '{"success":false}' });
      } else {
        await route.continue();
      }
    });
    await page.goto('/editor');
    await expect(page.getByText('Your uploads could not be loaded.').first()).toBeVisible({ timeout: 60_000 });
    expect(mediaRequests).toBe(1);
    await page.getByRole('button', { name: 'Retry' }).first().click();
    await expect(page.getByText('No media uploaded').first()).toBeVisible();
    expect(mediaRequests).toBe(2);
  });

  test('a template that fails to load can be retried, and nothing can be saved over it meanwhile', async ({ page }) => {
    const { db } = admin();
    const at = new Date().toISOString();
    await db.collection('templates').doc('perf-open-me').set({
      id: 'perf-open-me', userId: USER.uid, name: 'Open me', normalizedName: 'open me', isPublic: false, createdAt: at, updatedAt: at,
      certificateCount: 0, stars: 0, tags: [],
      canvasJSON: JSON.stringify({ objects: [{ type: 'textbox', left: 421, top: 570, originX: 'center', originY: 'center', width: 350, text: '{{VERIFICATION_URL}}', fontSize: 9, styles: [], isVerificationUrl: true, isLocked: true, editable: false }] }),
    });
    await signIn(page, USER.email);
    let attempts = 0;
    await page.route('**/api/templates/perf-open-me', async (route) => {
      attempts += 1;
      if (attempts === 1) await route.fulfill({ status: 500, contentType: 'application/json', body: '{"success":false,"error":"Simulated failure."}' });
      else await route.continue();
    });

    await page.goto('/editor?template=perf-open-me');
    await expect(page.getByText('This template could not be opened')).toBeVisible({ timeout: 60_000 });
    await expect(page.getByRole('button', { name: 'Save' }).first()).toBeDisabled();
    await page.getByRole('button', { name: 'Retry' }).click();
    await expect(page.getByText('This template could not be opened')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Save' }).first()).toBeEnabled({ timeout: 30_000 });
  });

  test('changing the email column keeps the email choice and does not refetch the allowance', async ({ page }) => {
    await signIn(page, USER.email);
    await page.goto('/editor');
    await expect(page.getByRole('button', { name: 'Save' }).first()).toBeEnabled({ timeout: 60_000 });
    await page.locator('input[type="file"][accept=".csv,.xlsx,.xls,.ods"]').setInputFiles({
      name: 'roster.csv', mimeType: 'text/csv',
      buffer: Buffer.from('Name,Email,Backup Email\nAda Lovelace,ada@example.test,ada.backup@example.test\n'),
    });
    let allowanceRequests = 0;
    page.on('request', (request) => { if (request.url().includes('/api/users/premium')) allowanceRequests += 1; });

    await page.getByTitle('Generate').click();
    const emailSwitch = page.getByRole('switch', { name: 'Send certificates via email' });
    await emailSwitch.click();
    await expect(emailSwitch).toHaveAttribute('aria-checked', 'true');
    await page.locator('#generation-email-field').selectOption('Backup Email');
    await page.locator('#generation-name-field').selectOption('Name');
    await expect(emailSwitch).toHaveAttribute('aria-checked', 'true');
    await expect(page.locator('#generation-email-field')).toHaveValue('Backup Email');
    expect(allowanceRequests).toBe(1);
  });
});
