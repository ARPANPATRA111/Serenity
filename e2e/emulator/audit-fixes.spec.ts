import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import JSZip from 'jszip';
import { admin, ensureUser, readOutbox, signIn } from './helpers';

/**
 * Regression checks for the October 2026 audit (promo-video/BUGS.md):
 * spreadsheet encoding and dates, Preview never changing the print, template
 * fonts in the editor, placeholder chrome never saved or printed, readable
 * file names, and the page-level fixes (titles, labels, plurals, layout).
 */

const USER = { uid: 'audit-user', email: 'audit-user@example.test' };
const TEMPLATE = 'curated-academic-course';
const EXPORT_MULTIPLIER = 4.166;
const UPLOAD = 'input[type="file"][accept=".csv,.xlsx,.xls,.ods"]';

/** BOM-less UTF-8, as Google Sheets, Numbers and LibreOffice export it. */
function csv(rows: string[][]): Buffer {
  return Buffer.from(rows.map((row) => row.join(',')).join('\n'), 'utf8');
}

function pageJpeg(pdf: Buffer): string {
  const text = pdf.toString('latin1');
  const streamStart = text.indexOf('stream', text.indexOf('/DCTDecode')) + 'stream'.length;
  const dataStart = text[streamStart] === '\r' ? streamStart + 2 : streamStart + 1;
  return pdf.subarray(dataStart, text.indexOf('endstream', dataStart)).toString('base64');
}

async function removeAuditData() {
  const { db } = admin();
  for (const collection of ['certificates', 'templates', 'generationBatches']) {
    const owned = await db.collection(collection).where('userId', '==', USER.uid).get();
    await Promise.all(owned.docs.map((document) => document.ref.delete()));
  }
}

async function resetUser() {
  await removeAuditData();
  await ensureUser(USER.uid, USER.email, { isPremium: true, name: 'Audit User' });
}

async function openWithData(page: Page, templateId: string, data: Buffer) {
  await page.goto(`/editor?template=${templateId}`);
  const upload = page.locator(UPLOAD);
  await expect(upload).toBeAttached({ timeout: 60_000 });
  await upload.setInputFiles({ name: 'recipients.csv', mimeType: 'text/csv', buffer: data });
  await expect(page.getByTitle('Generate')).toBeEnabled({ timeout: 30_000 });
}

/** Generates the loaded batch and returns the first certificate's page image (base64 JPEG) and ZIP entry names. */
async function generate(page: Page, { email = false } = {}) {
  await page.getByTitle('Generate').click();
  if (email) await page.getByRole('switch', { name: 'Send certificates via email' }).click();
  const downloadPromise = page.waitForEvent('download', { timeout: 120_000 });
  await page.getByRole('button', { name: 'Start Generation' }).click();
  const download = await downloadPromise;
  await expect(page.getByText('All Done!')).toBeVisible({ timeout: 120_000 });
  const zip = await JSZip.loadAsync(readFileSync(await download.path()));
  const names = Object.keys(zip.files).filter((name) => name.endsWith('.pdf')).sort();
  const jpeg = pageJpeg(Buffer.from(await zip.files[names[0]].async('uint8array')));
  await page.getByRole('button', { name: 'Close' }).last().click();
  return { names, jpeg };
}

/** Mean per-pixel difference of two page images inside canvas-unit boxes, plus "blue ink" pixel counts. */
async function compareRegions(page: Page, first: string, second: string) {
  return page.evaluate(async ({ first, second, multiplier }) => {
    async function context(jpeg: string) {
      const image = new Image();
      image.src = `data:image/jpeg;base64,${jpeg}`;
      await image.decode();
      const canvas = document.createElement('canvas');
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(image, 0, 0);
      return ctx;
    }
    const boxes = {
      title: { x: 96, y: 98, w: 650, h: 28 },
      name: { x: 96, y: 245, w: 650, h: 70 },
      subline: { x: 111, y: 358, w: 620, h: 24 },
    };
    const a = await context(first);
    const b = await context(second);
    const result: Record<string, { difference: number; blueInSecond: number }> = {};
    for (const [label, box] of Object.entries(boxes)) {
      const [x, y, w, h] = [box.x, box.y, box.w, box.h].map((value) => Math.round(value * multiplier));
      const one = a.getImageData(x, y, w, h).data;
      const two = b.getImageData(x, y, w, h).data;
      let total = 0;
      let blue = 0;
      for (let index = 0; index < one.length; index += 4) {
        total += Math.abs(one[index] - two[index]) + Math.abs(one[index + 1] - two[index + 1]) + Math.abs(one[index + 2] - two[index + 2]);
        if (two[index + 2] - Math.max(two[index], two[index + 1]) > 60) blue += 1;
      }
      result[label] = { difference: total / (one.length / 4) / 3, blueInSecond: blue };
    }
    return result;
  }, { first, second, multiplier: EXPORT_MULTIPLIER });
}

test.describe('audit fixes', () => {
  test.beforeEach(resetUser);
  // Later specs read the shared seeded dataset (e.g. the console's batch list).
  test.afterAll(removeAuditData);

  test('BOM-less UTF-8 names and written dates survive import, print, records, files and email (BUG-01/04/07)', async ({ page }) => {
    await signIn(page, USER.email);
    await openWithData(page, TEMPLATE, csv([
      ['Name', 'Email', 'Issuer', 'Date'],
      ['Zoë Ångström', 'zoe.audit@example.com', 'Kestrel Ridge Learning Studio', '2026-10-05'],
      ['José Núñez', 'jose.audit@example.com', 'Kestrel Ridge Learning Studio', '5 October 2026'],
    ]));

    // The data preview shows the names and dates exactly as written.
    await expect(page.getByText('Zoë Ångström').first()).toBeVisible();
    await expect(page.getByText('2026-10-05').first()).toBeVisible();

    const { names } = await generate(page, { email: true });
    expect(names.some((name) => name.includes('Zoë_Ångström'))).toBe(true);
    expect(names.some((name) => name.includes('José_Núñez'))).toBe(true);

    const records = (await admin().db.collection('certificates').where('userId', '==', USER.uid).get()).docs.map((doc) => doc.data());
    expect(records.map((record) => record.recipientName).sort()).toEqual(['José Núñez', 'Zoë Ångström']);

    const outbox = readOutbox().filter((message) => message.to[0]?.email.endsWith('.audit@example.com'));
    const zoe = outbox.find((message) => message.to[0].email === 'zoe.audit@example.com')!;
    expect(zoe.to[0].name).toBe('Zoë Ångström');
    expect(zoe.attachments[0].filename).toBe('certificate_Zoë_Ångström.pdf');
    expect(zoe.html).toContain('Zoë Ångström');
  });

  test('Preview leaves the printed certificate unchanged and adds no stroke (BUG-02)', async ({ page }) => {
    const data = csv([['Name', 'Email', 'Issuer', 'Date'], ['Ada Lovelace', 'ada.audit@example.com', 'Analytical Society', '1843-09-01']]);
    await signIn(page, USER.email);

    await openWithData(page, TEMPLATE, data);
    const plain = await generate(page);

    await openWithData(page, TEMPLATE, data);
    await page.getByTitle('Preview').first().click();
    await expect(page.getByTitle('Exit Preview')).toBeVisible();
    await page.getByTitle('Exit Preview').click();
    const previewed = await generate(page);

    const regions = await compareRegions(page, plain.jpeg, previewed.jpeg);
    for (const [label, region] of Object.entries(regions)) {
      expect(region.difference, `${label} differs after Preview`).toBeLessThan(1);
    }
    expect(regions.subline.blueInSecond, 'blue stroke on the subline').toBeLessThan(20);

    // Saving after a preview stores no editor stroke either.
    await page.getByRole('button', { name: 'Save' }).first().click();
    await expect.poll(async () => {
      const saved = await admin().db.collection('templates').where('userId', '==', USER.uid).get();
      return saved.docs.map((doc) => String(doc.get('canvasJSON')))
        .some((json) => json.includes('Presented by'));
    }, { timeout: 30_000 }).toBe(true);
    const saved = await admin().db.collection('templates').where('userId', '==', USER.uid).get();
    for (const doc of saved.docs) {
      const objects = JSON.parse(String(doc.get('canvasJSON'))).objects as Array<Record<string, unknown>>;
      for (const object of objects.filter((item) => /text/i.test(String(item.type)))) {
        expect(object.stroke ?? null, `${object.text} saved with an editor stroke`).toBeNull();
      }
    }
  });

  test('the editor draws templates in their own fonts, without console noise (BUG-03/16)', async ({ page }) => {
    const warnings: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'warning' && message.text().includes('alphabetical')) warnings.push(message.text());
    });
    await signIn(page, USER.email);
    await page.goto(`/editor?template=${TEMPLATE}`);
    await expect(page.locator(UPLOAD)).toBeAttached({ timeout: 60_000 });
    await expect.poll(() => page.evaluate(() => {
      const loaded = (family: string, weight: string) => Array.from(document.fonts)
        .some((face) => face.family.replace(/"/g, '') === family && face.weight === weight && face.status === 'loaded');
      return [loaded('Montserrat', '700'), loaded('Playfair Display', '600'), loaded('Inter', '400')];
    }), { timeout: 20_000 }).toEqual([true, true, true]);
    expect(warnings).toHaveLength(0);
  });

  test('templates saved with old editor chrome load, save and print clean; thumbnails carry no chrome (BUG-05/06)', async ({ page }) => {
    const id = `audit-chrome-${Date.now()}`;
    const now = new Date().toISOString();
    await admin().db.collection('templates').doc(id).set({
      id, userId: USER.uid, name: `Chrome ${Date.now()}`, normalizedName: id, isPublic: false, tags: [], certificateCount: 0,
      createdAt: now, updatedAt: now,
      certificateMetadata: { title: 'Chrome Check', issuedBy: 'Serenity QA', description: '' },
      canvasJSON: JSON.stringify({
        version: '5.3.0',
        background: '#ffffff',
        objects: [
          { type: 'variableTextbox', left: 421, top: 280, originX: 'center', originY: 'center', width: 650, text: '{{Name}}', dynamicKey: 'Name', isPlaceholder: true, fontFamily: 'Arial', fontSize: 50, textAlign: 'center', fill: '#111827', stroke: '#001eff', strokeWidth: 2, strokeDashArray: [5, 5], styles: [] },
          { type: 'textbox', left: 421, top: 370, originX: 'center', originY: 'center', width: 620, text: 'Presented by {{Issuer}}', fontFamily: 'Arial', fontSize: 18, textAlign: 'center', fill: '#475569', stroke: '#3b82f6', strokeWidth: 1, strokeDashArray: [4, 2], styles: [] },
          { type: 'textbox', left: 421, top: 570, originX: 'center', originY: 'center', width: 350, text: '{{VERIFICATION_URL}}', fontFamily: 'Courier New', fontSize: 9, textAlign: 'center', fill: '#64748b', isVerificationUrl: true, isLocked: true, editable: false, styles: [] },
        ],
      }),
    });

    await signIn(page, USER.email);
    await openWithData(page, id, csv([['Name', 'Issuer'], ['Grace Hopper', 'Navy Reserve']]));
    const { jpeg } = await generate(page);
    const blue = await page.evaluate(async ({ jpeg, multiplier }) => {
      const image = new Image();
      image.src = `data:image/jpeg;base64,${jpeg}`;
      await image.decode();
      const canvas = document.createElement('canvas');
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(image, 0, 0);
      const { data } = ctx.getImageData(0, Math.round(230 * multiplier), canvas.width, Math.round(170 * multiplier));
      let count = 0;
      for (let index = 0; index < data.length; index += 4) if (data[index + 2] - Math.max(data[index], data[index + 1]) > 60) count += 1;
      return count;
    }, { jpeg, multiplier: EXPORT_MULTIPLIER });
    expect(blue, 'blue chrome printed').toBeLessThan(20);

    await page.getByRole('button', { name: 'Save' }).first().click();
    await expect.poll(async () => (await admin().db.collection('templates').doc(id).get()).get('updatedAt'), { timeout: 30_000 }).not.toBe(now);
    const stored = (await admin().db.collection('templates').doc(id).get()).data()!;
    for (const object of JSON.parse(stored.canvasJSON).objects as Array<Record<string, unknown>>) {
      expect(object.stroke ?? null).toBeNull();
    }

    // The thumbnail is the print, not the editor: no #001eff frame or badge.
    expect(String(stored.thumbnail)).toMatch(/^(data:image\/jpeg|https?:)/);
    const badgePixels = await page.evaluate(async (src) => {
      const image = new Image();
      image.crossOrigin = 'anonymous';
      image.src = src;
      await image.decode();
      const canvas = document.createElement('canvas');
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(image, 0, 0);
      const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
      let count = 0;
      for (let index = 0; index < data.length; index += 4) {
        if (data[index] < 60 && data[index + 1] < 80 && data[index + 2] > 200) count += 1;
      }
      return count;
    }, String(stored.thumbnail));
    expect(badgePixels, 'placeholder chrome in the thumbnail').toBeLessThan(10);
  });

  test('page fixes: plurals, labels, titles, robots, copy and the phone toolbar (BUG-08 to BUG-17)', async ({ page, request, browser }) => {
    await signIn(page, USER.email);
    await openWithData(page, TEMPLATE, csv([['Name', 'Issuer', 'Date'], ['Katherine Johnson', 'NASA Langley', '1962-02-20']]));
    await expect(page.getByText(/^1 record$/)).toBeVisible();
    await page.getByTitle('Generate').click();
    await expect(page.getByText(/^1 Certificate$/)).toBeVisible();
    await page.getByRole('button', { name: 'Cancel' }).click();

    // Certificate Information fields are reachable by their labels.
    await page.getByTitle('Certificate Info').click();
    await expect(page.getByLabel('Issued By')).toBeVisible();
    await expect(page.getByLabel('Certificate Title')).toBeVisible();
    await page.keyboard.press('Escape');

    await generate(page);
    await page.goto('/history');
    await expect(page.getByText(/^1 certificate$/).first()).toBeVisible();
    await expect(page.getByText(/^0 views$/).first()).toBeVisible();
    await expect(page.getByLabel('Filter by email status')).toBeVisible();
    await expect(page).toHaveTitle('Certificate History | Serenity Certificate Generator');

    // The hero badge reads light-on-dark.
    await page.goto('/dashboard');
    const badge = page.getByText(/^\d+ sent$/).first();
    await expect(badge).toBeVisible();
    const color = await badge.evaluate((element) => getComputedStyle(element).color);
    const [r, g, b] = color.match(/\d+/g)!.map(Number);
    expect((r + g + b) / 3, `badge text ${color}`).toBeGreaterThan(150);

    // The name field never sits under the tools on a phone.
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/editor?template=${TEMPLATE}`);
    await expect(page.locator(UPLOAD)).toBeAttached({ timeout: 60_000 });
    const name = await page.getByLabel('Template name').boundingBox();
    const text = await page.getByTitle('Add Text').boundingBox();
    expect(name && text && name.x + name.width <= text.x + 0.5, `name ${JSON.stringify(name)} overlaps ${JSON.stringify(text)}`).toBe(true);
    await page.setViewportSize({ width: 1280, height: 720 });

    // Public copy matches what generation produces.
    await page.goto('/');
    const landing = await page.locator('body').innerText();
    expect(landing).not.toMatch(/PDF · PNG|PDF, PNG|as PNG, or as both/);
    expect(landing).toMatch(/\/verify\/Xk3Lq9TbR2mP/);
    // Signed-in visitors are sent to the dashboard, so sign-up is checked signed out.
    const signedOut = await browser.newContext();
    const signup = await signedOut.newPage();
    await signup.goto('/signup');
    await expect(signup.getByText('Download every certificate as a PDF, together in one ZIP')).toBeVisible();
    await signedOut.close();

    // 404 page has a real heading; unknown certificates are not indexable.
    await page.goto('/this-page-does-not-exist');
    await expect(page.getByRole('heading', { level: 1, name: 'Page Not Found' })).toBeVisible();
    const missing = await (await request.get('/verify/DoesNotExist99')).text();
    expect(missing).toMatch(/<meta name="robots" content="noindex/);
    const valid = await (await request.get('/verify/LegacyMain01')).text();
    expect(valid).toContain('<title>Certificate of Completion — Legacy Recipient | Serenity Certificate Generator</title>');
    expect(valid).toContain('rel="canonical" href="http://127.0.0.1:3000/verify/LegacyMain01"');
  });
});
