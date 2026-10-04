import { readFileSync } from 'node:fs';
import path from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import JSZip from 'jszip';
import QRCode from 'qrcode';
import { admin, ensureUser, idTokenFor, readOutbox, signIn } from './helpers';

/**
 * End-to-end certificate issuance: template -> spreadsheet -> PDFs -> saved
 * records -> emails -> verification. The template is deliberately built the
 * way older templates were saved (a 100px QR inserted at scale 0.5, a large
 * stroked circle and a full-page border), so the run also proves existing
 * templates keep printing correctly.
 */

const USER = { uid: 'gen-user', email: 'gen-user@example.test' };
const EXPORT_MULTIPLIER = 4.166;
// Canvas geometry of the QR in the test template (origin centre).
const QR_CENTER = { x: 762, y: 515 };
const QR_PRINTED_SIZE = 200 * 0.5; // canvas units: every release printed QR at 200 x scale

async function createTemplate(idToken: string, name: string): Promise<string> {
  const qrSource = await QRCode.toDataURL('http://127.0.0.1:3000/verify/sample-verification-id', { width: 100, margin: 1 });
  const canvasJSON = JSON.stringify({
    version: '5.3.0',
    background: '#ffffff',
    objects: [
      { type: 'rect', left: 20, top: 20, width: 802, height: 555, fill: 'transparent', stroke: '#1d4ed8', strokeWidth: 6 },
      { type: 'circle', left: 421, top: 300, originX: 'center', originY: 'center', radius: 150, fill: 'rgba(29,78,216,0.08)', stroke: '#b45309', strokeWidth: 8 },
      {
        type: 'variableTextbox', left: 421, top: 280, originX: 'center', originY: 'center', width: 600,
        text: '{{Name}}', dynamicKey: 'Name', isPlaceholder: true, fontFamily: 'Arial', fontSize: 40,
        textAlign: 'center', fill: '#111827', editable: false,
      },
      {
        type: 'image', left: QR_CENTER.x, top: QR_CENTER.y, originX: 'center', originY: 'center',
        width: 100, height: 100, scaleX: 0.5, scaleY: 0.5, src: qrSource,
        verificationId: 'sample-verification-id', qrColor: '#000000', qrBackgroundColor: '#ffffff',
      },
      {
        type: 'textbox', left: 421, top: 570, originX: 'center', originY: 'center', width: 350,
        text: '{{VERIFICATION_URL}}', fontFamily: 'Courier New', fontSize: 9, textAlign: 'center', fill: '#64748b',
        editable: false, isVerificationUrl: true, isLocked: true, lockScalingX: true, lockScalingY: true, hasControls: false,
      },
    ],
  });

  const response = await fetch('http://127.0.0.1:3000/api/templates', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
    body: JSON.stringify({
      name,
      canvasJSON,
      certificateMetadata: { title: 'Render Quality Check', issuedBy: 'Serenity QA', description: '' },
    }),
  });
  const body = await response.json() as { template?: { id: string }; error?: string };
  if (!body.template?.id) throw new Error(`Template creation failed: ${body.error}`);
  return body.template.id;
}

function csv(rows: Array<[string, string]>): Buffer {
  return Buffer.from(['Name,Email', ...rows.map(([name, email]) => `${name},${email}`)].join('\n'));
}

async function openEditorWithData(page: Page, templateId: string, data: Buffer) {
  await page.goto(`/editor?template=${templateId}`);
  const upload = page.locator('input[type="file"][accept=".csv,.xlsx,.xls,.ods"]');
  await expect(upload).toBeAttached({ timeout: 60_000 });
  await upload.setInputFiles({ name: 'recipients.csv', mimeType: 'text/csv', buffer: data });
  await expect(page.getByTitle('Generate')).toBeEnabled({ timeout: 30_000 });
}

/** Pulls the page image (JPEG) and link annotations out of a jsPDF certificate. */
function readCertificatePdf(bytes: Buffer): { jpeg: Buffer; links: string[] } {
  const text = bytes.toString('latin1');
  const links = Array.from(text.matchAll(/\/URI \(([^)]+)\)/g)).map((match) => match[1]);
  const filter = text.indexOf('/DCTDecode');
  const streamStart = text.indexOf('stream', filter) + 'stream'.length;
  const dataStart = text[streamStart] === '\r' ? streamStart + 2 : streamStart + 1;
  const dataEnd = text.indexOf('endstream', dataStart);
  return { jpeg: bytes.subarray(dataStart, dataEnd), links };
}

test.describe('certificate generation', () => {
  test.beforeEach(async () => {
    // Every test starts from an empty free account.
    const { db } = admin();
    for (const collection of ['certificates', 'templates', 'generationBatches']) {
      const owned = await db.collection(collection).where('userId', '==', USER.uid).get();
      await Promise.all(owned.docs.map((document) => document.ref.delete()));
    }
    await ensureUser(USER.uid, USER.email);
  });

  test('generates, saves, emails, and verifies a batch; the printed QR decodes to its verification page', async ({ page, baseURL }) => {
    const idToken = await idTokenFor(USER.email);
    const templateId = await createTemplate(idToken, `E2E template ${Date.now()}`);
    const recipients: Array<[string, string]> = [
      ['Ada Lovelace', 'ada@example.test'],
      ['Grace Hopper', 'grace@example.test'],
      ['Katherine Johnson', 'katherine@example.test'],
    ];

    await signIn(page, USER.email);
    await openEditorWithData(page, templateId, csv(recipients));

    await page.getByTitle('Generate').click();
    await expect(page.getByText('3 Certificates')).toBeVisible();
    await page.getByRole('switch', { name: 'Send certificates via email' }).click();
    await expect(page.getByText(/All 3 recipients have valid email addresses/)).toBeVisible();

    const downloadPromise = page.waitForEvent('download', { timeout: 120_000 });
    await page.getByRole('button', { name: 'Start Generation' }).click();
    const download = await downloadPromise;
    await expect(page.getByText('All Done!')).toBeVisible({ timeout: 120_000 });
    await expect(page.getByText('3 sent')).toBeVisible();

    // ZIP contents: one PDF per recipient, each with a clickable verification link.
    const zipPath = await download.path();
    const zip = await JSZip.loadAsync(readFileSync(zipPath));
    const pdfNames = Object.keys(zip.files).filter((name) => name.endsWith('.pdf'));
    expect(pdfNames).toHaveLength(3);

    await page.addScriptTag({ path: path.join(process.cwd(), 'node_modules', 'jsqr', 'dist', 'jsQR.js') });

    const issued: Array<{ id: string; name: string }> = [];
    for (const fileName of pdfNames) {
      const pdf = readCertificatePdf(Buffer.from(await zip.files[fileName].async('uint8array')));
      const verifyLinks = pdf.links.filter((link) => link.includes('/verify/'));
      expect(verifyLinks, fileName).toHaveLength(1);
      const id = verifyLinks[0].split('/verify/')[1];
      expect(verifyLinks[0]).toBe(`${baseURL}/verify/${id}`);
      expect(fileName).toContain(id);
      issued.push({ id, name: recipients.find(([name]) => fileName.includes(name.replace(/\s+/g, '_')))![0] });

      // Decode the printed QR out of the page image and check its geometry.
      const measurement = await page.evaluate(async ({ jpeg, center, size, multiplier }) => {
        const image = new Image();
        image.src = `data:image/jpeg;base64,${jpeg}`;
        await image.decode();
        // Just beyond the QR's own quiet zone, so nearby design elements
        // (the page border) stay out of the measurement.
        const cropSize = Math.round(size * multiplier * 1.1);
        const left = Math.round(center.x * multiplier - cropSize / 2);
        const top = Math.round(center.y * multiplier - cropSize / 2);
        const canvas = document.createElement('canvas');
        canvas.width = cropSize;
        canvas.height = cropSize;
        const context = canvas.getContext('2d')!;
        context.fillStyle = '#ffffff';
        context.fillRect(0, 0, cropSize, cropSize);
        context.drawImage(image, left, top, cropSize, cropSize, 0, 0, cropSize, cropSize);
        const { data } = context.getImageData(0, 0, cropSize, cropSize);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const decoded = (window as any).jsQR(data, cropSize, cropSize);
        let minX = cropSize; let minY = cropSize; let maxX = -1; let maxY = -1;
        let dark = 0; let midTone = 0;
        for (let y = 0; y < cropSize; y += 1) {
          for (let x = 0; x < cropSize; x += 1) {
            const value = data[(y * cropSize + x) * 4];
            if (value < 110) {
              dark += 1;
              minX = Math.min(minX, x); maxX = Math.max(maxX, x);
              minY = Math.min(minY, y); maxY = Math.max(maxY, y);
            } else if (value < 200) {
              midTone += 1;
            }
          }
        }
        return {
          imageWidth: image.naturalWidth,
          imageHeight: image.naturalHeight,
          text: decoded?.data ?? null,
          darkWidth: maxX - minX + 1,
          darkHeight: maxY - minY + 1,
          midToneShare: midTone / (dark + midTone),
        };
      }, { jpeg: pdf.jpeg.toString('base64'), center: QR_CENTER, size: QR_PRINTED_SIZE, multiplier: EXPORT_MULTIPLIER });

      // 842 x 4.166 = 3507.8; the canvas truncates to a whole pixel.
      expect(Math.abs(measurement.imageWidth - 842 * EXPORT_MULTIPLIER)).toBeLessThan(1.5);
      expect(measurement.text, `${fileName} QR payload`).toBe(`${baseURL}/verify/${id}`);
      // Printed size unchanged from earlier releases: 100 canvas units, i.e.
      // ~417px at 300 DPI; the dark modules span 33 of the 35 module grid.
      const expectedDarkSpan = QR_PRINTED_SIZE * EXPORT_MULTIPLIER * (33 / 35);
      expect(Math.abs(measurement.darkWidth - expectedDarkSpan)).toBeLessThan(12);
      expect(Math.abs(measurement.darkHeight - expectedDarkSpan)).toBeLessThan(12);
      // Crisp modules: few intermediate tones along module edges.
      expect(measurement.midToneShare).toBeLessThan(0.12);
    }

    // Saved records match what was printed and emailed.
    const { db } = admin();
    for (const { id, name } of issued) {
      const record = (await db.collection('certificates').doc(id).get()).data()!;
      expect(record.userId).toBe(USER.uid);
      expect(record.recipientName).toBe(name);
      expect(record.recipientEmail).toBe(recipients.find(([recipient]) => recipient === name)![1]);
      expect(typeof record.createdAt).toBe('string');
      expect(record.isActive).toBe(true);
      expect(record.emailStatus).toBe('sent');
      // The preview is stored in Firestore (never in Vercel Blob) and served by its own immutable route.
      expect(record.certificateImage).toMatch(new RegExp(`^${baseURL}/api/certificates/preview/${id}\\?v=[0-9a-f]{12}$`));
      expect((await db.collection('certificatePreviews').doc(id).get()).get('userId')).toBe(USER.uid);
    }

    const batchId = (await db.collection('certificates').doc(issued[0].id).get()).get('generationBatchId');
    const batch = (await db.collection('generationBatches').doc(batchId).get()).data()!;
    expect(batch).toMatchObject({ userId: USER.uid, certificateCount: 3, recipientsWithEmail: 3, title: 'Render Quality Check' });
    expect((await db.collection('users').doc(USER.uid).get()).get('certificatesGenerated')).toBe(3);

    const outbox = readOutbox().filter((message) => recipients.some(([, email]) => message.to[0]?.email === email));
    expect(outbox).toHaveLength(3);
    for (const message of outbox) {
      expect(message.attachments).toHaveLength(1);
      expect(message.attachments[0].bytes).toBeGreaterThan(10_000);
      expect(message.html).toMatch(new RegExp(`${baseURL}/verify/[A-Za-z0-9_-]{12}`));
      expect(message.html).toContain('attached to this email');
    }

    // Every issued certificate verifies with the recipient's name.
    for (const { id, name } of issued) {
      await page.goto(`/verify/${id}`);
      await expect(page.getByTestId('recipient-name')).toHaveText(name);
      await expect(page.locator('figure img')).toHaveAttribute('src', new RegExp(`/api/certificates/preview/${id}\\?v=[0-9a-f]{12}$`));
    }
  });

  test('a hand-written gallery template saves, generates, and fills names and inline fields', async ({ page }) => {
    // The seeded copy keeps the hand-written shape (no text styles, placeholder
    // stored as a plain textbox), which previously made saving throw and
    // printed "{{Name}}" literally.
    await ensureUser(USER.uid, USER.email, { isPremium: true });
    await signIn(page, USER.email);
    await page.goto('/editor?template=curated-academic-course');
    const upload = page.locator('input[type="file"][accept=".csv,.xlsx,.xls,.ods"]');
    await expect(upload).toBeAttached({ timeout: 60_000 });

    // A spreadsheet without the Name column triggers the placeholder warning.
    await upload.setInputFiles({ name: 'missing.csv', mimeType: 'text/csv', buffer: Buffer.from('Full Name,Email\nAda,ada@example.test\n') });
    await page.getByTitle('Generate').click();
    await expect(page.getByText('{{Name}} will print as written', { exact: false })).toBeVisible();
    await page.getByRole('button', { name: 'Cancel' }).click();
    await page.getByTitle('Remove Data Link in sidebar').click();

    await expect(upload).toBeAttached();
    await upload.setInputFiles({
      name: 'recipients.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from('Name,Email,Issuer,Date\nAda Lovelace,ada@example.test,Analytical Society,1843-09-01\nGrace Hopper,grace@example.test,Navy Reserve,1952-05-01\n'),
    });
    await page.getByTitle('Generate').click();
    await expect(page.getByText(/placeholder.* no matching column/i)).toHaveCount(0);

    const downloadPromise = page.waitForEvent('download', { timeout: 120_000 });
    await page.getByRole('button', { name: 'Start Generation' }).click();
    const download = await downloadPromise;
    await expect(page.getByText('All Done!')).toBeVisible({ timeout: 120_000 });

    const zip = await JSZip.loadAsync(readFileSync(await download.path()));
    const pdfs = Object.keys(zip.files).filter((name) => name.endsWith('.pdf')).sort();
    expect(pdfs).toHaveLength(2);
    // Named from the new spreadsheet's Name column, not the previous file's.
    expect(pdfs[0]).toContain('Ada_Lovelace');
    expect(pdfs[1]).toContain('Grace_Hopper');
    const images = await Promise.all(pdfs.map(async (name) => readCertificatePdf(Buffer.from(await zip.files[name].async('uint8array'))).jpeg.toString('base64')));

    // Compare the name line and the "Presented by {{Issuer}} on {{Date}}" line
    // across the two certificates: filled values differ, literal tokens would not.
    const differences = await page.evaluate(async ({ first, second, multiplier }) => {
      async function pixels(jpeg: string) {
        const image = new Image();
        image.src = `data:image/jpeg;base64,${jpeg}`;
        await image.decode();
        const canvas = document.createElement('canvas');
        canvas.width = image.naturalWidth;
        canvas.height = image.naturalHeight;
        const context = canvas.getContext('2d')!;
        context.drawImage(image, 0, 0);
        return context;
      }
      function meanDifference(a: CanvasRenderingContext2D, b: CanvasRenderingContext2D, box: { x: number; y: number; w: number; h: number }) {
        const [x, y, w, h] = [box.x, box.y, box.w, box.h].map((value) => Math.round(value * multiplier));
        const one = a.getImageData(x, y, w, h).data;
        const two = b.getImageData(x, y, w, h).data;
        let total = 0;
        for (let index = 0; index < one.length; index += 4) total += Math.abs(one[index] - two[index]);
        return total / (one.length / 4);
      }
      const a = await pixels(first);
      const b = await pixels(second);
      return {
        nameLine: meanDifference(a, b, { x: 96, y: 245, w: 650, h: 70 }),
        inlineLine: meanDifference(a, b, { x: 111, y: 358, w: 620, h: 24 }),
        titleLine: meanDifference(a, b, { x: 96, y: 98, w: 650, h: 28 }),
      };
    }, { first: images[0], second: images[1], multiplier: EXPORT_MULTIPLIER });

    expect(differences.titleLine, 'identical title text should render identically').toBeLessThan(1);
    expect(differences.nameLine, 'names should be filled in per recipient').toBeGreaterThan(3);
    expect(differences.inlineLine, 'inline {{Issuer}}/{{Date}} should be filled in per recipient').toBeGreaterThan(3);

    // The user's copy of the template was saved (it used to fail to serialise).
    const copies = await admin().db.collection('templates').where('userId', '==', USER.uid).get();
    expect(copies.docs.some((document) => String(document.get('name')).startsWith('Copy of '))).toBe(true);
  });

  test('a brand-new design saves from the editor', async ({ page }) => {
    await ensureUser(USER.uid, USER.email);
    const { db } = admin();
    const before = (await db.collection('templates').where('userId', '==', USER.uid).get()).size;

    await signIn(page, USER.email);
    await page.goto('/editor');
    await expect(page.locator('canvas').first()).toBeVisible({ timeout: 60_000 });
    await page.getByRole('button', { name: 'Save' }).first().click();
    await expect.poll(async () => (await db.collection('templates').where('userId', '==', USER.uid).get()).size, { timeout: 30_000 })
      .toBe(before + 1);
    await expect(page.getByText('Save Failed')).toHaveCount(0);
  });

  test('a template saved by the deployed release loads, saves, and generates', async ({ page }) => {
    // Exactly what the deployed editor stored: styles present, the
    // verification object flagged and locked, but no "editable" key, which
    // Fabric never serialises.
    await ensureUser(USER.uid, USER.email, { isPremium: true });
    const id = `legacy-shape-${Date.now()}`;
    const canvasJSON = JSON.stringify({
      version: '5.3.0',
      background: '#ffffff',
      objects: [
        { type: 'variableTextbox', left: 421, top: 280, originX: 'center', originY: 'center', width: 600, text: '{{Name}}', dynamicKey: 'Name', isPlaceholder: true, fontFamily: 'Arial', fontSize: 40, textAlign: 'center', fill: '#111827', styles: [] },
        { type: 'textbox', left: 421, top: 570, originX: 'center', originY: 'center', width: 350, text: '{{VERIFICATION_URL}}', fontFamily: 'Courier New', fontSize: 9, textAlign: 'center', fill: '#666666', styles: [], isVerificationUrl: true, isLocked: true },
      ],
    });
    const now = new Date().toISOString();
    await admin().db.collection('templates').doc(id).set({
      id, userId: USER.uid, name: `Legacy shape ${Date.now()}`, normalizedName: id, canvasJSON, isPublic: false,
      certificateMetadata: { title: 'Legacy Template', issuedBy: 'Serenity QA', description: '' },
      createdAt: now, updatedAt: now, certificateCount: 0, tags: [],
    });

    await signIn(page, USER.email);
    await openEditorWithData(page, id, csv([['Ada Lovelace', 'ada@example.test']]));
    await page.getByTitle('Generate').click();
    const downloadPromise = page.waitForEvent('download', { timeout: 120_000 });
    await page.getByRole('button', { name: 'Start Generation' }).click();
    await downloadPromise;
    await expect(page.getByText('All Done!')).toBeVisible({ timeout: 120_000 });
  });

  test('the free allowance is enforced before rendering', async ({ page }) => {
    await ensureUser(USER.uid, USER.email, { certificatesGenerated: 4 });
    const idToken = await idTokenFor(USER.email);
    const templateId = await createTemplate(idToken, `E2E allowance ${Date.now()}`);

    await signIn(page, USER.email);
    await openEditorWithData(page, templateId, csv([['One', 'one@example.test'], ['Two', 'two@example.test']]));
    await page.getByTitle('Generate').click();
    await expect(page.getByText(/1 generation remaining/)).toBeVisible();
    await page.getByRole('button', { name: 'Start Generation' }).click();
    await expect(page.getByText(/You can only generate 1 more certificate/)).toBeVisible({ timeout: 60_000 });
  });

  test('Cancel stops a running batch and keeps what was already generated', async ({ page }) => {
    await ensureUser(USER.uid, USER.email, { isPremium: true });
    const idToken = await idTokenFor(USER.email);
    const templateId = await createTemplate(idToken, `E2E cancel ${Date.now()}`);
    const rows = Array.from({ length: 40 }, (_, index) => [`Recipient ${index + 1}`, `r${index + 1}@example.test`] as [string, string]);

    await signIn(page, USER.email);
    await openEditorWithData(page, templateId, csv(rows));
    await page.getByTitle('Generate').click();
    await page.getByRole('button', { name: 'Start Generation' }).click();
    await expect(page.getByText(/Processing [2-9] of 40/)).toBeVisible({ timeout: 60_000 });
    await page.getByRole('button', { name: 'Cancel Generation' }).click();

    await expect(page.getByText('Generation Cancelled')).toBeVisible({ timeout: 120_000 });
    // What was generated before cancelling is saved, so its links verify.
    await expect(page.getByText(/not saved yet/)).toHaveCount(0);
    const summary = await page.getByText(/Generated \d+ of 40 certificates/).textContent();
    const generated = Number(summary?.match(/Generated (\d+)/)?.[1]);
    expect(generated).toBeGreaterThan(0);
    expect(generated).toBeLessThan(40);
  });
});
