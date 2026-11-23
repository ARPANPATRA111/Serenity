import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import * as XLSX from 'xlsx';
import { admin, ensureUser, idTokenFor, signIn } from './helpers';

/**
 * Work package 4: the path to a first certificate and repeat batches. The
 * roster preview is identical for CSV and Excel (Hindi names, written dates,
 * duplicates), workbooks offer their sheets, Generate explains what is
 * missing, dialogs keep keyboard focus, unsaved work can be recovered, and
 * an image can be replaced in place.
 */

const USER = { uid: 'first-cert-user', email: 'first-cert@example.test' };
const ROWS: Array<[string, string, string]> = [
  ['Ada Lovelace', 'ada@example.test', '12 March 2026'],
  ['अनन्या शर्मा', 'ananya@example.test', '12 March 2026'],
  ['Ada Lovelace', 'ada.two@example.test', '12 March 2026'],
];
const VERIFICATION = {
  type: 'textbox', left: 421, top: 570, originX: 'center', originY: 'center', width: 350, text: '{{VERIFICATION_URL}}',
  fontFamily: 'Courier New', fontSize: 9, styles: [], editable: false, isVerificationUrl: true, isLocked: true, hasControls: false,
};

type SerializedObject = Record<string, unknown>;

async function createTemplate(baseURL: string, objects: SerializedObject[]): Promise<string> {
  const response = await fetch(`${baseURL}/api/templates`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await idTokenFor(USER.email)}` },
    body: JSON.stringify({
      name: `First certificate ${Date.now()}`,
      canvasJSON: JSON.stringify({ version: '5.3.0', background: '#ffffff', objects: [...objects, VERIFICATION] }),
      certificateMetadata: { title: 'Hackathon Completion', issuedBy: 'Serenity QA', description: '' },
    }),
  });
  const body = await response.json() as { template?: { id: string } };
  return body.template!.id;
}

async function openEditor(page: Page, path: string) {
  await page.goto(path);
  await expect(page.getByRole('button', { name: 'Save' }).first()).toBeEnabled({ timeout: 60_000 });
  let previous = '';
  await expect.poll(async () => {
    const box = JSON.stringify(await page.locator('canvas.upper-canvas').first().boundingBox());
    const settled = box === previous;
    previous = box;
    return settled;
  }, { intervals: [300] }).toBe(true);
}

async function toScreen(page: Page, point: { x: number; y: number }) {
  const box = (await page.locator('canvas.upper-canvas').first().boundingBox())!;
  return { x: box.x + (point.x / 842) * box.width, y: box.y + (point.y / 595) * box.height };
}

async function exportedObjects(page: Page): Promise<SerializedObject[]> {
  await page.getByTitle('Export / Import').first().click();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export JSON' }).click();
  return JSON.parse(readFileSync(await (await downloadPromise).path(), 'utf8')).objects;
}

function csvBuffer(): Buffer {
  return Buffer.from(['Name,Email,Date', ...ROWS.map((row) => row.join(','))].join('\n'), 'utf8');
}

function workbookBuffer(): Buffer {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([['Name', 'Email', 'Date'], ...ROWS]), 'Roster');
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([['Name', 'Email'], ['Mentor One', 'mentor@example.test']]), 'Mentors');
  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}

/** What the generation dialog says the roster will produce. */
async function rosterPreview(page: Page) {
  await page.getByTitle('Generate').click();
  const summary = page.getByRole('definition').first().locator('..').locator('..');
  await expect(page.getByTestId('sample-file-name')).toBeVisible();
  const result = {
    summary: (await summary.innerText()).replace(/\s+/g, ' ').trim(),
    sampleFile: await page.getByTestId('sample-file-name').innerText(),
  };
  await page.keyboard.press('Escape');
  return result;
}

const rosterUpload = (page: Page) => page.locator('input[type="file"][accept=".csv,.xlsx,.xls,.ods"]').first();

test('a new organiser returns to their chosen design after verifying their email', async ({ page, request }) => {
  const email = 'honours-' + Date.now() + '@example.test';
  await page.goto('/');
  // Hold the hero slideshow on one design, then open it from the caption.
  await page.getByRole('button', { name: 'Pause slideshow' }).click();
  const chosen = page.locator('.proof-template');
  const target = (await chosen.getAttribute('href'))!;
  const designName = (await chosen.innerText()).trim();
  expect(target).toMatch(/^\/editor\?template=bundled-/);
  await chosen.click();
  await page.getByRole('link', { name: 'Create a free account' }).click();
  await page.locator('#signup-name').fill('Demo Organiser');
  await page.locator('#signup-email').fill(email);
  await page.locator('#signup-password').fill('Test-only-123!');
  await page.locator('#signup-confirmation').fill('Test-only-123!');
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await expect(page.getByText(/Account created. Open the verification link/)).toBeVisible();
  expect(new URL(page.url()).searchParams.get('redirect')).toBe(target);

  const outbox = await request.get('http://127.0.0.1:9099/emulator/v1/projects/demo-serenity/oobCodes');
  const { oobCodes } = await outbox.json() as { oobCodes: Array<{ email: string; oobLink: string }> };
  const message = oobCodes.find(item => item.email === email);
  expect(message).toBeDefined();
  const verification = new URL(message!.oobLink);
  const continuation = new URL(verification.searchParams.get('continueUrl')!);
  expect(continuation.searchParams.get('redirect')).toBe(target);
  await page.goto('/auth/action' + verification.search);
  await expect(page.getByText(/Your email has been verified successfully/)).toBeVisible();
  await page.locator('a[href^="/login"]').click();
  await page.locator('#login-email').fill(email);
  await page.locator('#login-password').fill('Test-only-123!');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.waitForURL(url => url.pathname + url.search === target);
  await expect(page.getByRole('textbox', { name: 'Template name' })).toHaveValue(new RegExp(designName));
});

test.describe('first certificate and repeat batches', () => {
  test.beforeEach(async () => {
    const { db } = admin();
    for (const collection of ['templates', 'certificates']) {
      const owned = await db.collection(collection).where('userId', '==', USER.uid).get();
      await Promise.all(owned.docs.map((document) => document.ref.delete()));
    }
    await ensureUser(USER.uid, USER.email);
  });

  test('CSV and Excel produce the same roster preview, and a workbook offers its sheets', async ({ page, baseURL }) => {
    const id = await createTemplate(baseURL!, [
      { type: 'variableTextbox', left: 421, top: 260, originX: 'center', originY: 'center', width: 600, text: '{{Name}}', dynamicKey: 'Name', isPlaceholder: true, fontSize: 36, styles: [] },
      { type: 'textbox', left: 421, top: 330, originX: 'center', originY: 'center', width: 600, text: 'For {{Team}} on {{Date}}', fontSize: 18, styles: [] },
    ]);
    await signIn(page, USER.email);
    await openEditor(page, `/editor?template=${id}`);

    await rosterUpload(page).setInputFiles({ name: 'roster.csv', mimeType: 'text/csv', buffer: csvBuffer() });
    await expect(page.getByText('3 records')).toBeVisible();
    const fromCsv = await rosterPreview(page);
    expect(fromCsv.sampleFile).toBe('Ada_Lovelace_<certificate-ID>.pdf');
    expect(fromCsv.summary).toContain('Certificates: 3');
    expect(fromCsv.summary).toContain('Longest name: Ada Lovelace (12 characters, row 1)');
    expect(fromCsv.summary).toContain('Same name twice: Ada Lovelace');

    // {{Team}} has no column: the dialog says so before generating.
    await page.getByTitle('Generate').click();
    await expect(page.getByRole('alert').filter({ hasText: '{{Team}}' })).toBeVisible();
    await page.keyboard.press('Escape');

    // The same people from an Excel workbook.
    await page.getByRole('button', { name: 'Unlink spreadsheet' }).first().click();
    await rosterUpload(page).setInputFiles({
      name: 'roster.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: workbookBuffer(),
    });
    await expect(page.getByText('3 records')).toBeVisible();
    expect(await rosterPreview(page)).toEqual(fromCsv);

    // Preview the Hindi row, then switch worksheets.
    await page.getByRole('button', { name: 'Next record' }).first().click();
    await expect(page.getByText('Record 2 of 3').first()).toBeVisible();
    await expect(page.getByText('अनन्या शर्मा').first()).toBeVisible();
    await page.getByLabel('Worksheet').first().selectOption('Mentors');
    await expect(page.getByText('1 record', { exact: true }).first()).toBeVisible();
  });

  test('Generate explains a missing roster and leads to the import; dialogs keep keyboard focus', async ({ page, baseURL }) => {
    const id = await createTemplate(baseURL!, []);
    await signIn(page, USER.email);
    await openEditor(page, `/editor?template=${id}`);

    const generate = page.getByRole('button', { name: 'Generate' }).first();
    await expect(generate).toHaveAttribute('aria-disabled', 'true');
    await generate.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('status').filter({ hasText: 'Import a spreadsheet' })).toBeVisible();
    await page.getByRole('button', { name: 'Import spreadsheet' }).click();
    await expect.poll(() => page.evaluate(() => document.activeElement?.hasAttribute('data-roster-upload'))).toBe(true);

    // Certificate Info: focus moves in, Tab stays in, Escape returns it.
    const opener = page.getByTitle('Certificate Info').first();
    await opener.focus();
    await page.keyboard.press('Enter');
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect.poll(() => dialog.evaluate((element) => element.contains(document.activeElement))).toBe(true);
    for (let press = 0; press < 25; press += 1) await page.keyboard.press('Tab');
    expect(await dialog.evaluate((element) => element.contains(document.activeElement))).toBe(true);
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect.poll(() => opener.evaluate((element) => element === document.activeElement)).toBe(true);
  });

  test('unsaved changes are offered back after a reload, and saving clears the offer', async ({ page, baseURL }) => {
    page.on('dialog', (dialog) => void dialog.accept());
    const id = await createTemplate(baseURL!, [
      { type: 'rect', left: 200, top: 200, originX: 'center', originY: 'center', width: 60, height: 60, fill: '#dc2626' },
    ]);
    await signIn(page, USER.email);
    await openEditor(page, `/editor?template=${id}`);
    await expect(page.getByText(/^Saved /)).toBeVisible();

    const logo = await toScreen(page, { x: 200, y: 200 });
    await page.mouse.click(logo.x, logo.y);
    for (let press = 0; press < 5; press += 1) await page.keyboard.press('ArrowRight');
    await expect(page.getByText('Unsaved changes', { exact: true })).toBeVisible();
    await expect.poll(() => page.evaluate(() => Object.keys(localStorage).filter((key) => key.startsWith('serenity_draft:')).length)).toBe(1);

    await page.reload();
    await openEditor(page, `/editor?template=${id}`);
    await expect(page.getByText(/Unsaved changes to this design from/)).toBeVisible();
    await page.getByRole('button', { name: 'Restore changes' }).click();
    expect((await exportedObjects(page)).find((object) => object.fill === '#dc2626')).toMatchObject({ left: 205 });

    await page.getByRole('button', { name: 'Save' }).first().click();
    await expect(page.getByText(/^Saved /)).toBeVisible();
    await page.reload();
    await openEditor(page, `/editor?template=${id}`);
    await expect(page.getByText(/Unsaved changes to this design from/)).toHaveCount(0);
    expect((await exportedObjects(page)).find((object) => object.fill === '#dc2626')).toMatchObject({ left: 205 });
  });

  test('Replace image keeps the image centred in its old box, leaves nearby text alone, and undoes', async ({ page, baseURL }) => {
    await signIn(page, USER.email);
    // Two PNGs of opposite proportions, drawn by the browser.
    await page.goto('/dashboard');
    const [wide, tall] = await page.evaluate(() => [[200, 100, '#2563eb'], [100, 200, '#16a34a']].map(([width, height, colour]) => {
      const canvas = document.createElement('canvas');
      canvas.width = Number(width);
      canvas.height = Number(height);
      const context = canvas.getContext('2d')!;
      context.fillStyle = String(colour);
      context.fillRect(0, 0, canvas.width, canvas.height);
      return canvas.toDataURL('image/png');
    }));
    const id = await createTemplate(baseURL!, [
      { type: 'image', left: 300, top: 250, originX: 'center', originY: 'center', width: 200, height: 100, scaleX: 0.5, scaleY: 0.5, src: wide },
      { type: 'textbox', left: 300, top: 320, originX: 'center', originY: 'center', width: 200, text: 'Lead organiser', fontSize: 16, styles: [] },
    ]);
    await openEditor(page, `/editor?template=${id}`);

    const image = await toScreen(page, { x: 300, y: 250 });
    await page.mouse.click(image.x, image.y);
    const chooser = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: 'Replace image' }).click();
    await (await chooser).setFiles({ name: 'tall.png', mimeType: 'image/png', buffer: Buffer.from(tall.split(',')[1], 'base64') });
    // The tall picture is 100 pixels wide; the original was 200.
    await expect.poll(async () => {
      const objects = await exportedObjects(page);
      return Math.round(Number(objects.find((object) => object.type === 'image')?.width));
    }).toBe(100);

    const objects = await exportedObjects(page);
    const replaced = objects.find((object) => object.type === 'image')! as Record<string, number>;
    expect(replaced.left).toBeCloseTo(300, 0);
    expect(replaced.top).toBeCloseTo(250, 0);
    expect(replaced.width * replaced.scaleX).toBeLessThanOrEqual(100.5);
    expect(replaced.height * replaced.scaleY).toBeLessThanOrEqual(50.5);
    expect(objects.find((object) => object.text === 'Lead organiser')).toMatchObject({ left: 300, top: 320 });

    await page.keyboard.press('Control+z');
    await expect.poll(async () => {
      const restored = (await exportedObjects(page)).find((object) => object.type === 'image')!;
      return Math.round(Number(restored.width));
    }).toBe(200);
  });
});
