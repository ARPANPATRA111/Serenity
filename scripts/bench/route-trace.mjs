/**
 * Organiser-route trace against a local emulator build (work package 2).
 *
 *   pnpm emulators                         (separate terminal)
 *   pnpm build:emulator && pnpm start:emulator
 *   node scripts/bench/route-trace.mjs [--base http://127.0.0.1:3000] [--samples 5] [--label candidate] [--seed]
 *
 * Seeds one synthetic account (300 certificates with 20-column imported rows,
 * 60 templates with thumbnails, 40 media records), then visits Dashboard,
 * History, My Templates and the editor with a saved template. For each visit it
 * records time to first usable content, time to final totals, the number of
 * /api requests, response bytes, and the Server-Timing stages the API reports.
 * The first visit of each route is a fresh page load straight after sign-in;
 * later samples repeat the same navigation warm.
 *
 * Emulator timings show request shape and regressions only. Real network
 * latency needs a comparable preview deployment or production telemetry.
 * Refuses to run against anything but 127.0.0.1 with reachable emulators.
 */
import { chromium } from '@playwright/test';
import { getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

const args = process.argv.slice(2);
const option = (name, fallback) => {
  const index = args.indexOf(`--${name}`);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
};
const BASE_URL = option('base', 'http://127.0.0.1:3000');
const SAMPLES = Math.max(1, Number(option('samples', '5')));
const LABEL = option('label', 'run');
const SEED = args.includes('--seed');
const USER = { uid: 'trace-user', email: 'trace-user@example.test', password: 'Test-only-123!' };
const CERTIFICATES = 300;
const TEMPLATES = 60;
const MEDIA = 40;

process.env.FIRESTORE_EMULATOR_HOST ||= '127.0.0.1:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST ||= '127.0.0.1:9099';

async function assertLocal() {
  if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(BASE_URL)) throw new Error(`Refusing to trace ${BASE_URL}: local builds only.`);
  for (const url of ['http://127.0.0.1:9099/', 'http://127.0.0.1:8080/', BASE_URL]) {
    try { await fetch(url); } catch { throw new Error(`${url} is not reachable.`); }
  }
}

function admin() {
  const app = getApps()[0] || initializeApp({ projectId: 'demo-serenity' });
  return { auth: getAuth(app), db: getFirestore(app) };
}

async function seed() {
  const { auth, db } = admin();
  try { await auth.getUser(USER.uid); await auth.updateUser(USER.uid, { email: USER.email, password: USER.password, emailVerified: true }); }
  catch { await auth.createUser({ uid: USER.uid, email: USER.email, password: USER.password, emailVerified: true, displayName: 'Trace User' }); }
  await db.collection('users').doc(USER.uid).set({ id: USER.uid, email: USER.email, name: 'Trace User', emailVerified: true, isPremium: true, certificatesGenerated: CERTIFICATES, createdAt: new Date() });

  for (const collection of ['certificates', 'templates', 'user-media']) {
    const owned = await db.collection(collection).where('userId', '==', USER.uid).get();
    for (let index = 0; index < owned.docs.length; index += 400) {
      const batch = db.batch();
      owned.docs.slice(index, index + 400).forEach((document) => batch.delete(document.ref));
      await batch.commit();
    }
  }

  const now = Date.now();
  const row = Object.fromEntries(Array.from({ length: 20 }, (_, column) => [`Column ${column + 1}`, `synthetic value ${column + 1} `.repeat(4)]));
  for (let start = 0; start < CERTIFICATES; start += 400) {
    const batch = db.batch();
    for (let index = start; index < Math.min(start + 400, CERTIFICATES); index += 1) {
      const id = `Trace${String(index).padStart(5, '0')}`;
      const createdAt = new Date(now - index * 3_600_000).toISOString();
      batch.set(db.collection('certificates').doc(id), {
        id, userId: USER.uid, recipientName: `Trace Recipient ${index}`, recipientEmail: `trace${index}@example.test`,
        title: 'Trace Certificate', issuerName: 'Serenity QA', templateId: 'trace-open', templateName: 'Trace Template',
        issuedAt: createdAt, createdAt, isActive: true, viewCount: index % 4, emailStatus: index % 5 === 0 ? 'sent' : 'not_sent',
        generationBatchId: `trace-batch-${Math.floor(index / 25)}`, metadata: { Name: `Trace Recipient ${index}`, ...row },
      });
    }
    await batch.commit();
  }

  // A ~25 KB JPEG-sized data URL per thumbnail, like saved templates carry.
  const thumbnail = `data:image/jpeg;base64,${'A'.repeat(25_000)}`;
  const design = JSON.stringify({ version: '5.3.0', background: '#ffffff', objects: [
    { type: 'textbox', left: 421, top: 200, originX: 'center', originY: 'center', width: 600, text: 'Trace design', fontFamily: 'Arial', fontSize: 40, styles: [] },
    { type: 'textbox', left: 421, top: 570, originX: 'center', originY: 'center', width: 350, text: '{{VERIFICATION_URL}}', fontFamily: 'Courier New', fontSize: 9, styles: [], isVerificationUrl: true, isLocked: true, editable: false },
  ] });
  const batch = db.batch();
  for (let index = 0; index < TEMPLATES; index += 1) {
    const id = index === 0 ? 'trace-open' : `trace-template-${String(index).padStart(2, '0')}`;
    const at = new Date(now - index * 60_000).toISOString();
    batch.set(db.collection('templates').doc(id), {
      id, userId: USER.uid, name: `Trace template ${String(index).padStart(2, '0')}`, normalizedName: id,
      canvasJSON: design, thumbnail, isPublic: false, createdAt: at, updatedAt: at, certificateCount: 0, stars: 0, tags: [],
      certificateMetadata: { title: 'Trace Certificate', issuedBy: 'Serenity QA', description: '' },
    });
  }
  for (let index = 0; index < MEDIA; index += 1) {
    const id = `trace-media-${index}`;
    batch.set(db.collection('user-media').doc(id), {
      id, userId: USER.uid, name: `asset-${index}.png`, url: `${BASE_URL}/icon.svg`, type: 'image/png', size: 1024,
      uploadedAt: new Date(now - index * 1000).toISOString(), storagePath: `media/${USER.uid}/${id}.png`,
    });
  }
  await batch.commit();
}

const routes = [
  {
    name: 'Dashboard',
    path: '/dashboard',
    firstUsable: (page) => page.getByText('Certificate for Trace Recipient 0').waitFor(),
    final: (page) => page.locator('div').filter({ hasText: /^Certificates Generated/ }).first().getByText('300', { exact: true }).waitFor(),
  },
  {
    name: 'History',
    path: '/history',
    firstUsable: (page) => page.getByRole('heading', { name: 'Trace Template' }).first().waitFor(),
    final: (page) => page.locator('p', { hasText: /^Total Certificates$/ }).locator('..').getByText('300', { exact: true }).waitFor(),
  },
  {
    name: 'My Templates',
    path: '/my-templates',
    firstUsable: (page) => page.getByText('Trace template 00').waitFor(),
    final: null,
  },
  {
    name: 'Editor (saved template)',
    path: '/editor?template=trace-open',
    firstUsable: async (page) => {
      await page.getByRole('button', { name: 'Save' }).first().waitFor();
      await page.waitForFunction(() => {
        const save = Array.from(document.querySelectorAll('button')).find((button) => button.textContent?.trim() === 'Save');
        return save && !save.disabled && !document.body.innerText.includes('Loading Template...');
      }, null, { timeout: 60_000 });
    },
    final: null,
  },
];

async function visit(page, route) {
  const requests = [];
  const onResponse = async (response) => {
    const url = response.url();
    if (!url.includes('/api/')) return;
    const entry = { path: url.replace(/^https?:\/\/[^/]+/, '').split('?')[0], timing: response.headers()['server-timing'] || '', bytes: 0 };
    requests.push(entry);
    try { entry.bytes = (await response.body()).length; } catch { /* aborted */ }
  };
  page.on('response', onResponse);
  const started = Date.now();
  await page.goto(route.path);
  await route.firstUsable(page);
  const firstUsableMs = Date.now() - started;
  let finalMs = null;
  if (route.final) {
    await route.final(page);
    finalMs = Date.now() - started;
  }
  await page.waitForLoadState('networkidle').catch(() => undefined);
  page.off('response', onResponse);
  return {
    firstUsableMs,
    finalMs,
    apiRequests: requests.length,
    apiBytes: requests.reduce((sum, request) => sum + request.bytes, 0),
    endpoints: requests.map((request) => request.path),
    serverTiming: requests.filter((request) => request.timing).map((request) => `${request.path} ${request.timing}`),
  };
}

const median = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : Math.round((sorted[middle - 1] + sorted[middle]) / 2);
};

async function main() {
  await assertLocal();
  if (SEED) await seed();

  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  await page.goto(`${BASE_URL}/login`);
  await page.locator('#login-email').fill(USER.email);
  await page.locator('#login-password').fill(USER.password);
  await page.getByRole('button', { name: /^sign in$/i }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 60_000 });
  await page.waitForLoadState('networkidle');

  const report = { label: LABEL, base: BASE_URL, samples: SAMPLES, routes: [] };
  for (const route of routes) {
    const runs = [];
    for (let sample = 0; sample < SAMPLES; sample += 1) runs.push(await visit(page, { ...route, path: `${BASE_URL}${route.path}` }));
    report.routes.push({
      route: route.name,
      firstUsableMs: { first: runs[0].firstUsableMs, median: median(runs.map((run) => run.firstUsableMs)), max: Math.max(...runs.map((run) => run.firstUsableMs)) },
      finalMs: route.final ? { first: runs[0].finalMs, median: median(runs.map((run) => run.finalMs)), max: Math.max(...runs.map((run) => run.finalMs)) } : null,
      apiRequests: runs[0].apiRequests,
      apiBytes: runs[0].apiBytes,
      endpoints: runs[0].endpoints,
      serverTiming: runs[runs.length - 1].serverTiming,
    });
  }
  await browser.close();
  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
