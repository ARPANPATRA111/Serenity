import { readdirSync, readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { expect, type Page } from '@playwright/test';
import { getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

process.env.FIRESTORE_EMULATOR_HOST ||= '127.0.0.1:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST ||= '127.0.0.1:9099';

export const PASSWORD = 'Test-only-123!';
export const CONSOLE_PATH = '/ops/local-console-key-0123456789';
export const CONSOLE_PASSPHRASE = 'local-console-passphrase';
export const REAL_BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36';

export function admin() {
  const app = getApps()[0] || initializeApp({ projectId: 'demo-serenity' });
  return { db: getFirestore(app), auth: getAuth(app) };
}

/** ID token straight from the Auth emulator, for API-level checks. */
export async function idTokenFor(email: string, password = PASSWORD): Promise<string> {
  const response = await fetch(
    'http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo-api-key',
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password, returnSecureToken: true }) },
  );
  const body = await response.json() as { idToken?: string };
  if (!body.idToken) throw new Error(`Could not sign in ${email} on the Auth emulator`);
  return body.idToken;
}

/** Creates (or resets) a verified test account with a fresh profile. */
export async function ensureUser(uid: string, email: string, profile: Record<string, unknown> = {}) {
  const { auth, db } = admin();
  try {
    await auth.getUser(uid);
    await auth.updateUser(uid, { email, password: PASSWORD, emailVerified: true });
  } catch {
    await auth.createUser({ uid, email, password: PASSWORD, emailVerified: true, displayName: uid });
  }
  await db.collection('users').doc(uid).set({
    id: uid,
    email,
    name: uid,
    emailVerified: true,
    isPremium: false,
    certificatesGenerated: 0,
    createdAt: new Date(),
    ...profile,
  });
}

export async function signIn(page: Page, email: string, password = PASSWORD) {
  await page.goto('/login');
  await page.locator('#login-email').fill(email);
  await page.locator('#login-password').fill(password);
  await page.getByRole('button', { name: /^sign in$/i }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 60_000 });
}

export async function expectNoHorizontalOverflow(page: Page, label: string) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow, `${label} overflows horizontally by ${overflow}px`).toBeLessThanOrEqual(1);
}

export interface OutboxMessage {
  messageId: string;
  to: Array<{ email: string; name?: string }>;
  subject: string;
  html: string;
  attachments: Array<{ filename: string; bytes: number }>;
}

export function readOutbox(): OutboxMessage[] {
  const directory = path.join(process.cwd(), '.local-object-store', 'outbox');
  if (!existsSync(directory)) return [];
  return readdirSync(directory)
    .filter((file) => file.endsWith('.json'))
    .map((file) => JSON.parse(readFileSync(path.join(directory, file), 'utf8')) as OutboxMessage);
}

export async function unlockConsole(page: Page, email = 'ops-admin@example.test') {
  await page.goto(CONSOLE_PATH);
  const emailField = page.locator('#console-email');
  const passphraseField = page.locator('#console-passphrase');
  // The panel first checks for an existing session; wait for whichever form it settles on.
  await expect(emailField.or(passphraseField)).toBeVisible({ timeout: 30_000 });
  if (await emailField.isVisible()) {
    await emailField.fill(email);
    await page.locator('#console-password').fill(PASSWORD);
    await page.getByRole('button', { name: /^sign in$/i }).click();
  }
  await page.locator('#console-passphrase').fill(CONSOLE_PASSPHRASE);
  await page.getByRole('button', { name: /unlock console/i }).click();
  await expect(page.getByRole('heading', { name: 'Overview' })).toBeVisible({ timeout: 60_000 });
}
