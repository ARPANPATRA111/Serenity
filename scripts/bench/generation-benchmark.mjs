/**
 * Batch generation benchmark against the local emulator build.
 *
 *   pnpm emulators            (separate terminal)
 *   pnpm build:emulator && pnpm start:emulator
 *   node scripts/bench/generation-benchmark.mjs [rows...]   (default: 50 200 500)
 *
 * Signs in a premium emulator account, imports N rows into the curated
 * "Academic Course Completion" template and generates without email. Reports
 * wall time, certificates per second, peak JS heap and ZIP size. Never talks to
 * production: it refuses to run unless the app is on 127.0.0.1 and the
 * Firebase emulators are reachable.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { chromium } from '@playwright/test';
import { getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

const BASE_URL = 'http://127.0.0.1:3000';
const USER = { uid: 'bench-user', email: 'bench-user@example.test', password: 'Test-only-123!' };
const sizes = process.argv.slice(2).map(Number).filter((value) => value > 0);
const ROWS = sizes.length > 0 ? sizes : [50, 200, 500];

process.env.FIRESTORE_EMULATOR_HOST ||= '127.0.0.1:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST ||= '127.0.0.1:9099';

async function assertLocal() {
  for (const url of ['http://127.0.0.1:9099/', 'http://127.0.0.1:8080/', BASE_URL]) {
    try { await fetch(url); } catch { throw new Error(`${url} is not reachable; start the emulators and the local build first.`); }
  }
}

function admin() {
  const app = getApps()[0] || initializeApp({ projectId: 'demo-serenity' });
  return { auth: getAuth(app), db: getFirestore(app) };
}

async function resetUser() {
  const { auth, db } = admin();
  for (const collection of ['certificates', 'templates', 'generationBatches', 'certificatePreviews']) {
    const owned = await db.collection(collection).where('userId', '==', USER.uid).get();
    for (let index = 0; index < owned.docs.length; index += 400) {
      const batch = db.batch();
      owned.docs.slice(index, index + 400).forEach((doc) => batch.delete(doc.ref));
      await batch.commit();
    }
  }
  try {
    await auth.updateUser(USER.uid, { email: USER.email, password: USER.password, emailVerified: true });
  } catch {
    await auth.createUser({ uid: USER.uid, email: USER.email, password: USER.password, emailVerified: true, displayName: 'Bench User' });
  }
  await db.collection('users').doc(USER.uid).set({
    id: USER.uid, email: USER.email, name: 'Bench User', emailVerified: true, isPremium: true, certificatesGenerated: 0, createdAt: new Date(),
  });
}

/**
 * Resident memory of the benchmark's Chromium processes in MB. Generated PDFs
 * and the ZIP are Blobs held outside the JS heap, so the heap alone understates
 * what a large batch costs the user's machine. Windows only (tasklist).
 */
function browserMemoryMB() {
  if (process.platform !== 'win32') return 0;
  try {
    // Playwright's headless Chromium only; the user's own Chrome is not counted.
    const output = execFileSync('tasklist', ['/FI', 'IMAGENAME eq chrome-headless-shell.exe', '/FO', 'CSV', '/NH'], { encoding: 'utf8' });
    return output.split(/\r?\n/).reduce((sum, line) => {
      const match = line.match(/"([\d,.]+) K"$/);
      return match ? sum + Number(match[1].replace(/[,.]/g, '')) / 1024 : sum;
    }, 0);
  } catch {
    return 0;
  }
}

function csv(rows) {
  const lines = ['Name,Issuer,Date'];
  for (let index = 0; index < rows; index += 1) lines.push(`Recipient ${String(index + 1).padStart(4, '0')} Example,Kestrel Ridge Learning Studio,5 October 2026`);
  return Buffer.from(lines.join('\n'), 'utf8');
}

async function run(rows) {
  await resetUser();
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
  // Batches over 100 rows ask for confirmation; answer as a user would.
  page.on('dialog', (dialog) => void dialog.accept());
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Performance.enable');

  await page.goto(`${BASE_URL}/login`);
  await page.locator('#login-email').fill(USER.email);
  await page.locator('#login-password').fill(USER.password);
  await page.getByRole('button', { name: /^sign in$/i }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 60_000 });

  await page.goto(`${BASE_URL}/editor?template=curated-academic-course`);
  const upload = page.locator('input[type="file"][accept=".csv,.xlsx,.xls,.ods"]');
  await upload.waitFor({ state: 'attached', timeout: 60_000 });
  await upload.setInputFiles({ name: 'recipients.csv', mimeType: 'text/csv', buffer: csv(rows) });
  await page.getByTitle('Generate').waitFor({ state: 'visible' });
  await page.waitForFunction(() => !document.querySelector('[title="Generate"]')?.hasAttribute('disabled'), null, { timeout: 60_000 });

  const heap = async () => {
    const { metrics } = await cdp.send('Performance.getMetrics');
    return metrics.find((metric) => metric.name === 'JSHeapUsedSize').value;
  };
  const baselineHeap = await heap();
  const baselineProcessMB = browserMemoryMB();
  let peakHeap = baselineHeap;
  let peakProcessMB = baselineProcessMB;
  let sampling = true;
  const sampler = (async () => {
    while (sampling) {
      peakHeap = Math.max(peakHeap, await heap().catch(() => 0));
      peakProcessMB = Math.max(peakProcessMB, browserMemoryMB());
      await new Promise((resolve) => setTimeout(resolve, 300));
    }
  })();

  await page.getByTitle('Generate').click();
  const downloadPromise = page.waitForEvent('download', { timeout: 15 * 60_000 });
  const started = Date.now();
  await page.getByRole('button', { name: 'Start Generation' }).click();
  // Progress lines on stderr, so a stalled batch is visible while it runs.
  const progress = setInterval(() => {
    void page.locator('text=/Processing \d+ of \d+|Saving|Uploading|All Done|failed|error/i').first().textContent({ timeout: 2_000 })
      .then((text) => console.error(`[${rows}] ${Math.round((Date.now() - started) / 1000)}s ${text?.trim()} | browser ${Math.round(browserMemoryMB())} MB`))
      .catch(() => console.error(`[${rows}] ${Math.round((Date.now() - started) / 1000)}s (no progress text) | browser ${Math.round(browserMemoryMB())} MB`));
  }, 10_000);
  let download;
  try {
    download = await downloadPromise;
  } catch (error) {
    await page.screenshot({ path: `generation-benchmark-${rows}-failure.png` }).catch(() => undefined);
    throw error;
  } finally {
    clearInterval(progress);
  }
  const renderedSeconds = (Date.now() - started) / 1000;
  await page.getByText('All Done!').waitFor({ timeout: 30 * 60_000 });
  const totalSeconds = (Date.now() - started) / 1000;
  sampling = false;
  await sampler;

  const zipBytes = readFileSync(await download.path()).length;
  const saved = (await admin().db.collection('certificates').where('userId', '==', USER.uid).count().get()).data().count;
  const previews = await admin().db.collection('certificatePreviews').where('userId', '==', USER.uid).select('bytes').get();
  const previewKB = previews.size ? Math.round(previews.docs.reduce((sum, doc) => sum + (doc.get('bytes') || 0), 0) / previews.size / 1024) : null;
  await browser.close();
  return {
    rows,
    saved,
    zipDownloadedAfterSeconds: Number(renderedSeconds.toFixed(1)),
    totalSeconds: Number(totalSeconds.toFixed(1)),
    certificatesPerSecond: Number((rows / totalSeconds).toFixed(2)),
    peakHeapMB: Number((peakHeap / 1048576).toFixed(0)),
    heapGrowthMB: Number(((peakHeap - baselineHeap) / 1048576).toFixed(0)),
    browserMemoryGrowthMB: Math.round(peakProcessMB - baselineProcessMB),
    zipMB: Number((zipBytes / 1048576).toFixed(1)),
    zipKBPerCertificate: Math.round(zipBytes / rows / 1024),
    previewsStoredInFirestore: previews.size,
    averagePreviewKB: previewKB,
  };
}

await assertLocal();
const results = [];
for (const rows of ROWS) {
  const result = await run(rows);
  results.push(result);
  console.log(JSON.stringify(result));
}
await resetUser();
console.table(results);
process.exit(0);
