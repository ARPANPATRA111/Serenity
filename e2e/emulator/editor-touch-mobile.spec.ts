import { expect, test, type Page } from '@playwright/test';
import { admin, ensureUser, idTokenFor, signIn } from './helpers';

/**
 * Work package 3 on a phone (Pixel 7 project): a finger drag shows and clears
 * alignment guides like a mouse drag, the design saves from the phone
 * toolbar, and the drawers keep Data and Tools reachable.
 */

const USER = { uid: 'editor-touch-user', email: 'editor-touch@example.test' };
const LOGO = { x: 100, y: 400 };

async function createTemplate(baseURL: string): Promise<string> {
  const objects = [
    { type: 'rect', left: 421, top: 120, originX: 'center', originY: 'center', width: 60, height: 40, fill: '#22c55e' },
    { type: 'rect', left: LOGO.x, top: LOGO.y, originX: 'center', originY: 'center', width: 60, height: 60, fill: '#dc2626' },
    {
      type: 'textbox', left: 421, top: 570, originX: 'center', originY: 'center', width: 350, text: '{{VERIFICATION_URL}}',
      fontFamily: 'Courier New', fontSize: 9, styles: [], editable: false, isVerificationUrl: true, isLocked: true, hasControls: false,
    },
  ];
  const response = await fetch(`${baseURL}/api/templates`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await idTokenFor(USER.email)}` },
    body: JSON.stringify({
      name: `Touch ${Date.now()}`,
      canvasJSON: JSON.stringify({ version: '5.3.0', background: '#ffffff', objects }),
      certificateMetadata: { title: 'Touch', issuedBy: 'Serenity QA', description: '' },
    }),
  });
  const body = await response.json() as { template?: { id: string } };
  return body.template!.id;
}

async function toScreen(page: Page, point: { x: number; y: number }) {
  const box = (await page.locator('canvas.upper-canvas').first().boundingBox())!;
  return { x: box.x + (point.x / 842) * box.width, y: box.y + (point.y / 595) * box.height };
}

async function guideLines(page: Page): Promise<number> {
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  return page.evaluate(() => {
    const canvas = document.querySelector('canvas.upper-canvas') as HTMLCanvasElement;
    const { width, height } = canvas;
    const data = canvas.getContext('2d')!.getImageData(0, 0, width, height).data;
    const columns = new Array(width).fill(0);
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const index = (y * width + x) * 4;
        if (data[index + 3] > 60 && Math.abs(data[index] - 99) < 40 && Math.abs(data[index + 1] - 102) < 40 && data[index + 2] > 180) columns[x] += 1;
      }
    }
    let lines = 0;
    let inLine = false;
    for (const count of columns) {
      const hit = count > height / 5;
      if (hit && !inLine) lines += 1;
      inLine = hit;
    }
    return lines;
  });
}

test.describe('editor on a phone', () => {
  test.beforeEach(async () => {
    const { db } = admin();
    const owned = await db.collection('templates').where('userId', '==', USER.uid).get();
    await Promise.all(owned.docs.map((document) => document.ref.delete()));
    await ensureUser(USER.uid, USER.email);
  });

  test('a finger drag snaps, clears its guides on release, and saves', async ({ page, baseURL }) => {
    const id = await createTemplate(baseURL!);
    await signIn(page, USER.email);
    await page.goto(`/editor?template=${id}`);
    await expect(page.locator('canvas.upper-canvas').first()).toBeVisible({ timeout: 60_000 });
    const save = page.getByRole('button', { name: 'Save' }).first();
    await expect(save).toBeEnabled({ timeout: 60_000 });
    await page.waitForTimeout(800); // canvas scale transition

    const cdp = await page.context().newCDPSession(page);
    const touch = (type: 'touchStart' | 'touchMove' | 'touchEnd', point?: { x: number; y: number }) => cdp.send('Input.dispatchTouchEvent', {
      type,
      touchPoints: point ? [{ x: point.x, y: point.y, id: 1, radiusX: 4, radiusY: 4, force: 1 }] : [],
    });

    await touch('touchStart', await toScreen(page, LOGO));
    let maxLines = 0;
    let sawGuide = false;
    for (let x = LOGO.x + 8; x <= 421; x += 8) {
      await touch('touchMove', await toScreen(page, { x, y: LOGO.y }));
      const lines = await guideLines(page);
      maxLines = Math.max(maxLines, lines);
      if (lines === 1) sawGuide = true;
    }
    await touch('touchMove', await toScreen(page, { x: 421, y: LOGO.y }));
    expect(maxLines).toBeLessThanOrEqual(1);
    expect(sawGuide).toBe(true);
    await touch('touchEnd');
    expect(await guideLines(page)).toBe(0);

    await save.click();
    await expect.poll(async () => {
      const snapshot = await admin().db.collection('templates').doc(id).get();
      const objects = JSON.parse(String(snapshot.get('canvasJSON'))).objects as Array<{ fill?: string; left?: number }>;
      return Math.round(objects.find((object) => object.fill === '#dc2626')?.left ?? 0);
    }, { timeout: 30_000 }).toBe(421);
  });

  test('Data and Tools drawers open from the phone toolbar', async ({ page }) => {
    await signIn(page, USER.email);
    await page.goto('/editor');
    await expect(page.getByRole('button', { name: 'Save' }).first()).toBeEnabled({ timeout: 60_000 });
    await page.getByRole('button', { name: 'Tools and media' }).click();
    await expect(page.getByRole('button', { name: 'Close tools and media' })).toBeVisible();
    await page.getByRole('button', { name: 'Close tools and media' }).click();
    await page.getByRole('button', { name: /Data sources/ }).click();
    await expect(page.locator('input[type="file"][accept=".csv,.xlsx,.xls,.ods"]').last()).toBeAttached();
    await page.getByRole('button', { name: 'Close data sources' }).click();
  });
});
