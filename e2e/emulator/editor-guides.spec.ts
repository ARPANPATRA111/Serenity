import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { admin, ensureUser, idTokenFor, signIn } from './helpers';

/**
 * Work package 3: alignment guides during a continuous drag, dragging a
 * multi-selection, keyboard placement, and tablet access to the data panel.
 */

const USER = { uid: 'editor-guides-user', email: 'editor-guides@example.test' };
const LOGO = { x: 100, y: 400, size: 50 };
const TARGET_CENTRES = [200, 421, 650];

type SerializedObject = Record<string, unknown>;

function designObjects(): SerializedObject[] {
  return [
    ...TARGET_CENTRES.map((x, index) => ({
      type: 'rect', left: x, top: 120, originX: 'center', originY: 'center', width: 60, height: 40,
      fill: ['#0ea5e9', '#22c55e', '#f59e0b'][index], name: `target-${index}`,
    })),
    { type: 'rect', left: LOGO.x, top: LOGO.y, originX: 'center', originY: 'center', width: LOGO.size, height: LOGO.size, fill: '#dc2626' },
    { type: 'rect', left: 700, top: 300, originX: 'center', originY: 'center', width: 40, height: 40, fill: '#7c3aed', lockMovementX: true, lockMovementY: true, isLocked: true },
    {
      type: 'textbox', left: 421, top: 570, originX: 'center', originY: 'center', width: 350, text: '{{VERIFICATION_URL}}',
      fontFamily: 'Courier New', fontSize: 9, styles: [], editable: false, isVerificationUrl: true, isLocked: true, hasControls: false,
    },
  ];
}

async function createTemplate(baseURL: string): Promise<string> {
  const response = await fetch(`${baseURL}/api/templates`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await idTokenFor(USER.email)}` },
    body: JSON.stringify({
      name: `Guides ${Date.now()}`,
      canvasJSON: JSON.stringify({ version: '5.3.0', background: '#ffffff', objects: designObjects() }),
      certificateMetadata: { title: 'Guides', issuedBy: 'Serenity QA', description: '' },
    }),
  });
  const body = await response.json() as { template?: { id: string }; error?: string };
  if (!body.template?.id) throw new Error(`Template creation failed: ${body.error}`);
  return body.template.id;
}

async function openEditor(page: Page, baseURL: string) {
  const id = await createTemplate(baseURL);
  await signIn(page, USER.email);
  await page.goto(`/editor?template=${id}`);
  await expect(page.locator('canvas.upper-canvas').first()).toBeVisible({ timeout: 60_000 });
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

/** Number of distinct guide lines currently painted on each axis of the upper canvas. */
async function visibleGuides(page: Page): Promise<{ vertical: number; horizontal: number }> {
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  return page.evaluate(() => {
    const canvas = document.querySelector('canvas.upper-canvas') as HTMLCanvasElement;
    const { width, height } = canvas;
    const data = canvas.getContext('2d')!.getImageData(0, 0, width, height).data;
    // The guide colour #6366f1, allowing for antialiasing.
    const isGuide = (index: number) => data[index + 3] > 60
      && Math.abs(data[index] - 99) < 40 && Math.abs(data[index + 1] - 102) < 40 && data[index + 2] > 180;
    const columns = new Array(width).fill(0);
    const rows = new Array(height).fill(0);
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        if (isGuide((y * width + x) * 4)) { columns[x] += 1; rows[y] += 1; }
      }
    }
    // A dashed full-length line covers well over a fifth of its axis.
    const clusters = (counts: number[], length: number) => {
      let lines = 0;
      let inLine = false;
      for (const count of counts) {
        const hit = count > length / 5;
        if (hit && !inLine) lines += 1;
        inLine = hit;
      }
      return lines;
    };
    return { vertical: clusters(columns, height), horizontal: clusters(rows, width) };
  });
}

async function exportedObjects(page: Page): Promise<SerializedObject[]> {
  await page.getByTitle('Export / Import').first().click();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export JSON' }).click();
  return JSON.parse(readFileSync(await (await downloadPromise).path(), 'utf8')).objects;
}

const findByFill = (objects: SerializedObject[], fill: string) => objects.find((object) => object.fill === fill)!;

test.describe('editor guides and placement', () => {
  test.beforeEach(async () => {
    const { db } = admin();
    const owned = await db.collection('templates').where('userId', '==', USER.uid).get();
    await Promise.all(owned.docs.map((document) => document.ref.delete()));
    await ensureUser(USER.uid, USER.email);
  });

  test('a continuous drag shows at most one guide per axis and leaves none behind', async ({ page, baseURL }) => {
    await openEditor(page, baseURL!);
    const start = await toScreen(page, LOGO);
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();

    let sawGuide = false;
    for (let x = LOGO.x + 6; x <= 780; x += 6) {
      const point = await toScreen(page, { x, y: LOGO.y });
      await page.mouse.move(point.x, point.y);
      const guides = await visibleGuides(page);
      expect(guides.vertical, `vertical guides at x=${x}`).toBeLessThanOrEqual(1);
      expect(guides.horizontal, `horizontal guides at x=${x}`).toBeLessThanOrEqual(1);
      if (guides.vertical === 1) sawGuide = true;
    }
    expect(sawGuide, 'the drag passed alignment targets').toBe(true);

    // Off every target: nothing from earlier frames remains.
    expect(await visibleGuides(page)).toEqual({ vertical: 0, horizontal: 0 });
    // Back onto the centre target, then release: guides clear with the drag.
    const centre = await toScreen(page, { x: 421, y: LOGO.y });
    await page.mouse.move(centre.x, centre.y, { steps: 10 });
    expect((await visibleGuides(page)).vertical).toBe(1);
    await page.mouse.up();
    expect(await visibleGuides(page)).toEqual({ vertical: 0, horizontal: 0 });

    // The design itself holds no guide artefacts and the logo snapped to the centre.
    const objects = await exportedObjects(page);
    expect(objects).toHaveLength(designObjects().length);
    expect(findByFill(objects, '#dc2626').left).toBeCloseTo(421, 0);
  });

  test('a multi-selection moves freely instead of snapping to its own members', async ({ page, baseURL }) => {
    await openEditor(page, baseURL!);
    // Select the red logo and the left target together.
    const logo = await toScreen(page, LOGO);
    const target = await toScreen(page, { x: TARGET_CENTRES[0], y: 120 });
    await page.mouse.click(logo.x, logo.y);
    await page.keyboard.down('Shift');
    await page.mouse.click(target.x, target.y);
    await page.keyboard.up('Shift');

    // A 3-unit drag, inside the snap distance of the members' own edges.
    const from = await toScreen(page, { x: LOGO.x, y: LOGO.y });
    const to = await toScreen(page, { x: LOGO.x + 3, y: LOGO.y + 3 });
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(to.x, to.y, { steps: 6 });
    await page.mouse.up();
    await page.keyboard.press('Escape');

    const objects = await exportedObjects(page);
    expect(Number(findByFill(objects, '#dc2626').left)).toBeGreaterThan(LOGO.x + 1);
    expect(Number(findByFill(objects, '#0ea5e9').left)).toBeGreaterThan(TARGET_CENTRES[0] + 1);
  });

  test('arrow keys place the selection without dragging; locked objects stay put', async ({ page, baseURL }) => {
    await openEditor(page, baseURL!);
    const logo = await toScreen(page, LOGO);
    await page.mouse.click(logo.x, logo.y);
    for (let press = 0; press < 3; press += 1) await page.keyboard.press('ArrowRight');
    await page.keyboard.press('Shift+ArrowDown');

    const locked = await toScreen(page, { x: 700, y: 300 });
    await page.mouse.click(locked.x, locked.y);
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('Escape');

    const objects = await exportedObjects(page);
    expect(findByFill(objects, '#dc2626')).toMatchObject({ left: LOGO.x + 3, top: LOGO.y + 10 });
    expect(findByFill(objects, '#7c3aed')).toMatchObject({ left: 700, top: 300 });
    // Undo reverses a nudge.
    await page.mouse.click(logo.x + 1, logo.y + 1);
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('Control+z');
    await page.keyboard.press('Escape');
    expect(findByFill(await exportedObjects(page), '#dc2626')).toMatchObject({ left: LOGO.x + 3 });
  });

  test.describe('at tablet width', () => {
    test.use({ viewport: { width: 820, height: 1180 } });

    test('the data panel (import and field mapping) is reachable', async ({ page, baseURL }) => {
      await openEditor(page, baseURL!);
      const dataButton = page.getByRole('button', { name: /Data sources/ });
      await expect(dataButton).toBeVisible();
      await expect(page.getByRole('button', { name: 'Tools and media' })).toBeHidden();
      await dataButton.click();
      // The drawer's own upload field (the desktop sidebar's copy is hidden).
      const upload = page.locator('input[type="file"][accept=".csv,.xlsx,.xls,.ods"]').last();
      await upload.setInputFiles({ name: 'roster.csv', mimeType: 'text/csv', buffer: Buffer.from('Name,Email\nAda Lovelace,ada@example.test\n') });
      await page.getByRole('button', { name: 'Close data sources' }).click();
      await expect(page.getByTitle('Generate')).toBeEnabled();
    });
  });
});
