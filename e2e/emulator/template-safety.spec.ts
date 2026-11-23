import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import JSZip from 'jszip';
import QRCode from 'qrcode';
import { admin, ensureUser, idTokenFor, PASSWORD, signIn } from './helpers';

/**
 * Work package 1: reusable designs survive Export/Import and Duplicate with
 * their protected verification link, clickable links, locks and variable
 * fields; a bad file never replaces the design; and one account's recipient
 * data never reaches the next account signed in on the same browser.
 */

const OWNER = { uid: 'template-safety-user', email: 'template-safety@example.test' };
const ACCOUNT_A = { uid: 'iso-account-a', email: 'iso-a@example.test' };
const ACCOUNT_B = { uid: 'iso-account-b', email: 'iso-b@example.test' };
const LINK_URL = 'https://example.test/rules';
const LINK = { x: 200, y: 150 };
const VERIFICATION = { x: 421, y: 570 };
const QR = { x: 762, y: 515 };
const AUTOSAVE_KEY = 'serenity_canvas_autosave';
// A value that appears nowhere else, so finding it proves a leak.
const RECIPIENT_MARKER = 'Zephyrine Markerton';

type SerializedObject = Record<string, unknown>;

async function templateObjects(): Promise<SerializedObject[]> {
  return [
    { type: 'rect', left: 20, top: 20, width: 802, height: 555, fill: 'transparent', stroke: '#1d4ed8', strokeWidth: 6, styles: [] },
    {
      type: 'variableTextbox', left: 421, top: 280, originX: 'center', originY: 'center', width: 600,
      text: '{{Name}}', dynamicKey: 'Name', isPlaceholder: true, fontFamily: 'Arial', fontSize: 40,
      textAlign: 'center', fill: '#111827', editable: false, styles: [],
    },
    {
      type: 'textbox', left: LINK.x, top: LINK.y, originX: 'center', originY: 'center', width: 220,
      text: LINK_URL, fontFamily: 'Arial', fontSize: 18, fill: '#0066cc', underline: true, textAlign: 'center',
      isClickableLink: true, styles: [],
    },
    {
      type: 'image', left: QR.x, top: QR.y, originX: 'center', originY: 'center', width: 100, height: 100,
      scaleX: 0.5, scaleY: 0.5, src: await QRCode.toDataURL('http://127.0.0.1:3000/verify/sample', { width: 100, margin: 1 }),
      verificationId: 'sample', qrColor: '#000000', qrBackgroundColor: '#ffffff',
    },
    {
      type: 'textbox', left: VERIFICATION.x, top: VERIFICATION.y, originX: 'center', originY: 'center', width: 350,
      text: '{{VERIFICATION_URL}}', fontFamily: 'Courier New', fontSize: 9, textAlign: 'center', fill: '#64748b',
      editable: false, isVerificationUrl: true, isLocked: true, lockScalingX: true, lockScalingY: true, hasControls: false, styles: [],
    },
  ];
}

async function createTemplate(baseURL: string, email: string, name: string, objects: SerializedObject[]): Promise<string> {
  const response = await fetch(`${baseURL}/api/templates`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await idTokenFor(email)}` },
    body: JSON.stringify({
      name,
      canvasJSON: JSON.stringify({ version: '5.3.0', background: '#ffffff', objects }),
      certificateMetadata: { title: 'Template Safety', issuedBy: 'Serenity QA', description: '' },
    }),
  });
  const body = await response.json() as { template?: { id: string }; error?: string };
  if (!body.template?.id) throw new Error(`Template creation failed: ${body.error}`);
  return body.template.id;
}

async function savedObjects(templateId: string): Promise<SerializedObject[]> {
  const snapshot = await admin().db.collection('templates').doc(templateId).get();
  return (JSON.parse(String(snapshot.get('canvasJSON'))) as { objects: SerializedObject[] }).objects;
}

function count(objects: SerializedObject[], predicate: (object: SerializedObject) => boolean) {
  return objects.filter(predicate).length;
}

/** Records every alert/confirm and accepts it, so flows never block. */
function collectDialogs(page: Page): string[] {
  const messages: string[] = [];
  page.on('dialog', (dialog) => {
    messages.push(dialog.message());
    void dialog.accept();
  });
  return messages;
}

async function waitForEditor(page: Page) {
  await expect(page.locator('canvas.upper-canvas').first()).toBeVisible({ timeout: 60_000 });
  await expect(page.getByRole('button', { name: 'Save' }).first()).toBeEnabled({ timeout: 60_000 });
  // The canvas scales in with a CSS transition; wait until it has settled.
  let previous = '';
  await expect.poll(async () => {
    const box = JSON.stringify(await page.locator('canvas.upper-canvas').first().boundingBox());
    const settled = box === previous;
    previous = box;
    return settled;
  }, { intervals: [300] }).toBe(true);
}

/** Clicks a point given in certificate coordinates (842 x 595). */
async function clickCanvas(page: Page, point: { x: number; y: number }) {
  const box = await page.locator('canvas.upper-canvas').first().boundingBox();
  if (!box) throw new Error('Canvas is not visible');
  await page.mouse.click(box.x + (point.x / 842) * box.width, box.y + (point.y / 595) * box.height);
}

async function exportJSON(page: Page): Promise<{ objects: SerializedObject[] }> {
  await page.getByTitle('Export / Import').first().click();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export JSON' }).click();
  const download = await downloadPromise;
  return JSON.parse(readFileSync(await download.path(), 'utf8'));
}

async function importJSON(page: Page, name: string, contents: string) {
  await page.getByTitle('Export / Import').first().click();
  const chooserPromise = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Import JSON' }).click();
  const chooser = await chooserPromise;
  await chooser.setFiles({ name, mimeType: 'application/json', buffer: Buffer.from(contents) });
}

/** Tags the current document; the tag disappears if the page is reloaded. */
async function markDocument(page: Page) {
  await page.evaluate(() => { (window as unknown as { __sameDocument?: boolean }).__sameDocument = true; });
}

/**
 * Signs in from whichever page the app is showing and opens a new design,
 * using in-app links only. Fails if the document was reloaded on the way,
 * because a reload would clear memory and prove nothing.
 */
async function signInAndOpenEditorWithoutReload(page: Page, email: string) {
  if (new URL(page.url()).pathname !== '/login') {
    await page.getByRole('link', { name: 'Log in' }).first().click();
    await page.waitForURL(/\/login/);
  }
  await page.locator('#login-email').fill(email);
  await page.locator('#login-password').fill(PASSWORD);
  await page.getByRole('button', { name: /^sign in$/i }).click();
  await page.waitForURL((url) => url.pathname === '/dashboard' || url.pathname === '/editor', { timeout: 60_000 });
  if (new URL(page.url()).pathname !== '/editor') {
    await page.getByRole('link', { name: /New Certificate/ }).first().click();
    await page.waitForURL(/\/editor/);
  }
  await waitForEditor(page);
  expect(await page.evaluate(() => (window as unknown as { __sameDocument?: boolean }).__sameDocument)).toBe(true);
}

async function saveAndWait(page: Page, templateId: string, predicate: (objects: SerializedObject[]) => boolean) {
  await page.getByRole('button', { name: 'Save' }).first().click();
  await expect.poll(async () => predicate(await savedObjects(templateId)), { timeout: 30_000 }).toBe(true);
  await expect(page.getByText('Save Failed')).toHaveCount(0);
}

test.describe('reusable template safety', () => {
  test.beforeEach(async () => {
    const { db } = admin();
    for (const user of [OWNER, ACCOUNT_A, ACCOUNT_B]) {
      for (const collection of ['certificates', 'templates', 'generationBatches']) {
        const owned = await db.collection(collection).where('userId', '==', user.uid).get();
        await Promise.all(owned.docs.map((document) => document.ref.delete()));
      }
      await ensureUser(user.uid, user.email);
    }
  });

  test('Duplicate and Export/Import keep links, locks, variables and one verification link; the PDF opens both links', async ({ page, baseURL }) => {
    const dialogs = collectDialogs(page);
    const templateId = await createTemplate(baseURL!, OWNER.email, `Round trip ${Date.now()}`, await templateObjects());

    await signIn(page, OWNER.email);
    await page.goto(`/editor?template=${templateId}`);
    await waitForEditor(page);

    // An ordinary link duplicates as a link.
    await clickCanvas(page, LINK);
    await page.getByTitle('Duplicate').first().click();
    expect(dialogs).toEqual([]);

    // The protected link and the QR code cannot be duplicated.
    await clickCanvas(page, VERIFICATION);
    await page.getByTitle('Duplicate').first().click();
    await clickCanvas(page, QR);
    await page.getByTitle('Duplicate').first().click();
    expect(dialogs).toHaveLength(2);
    for (const message of dialogs) expect(message).toMatch(/cannot be duplicated/);
    dialogs.length = 0;

    const exported = await exportJSON(page);
    const isVerification = (object: SerializedObject) => object.isVerificationUrl === true;
    const isLink = (object: SerializedObject) => object.isClickableLink === true;
    const isQR = (object: SerializedObject) => typeof object.verificationId === 'string';
    expect(count(exported.objects, isVerification)).toBe(1);
    expect(exported.objects.find(isVerification)).toMatchObject({ isLocked: true, editable: false, text: '{{VERIFICATION_URL}}' });
    expect(count(exported.objects, isLink)).toBe(2);
    expect(count(exported.objects, isQR)).toBe(1);
    expect(count(exported.objects, (object) => object.dynamicKey === 'Name')).toBe(1);
    expect(count(exported.objects, (object) => object.isBoundary === true)).toBe(0);

    // Re-importing the export changes nothing that matters, and it saves.
    await importJSON(page, 'exported.json', JSON.stringify(exported));
    await expect.poll(() => dialogs.length).toBe(1);
    expect(dialogs[0]).toMatch(/^Replace the current design/);
    await saveAndWait(page, templateId, (objects) => count(objects, isLink) === 2
      && count(objects, isVerification) === 1 && count(objects, isQR) === 1
      && count(objects, (object) => object.dynamicKey === 'Name') === 1);
    expect(dialogs).toHaveLength(1);

    // Both links stay clickable in the generated PDF.
    const upload = page.locator('input[type="file"][accept=".csv,.xlsx,.xls,.ods"]');
    await upload.setInputFiles({ name: 'recipients.csv', mimeType: 'text/csv', buffer: Buffer.from('Name,Email\nAda Lovelace,ada@example.test\n') });
    await expect(page.getByTitle('Generate')).toBeEnabled({ timeout: 30_000 });
    await page.getByTitle('Generate').click();
    const downloadPromise = page.waitForEvent('download', { timeout: 120_000 });
    await page.getByRole('button', { name: 'Start Generation' }).click();
    const download = await downloadPromise;
    await expect(page.getByText('All Done!')).toBeVisible({ timeout: 120_000 });

    const zip = await JSZip.loadAsync(readFileSync(await download.path()));
    const pdfName = Object.keys(zip.files).find((name) => name.endsWith('.pdf'))!;
    const pdfText = Buffer.from(await zip.files[pdfName].async('uint8array')).toString('latin1');
    const links = Array.from(pdfText.matchAll(/\/URI \(([^)]+)\)/g)).map((match) => match[1]);
    expect(links.filter((link) => link === LINK_URL)).toHaveLength(2);
    expect(links.filter((link) => link.includes('/verify/'))).toHaveLength(1);
  });

  test('a broken file never replaces the design, and an older export is repaired on import', async ({ page, baseURL }) => {
    const dialogs = collectDialogs(page);
    const objects = await templateObjects();
    const templateId = await createTemplate(baseURL!, OWNER.email, `Import checks ${Date.now()}`, objects);

    await signIn(page, OWNER.email);
    await page.goto(`/editor?template=${templateId}`);
    await waitForEditor(page);

    // Malformed JSON and a second verification link are refused before any confirmation.
    await importJSON(page, 'broken.json', '{"objects": [');
    await expect.poll(() => dialogs.length).toBe(1);
    expect(dialogs[0]).toMatch(/not valid JSON.*not changed/);
    const verification = objects.find((object) => object.isVerificationUrl)!;
    await importJSON(page, 'two-links.json', JSON.stringify({ objects: [verification, verification] }));
    await expect.poll(() => dialogs.length).toBe(2);
    expect(dialogs[1]).toMatch(/more than one verification link/);
    await importJSON(page, 'unknown.json', JSON.stringify({ objects: [verification, { type: 'hologram' }] }));
    await expect.poll(() => dialogs.length).toBe(3);
    expect(dialogs[2]).toMatch(/unsupported object type/);
    const unchanged = await exportJSON(page);
    expect(count(unchanged.objects, (object) => object.isClickableLink === true)).toBe(1);

    // What the previous release exported: no custom flags, and after one
    // export/import cycle, a second unprotected placeholder.
    const legacyPlaceholder = { type: 'textbox', left: 421, top: 570, originX: 'center', originY: 'center', width: 350, text: '{{VERIFICATION_URL}}', fontSize: 9, styles: [] };
    const marker = { type: 'rect', left: 100, top: 100, width: 40, height: 40, fill: '#a1b2c3' };
    await importJSON(page, 'legacy.json', JSON.stringify({ version: '5.3.0', objects: [marker, legacyPlaceholder, { ...legacyPlaceholder }] }));
    await expect.poll(() => dialogs.length).toBe(5);
    expect(dialogs[3]).toMatch(/^Replace the current design/);
    expect(dialogs[4]).toMatch(/protected again.*duplicate verification placeholder/);
    await saveAndWait(page, templateId, (saved) => count(saved, (object) => object.text === '{{VERIFICATION_URL}}') === 1
      && count(saved, (object) => object.isVerificationUrl === true && object.isLocked === true) === 1
      && count(saved, (object) => object.fill === '#a1b2c3') === 1);

    // The dashboard's Import Template accepts the same legacy file.
    await page.goto('/dashboard');
    await page.getByLabel('Import Template').setInputFiles({
      name: 'legacy-dashboard.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify({ version: '5.3.0', objects: [marker, legacyPlaceholder] })),
    });
    await page.waitForURL(/\/editor\?template=/, { timeout: 60_000 });
    const importedId = new URL(page.url()).searchParams.get('template')!;
    const imported = await savedObjects(importedId);
    expect(count(imported, (object) => object.isVerificationUrl === true)).toBe(1);
  });

  test('signing out clears the roster, cached responses and draft before the next account uses the tab', async ({ page }) => {
    collectDialogs(page);
    await signIn(page, ACCOUNT_A.email);
    await page.goto('/editor');
    await waitForEditor(page);
    await page.locator('input[type="file"][accept=".csv,.xlsx,.xls,.ods"]').setInputFiles({
      name: 'roster.csv', mimeType: 'text/csv', buffer: Buffer.from(`Name,Email\n${RECIPIENT_MARKER},marker@example.test\n`),
    });
    await expect(page.getByTitle('Generate')).toBeEnabled({ timeout: 30_000 });
    await page.evaluate((key) => window.localStorage.setItem(key, '{"canvasJSON":"{}"}'), AUTOSAVE_KEY);

    // Client-side navigation only, so in-memory state would survive if not cleared.
    await page.getByRole('link', { name: 'Back to Dashboard' }).click();
    await page.waitForURL(/\/dashboard/);
    await expect.poll(() => page.evaluate(() => Object.keys(window.sessionStorage).some((key) => key.startsWith('serenity-cache:dashboard-summary:'))), { timeout: 30_000 }).toBe(true);
    await markDocument(page);
    await page.getByRole('button', { name: new RegExp(ACCOUNT_A.uid) }).click();
    await page.getByRole('button', { name: 'Sign Out' }).click();
    await page.waitForURL((url) => url.pathname !== '/dashboard');

    expect(await page.evaluate((key) => window.localStorage.getItem(key), AUTOSAVE_KEY)).toBeNull();
    expect(await page.evaluate(() => Object.keys(window.sessionStorage).filter((key) => key.startsWith('serenity-cache:dashboard-summary:')))).toEqual([]);

    await signInAndOpenEditorWithoutReload(page, ACCOUNT_B.email);
    await expect(page.getByTitle('Connect data source')).toBeDisabled();
    await expect(page.getByText(RECIPIENT_MARKER)).toHaveCount(0);
  });

  test('signing out in another tab clears the roster held by this tab', async ({ context }) => {
    const editorTab = await context.newPage();
    collectDialogs(editorTab);
    await signIn(editorTab, ACCOUNT_A.email);
    await editorTab.goto('/editor');
    await waitForEditor(editorTab);
    await editorTab.locator('input[type="file"][accept=".csv,.xlsx,.xls,.ods"]').setInputFiles({
      name: 'roster.csv', mimeType: 'text/csv', buffer: Buffer.from(`Name,Email\n${RECIPIENT_MARKER},marker@example.test\n`),
    });
    await expect(editorTab.getByTitle('Generate')).toBeEnabled({ timeout: 30_000 });
    await markDocument(editorTab);

    const otherTab = await context.newPage();
    await otherTab.goto('/dashboard');
    await otherTab.getByRole('button', { name: new RegExp(ACCOUNT_A.uid) }).click();
    await otherTab.getByRole('button', { name: 'Sign Out' }).click();
    // Sign-out must finish before the tab closes.
    await otherTab.waitForURL((url) => url.pathname !== '/dashboard');
    await otherTab.close();

    // The editor tab is sent to sign-in without a page load.
    await editorTab.waitForURL(/\/login/, { timeout: 30_000 });
    await signInAndOpenEditorWithoutReload(editorTab, ACCOUNT_B.email);
    await expect(editorTab.getByTitle('Connect data source')).toBeDisabled();
    await expect(editorTab.getByText(RECIPIENT_MARKER)).toHaveCount(0);
  });
});
