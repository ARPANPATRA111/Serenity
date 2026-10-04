import { copyFileSync, mkdirSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import { Timestamp } from 'firebase-admin/firestore';
import { admin, ensureUser, idTokenFor, signIn } from './helpers';

/**
 * Free-tier capacity changes: certificate previews stored in Firestore and
 * served from an immutable route (instead of one Vercel Blob upload each),
 * exact account totals from aggregation queries, and one shared cache for the
 * public template gallery.
 */

const OWNER = { uid: 'capacity-owner', email: 'capacity-owner@example.test' };
const OTHER = { uid: 'capacity-other', email: 'capacity-other@example.test' };
const UPLOAD = 'input[type="file"][accept=".csv,.xlsx,.xls,.ods"]';

async function clearAccount(uid: string) {
  const { db } = admin();
  for (const collection of ['certificates', 'templates', 'generationBatches', 'certificatePreviews']) {
    const owned = await db.collection(collection).where('userId', '==', uid).get();
    for (let index = 0; index < owned.docs.length; index += 400) {
      const batch = db.batch();
      owned.docs.slice(index, index + 400).forEach((document) => batch.delete(document.ref));
      await batch.commit();
    }
  }
}

test.describe('free-tier capacity', () => {
  test.beforeEach(async () => {
    for (const account of [OWNER, OTHER]) {
      await clearAccount(account.uid);
      await ensureUser(account.uid, account.email, { isPremium: true });
    }
  });
  test.afterAll(async () => {
    for (const account of [OWNER, OTHER]) await clearAccount(account.uid);
  });

  test('previews are stored in Firestore, served immutably, and owned by their issuer', async ({ page, request, baseURL }) => {
    await signIn(page, OWNER.email);
    await page.goto('/editor?template=curated-academic-course');
    await expect(page.locator(UPLOAD)).toBeAttached({ timeout: 60_000 });
    await page.locator(UPLOAD).setInputFiles({ name: 'r.csv', mimeType: 'text/csv', buffer: Buffer.from('Name\nAda Lovelace\n') });
    await expect(page.getByTitle('Generate')).toBeEnabled({ timeout: 30_000 });
    await page.getByTitle('Generate').click();
    const downloadPromise = page.waitForEvent('download', { timeout: 120_000 });
    await page.getByRole('button', { name: 'Start Generation' }).click();
    await downloadPromise;
    await expect(page.getByText('All Done!')).toBeVisible({ timeout: 120_000 });

    const { db } = admin();
    const record = (await db.collection('certificates').where('userId', '==', OWNER.uid).get()).docs[0].data();
    expect(record.certificateImage).toMatch(new RegExp(`^${baseURL}/api/certificates/preview/${record.id}\\?v=[0-9a-f]{12}$`));

    const image = await request.get(record.certificateImage);
    expect(image.status()).toBe(200);
    expect(image.headers()['content-type']).toBe('image/jpeg');
    expect(image.headers()['cache-control']).toContain('immutable');
    const bytes = (await image.body()).length;
    expect(bytes).toBeGreaterThan(10_000);
    expect(bytes).toBeLessThan(700 * 1024);
    expect((await request.head(record.certificateImage)).status()).toBe(200);
    expect((await request.get('/api/certificates/preview/DoesNotExist99')).status()).toBe(404);
    expect((await request.get('/api/certificates/preview/..%2Fusers')).status()).toBe(404);

    // The verification page shows it.
    await page.goto(`/verify/${record.id}`);
    await expect(page.locator('figure img')).toHaveAttribute('src', record.certificateImage);
    await expect.poll(() => page.locator('figure img').evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(1000);

    // Another account cannot replace the preview.
    const otherToken = await idTokenFor(OTHER.email);
    const hijack = await request.post('/api/certificates/upload-image', {
      headers: { Authorization: `Bearer ${otherToken}` },
      data: { certificateId: record.id, imageBase64: `data:image/jpeg;base64,${(await image.body()).toString('base64')}` },
    });
    expect(hijack.status()).toBe(403);
    const unchanged = (await db.collection('certificatePreviews').doc(record.id).get()).data()!;
    expect(unchanged.userId).toBe(OWNER.uid);
  });

  test('certificates issued with Blob-hosted previews keep showing them', async ({ page, baseURL }) => {
    // An earlier release stored previews as public objects (Vercel Blob; the
    // emulator's stand-in is /api/dev-object). Those URLs must keep working.
    const source = path.join(process.cwd(), '.local-object-store', 'objects', 'certificates');
    const sample = readdirSync(source, { recursive: true }).map(String).find((file) => file.endsWith('.jpg'));
    expect(sample, 'a stored preview to reuse').toBeTruthy();
    const objectPath = `certificates/${OWNER.uid}/LegacyBlob01.jpg`;
    mkdirSync(path.join(process.cwd(), '.local-object-store', 'objects', 'certificates', OWNER.uid), { recursive: true });
    copyFileSync(path.join(source, sample!), path.join(process.cwd(), '.local-object-store', 'objects', ...objectPath.split('/')));

    const now = new Date().toISOString();
    await admin().db.collection('certificates').doc('LegacyBlob01').set({
      id: 'LegacyBlob01', userId: OWNER.uid, recipientName: 'Legacy Blob Recipient', title: 'Certificate of Completion',
      issuerName: 'Legacy Organization', issuedAt: now, createdAt: now, isActive: true, viewCount: 0,
      certificateImage: `${baseURL}/api/dev-object/${objectPath}`,
    });

    await page.goto('/verify/LegacyBlob01');
    await expect(page.getByTestId('recipient-name')).toHaveText('Legacy Blob Recipient');
    await expect(page.locator('figure img')).toHaveAttribute('src', `${baseURL}/api/dev-object/${objectPath}`);
    await expect.poll(() => page.locator('figure img').evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(500);
  });

  test('dashboard and history totals are exact beyond the loaded records', async ({ page }) => {
    const { db } = admin();
    const day = 24 * 60 * 60 * 1000;
    const now = Date.now();
    const batch = db.batch();
    // 60 certificates across the three createdAt representations releases used.
    for (let index = 0; index < 60; index += 1) {
      const created = new Date(now - (index < 20 ? 2 : index < 40 ? 40 : 90) * day - index * 1000);
      const createdAt = index % 3 === 0 ? created.toISOString() : index % 3 === 1 ? Timestamp.fromDate(created) : created.getTime();
      const id = `CapacityC${String(index).padStart(3, '0')}`;
      batch.set(db.collection('certificates').doc(id), {
        id, userId: OWNER.uid, recipientName: `Recipient ${index}`, title: 'Capacity Check', issuerName: 'Serenity QA',
        issuedAt: created.toISOString(), createdAt, isActive: true, viewCount: index % 2,
        emailStatus: index < 30 ? 'sent' : index < 33 ? 'failed' : 'not_sent',
      });
    }
    await batch.commit();

    await signIn(page, OWNER.email);
    await page.goto('/dashboard');
    const generated = page.locator('div').filter({ hasText: /^Certificates Generated/ }).first();
    await expect(generated).toContainText('60');
    await expect(generated).toContainText('+20 this month');
    await expect(page.locator('div').filter({ hasText: /^Emails Sent/ }).first()).toContainText('30');
    await expect(page.locator('div').filter({ hasText: /^Verification Views/ }).first()).toContainText('30');

    await page.goto('/history');
    const tile = (label: string) => page.locator('p', { hasText: new RegExp(`^${label}$`) }).locator('..');
    await expect(tile('Total Certificates')).toContainText('60');
    await expect(tile('Emails Sent')).toContainText('30');
    await expect(tile('Failed')).toContainText('3');
    await expect(page.getByText(/Showing 50 loaded certificates/)).toBeVisible();
  });

  test('the public gallery serves every size from one cache and reflects new public templates at once', async ({ request }) => {
    const small = await (await request.get('/api/templates?public=true&limit=6')).json();
    const large = await (await request.get('/api/templates?public=true&limit=100')).json();
    expect(small.templates).toHaveLength(6);
    expect(large.templates.length).toBeGreaterThan(6);
    expect(large.templates.slice(0, 6).map((template: { id: string }) => template.id))
      .toEqual(small.templates.map((template: { id: string }) => template.id));
    for (const template of large.templates) {
      expect(template.canvasJSON).toBe('');
      expect(template).not.toHaveProperty('userId');
      expect(template).not.toHaveProperty('creatorEmail');
    }

    const token = await idTokenFor(OWNER.email);
    const name = `Capacity public ${Date.now()}`;
    const created = await request.post('/api/templates', {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        name,
        isPublic: true,
        canvasJSON: JSON.stringify({ version: '5.3.0', objects: [
          { type: 'textbox', text: '{{VERIFICATION_URL}}', left: 421, top: 570, width: 350, isVerificationUrl: true, isLocked: true, editable: false, styles: [] },
        ] }),
        certificateMetadata: { title: 'Capacity', issuedBy: 'Serenity QA', description: '' },
      },
    });
    expect(created.status()).toBe(201);
    const after = await (await request.get('/api/templates?public=true&limit=100')).json();
    expect(after.templates.some((template: { name: string }) => template.name === name)).toBe(true);
  });
});
