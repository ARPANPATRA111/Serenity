import { expect, test } from '@playwright/test';
import { CONSOLE_PASSPHRASE, CONSOLE_PATH, PASSWORD, admin, idTokenFor, unlockConsole } from './helpers';

/**
 * Operator console: hidden, locked, audited, and read-budget aware.
 */

const today = new Date().toISOString().slice(0, 10);

async function resetConsoleState() {
  const { db } = admin();
  await db.collection('_adminSecrets').doc('lockout').set({ failures: 0, windowStart: 0, lockedUntil: 0 });
  await db.collection('_adminUsage').doc(today).delete().catch(() => undefined);
}

test.describe('operator console', () => {
  test.beforeEach(resetConsoleState);
  test.afterAll(resetConsoleState);

  test('is indistinguishable from a missing page without the path key', async ({ request }) => {
    for (const path of ['/ops', '/ops/', '/ops/wrong-key-00000000000', '/ops/local-console-key-012345678']) {
      expect((await request.get(path)).status(), path).toBe(404);
    }
    const unknown = await request.get('/definitely-not-a-page');
    expect(unknown.status()).toBe(404);
  });

  test('console APIs answer 404 without a session, with or without the request header', async ({ request }) => {
    for (const path of ['/api/console/session', '/api/console/overview', '/api/console/users', '/api/console/audit']) {
      expect((await request.get(path)).status()).toBe(404);
      expect((await request.get(path, { headers: { 'x-serenity-console': '1' } })).status()).toBe(404);
    }
    const unlock = await request.post('/api/console/session', {
      headers: { 'x-serenity-console': '1' },
      data: { passphrase: CONSOLE_PASSPHRASE },
    });
    expect(unlock.status()).toBe(404);
  });

  test('an ordinary account cannot open the console even with the passphrase', async ({ page, request }) => {
    const idToken = await idTokenFor('user-a@example.test');
    const response = await request.post('/api/console/session', {
      headers: { 'x-serenity-console': '1', Authorization: `Bearer ${idToken}` },
      data: { passphrase: CONSOLE_PASSPHRASE },
    });
    expect(response.status()).toBe(404);

    await page.goto(CONSOLE_PATH);
    await page.locator('#console-email').fill('user-a@example.test');
    await page.locator('#console-password').fill(PASSWORD);
    await page.getByRole('button', { name: /^sign in$/i }).click();
    await page.locator('#console-passphrase').fill(CONSOLE_PASSPHRASE);
    await page.getByRole('button', { name: /unlock console/i }).click();
    await expect(page.locator('#console-unlock-error')).toContainText('This account cannot open the console.');
  });

  test('the operator needs the passphrase, and the session cookie is locked down', async ({ page, context }) => {
    await page.goto(CONSOLE_PATH);
    await page.locator('#console-email').fill('ops-admin@example.test');
    await page.locator('#console-password').fill(PASSWORD);
    await page.getByRole('button', { name: /^sign in$/i }).click();

    await page.locator('#console-passphrase').fill('not the passphrase');
    await page.getByRole('button', { name: /unlock console/i }).click();
    await expect(page.locator('#console-unlock-error')).toContainText('That passphrase is not correct.');

    await page.locator('#console-passphrase').fill(CONSOLE_PASSPHRASE);
    await page.getByRole('button', { name: /unlock console/i }).click();
    await expect(page.getByRole('heading', { name: 'Overview' })).toBeVisible({ timeout: 60_000 });

    const cookie = (await context.cookies()).find((entry) => entry.name.includes('serenity-console'));
    expect(cookie).toBeDefined();
    expect(cookie!.httpOnly).toBe(true);
    expect(cookie!.sameSite).toBe('Strict');

    // The failed attempt is in the audit log.
    await page.getByRole('button', { name: 'Audit log' }).click();
    await expect(page.getByText('Failed unlock attempt').first()).toBeVisible();
    await expect(page.getByText('Console unlocked').first()).toBeVisible();
  });

  test('overview shows usage, charts with table views, and the read meter', async ({ page }) => {
    await unlockConsole(page);
    for (const label of ['Accounts', 'Active in 7 days', 'Certificates issued', 'Accounts that issued', 'Pro accounts', 'Certificates emailed', 'Verification views']) {
      await expect(page.getByText(label, { exact: true }).first()).toBeVisible();
    }
    const chart = page.getByRole('figure', { name: 'Certificates issued per day' });
    await expect(chart).toBeVisible();
    await chart.getByRole('button', { name: 'Table' }).click();
    await expect(chart.getByRole('table')).toBeVisible();
    await expect(chart.getByRole('row')).toHaveCount(15);
    await expect(page.getByRole('meter', { name: 'Console reads used today' }).first()).toBeAttached();
  });

  test('requests without the console header are refused even with a valid session (CSRF)', async ({ page }) => {
    await unlockConsole(page);
    const withoutHeader = await page.request.post('/api/console/users/user-b/premium', { data: { action: 'grant' } });
    expect(withoutHeader.status()).toBe(404);
    const crossSite = await page.request.post('/api/console/users/user-b/premium', {
      headers: { 'x-serenity-console': '1', Origin: 'https://attacker.example' },
      data: { action: 'grant' },
    });
    expect(crossSite.status()).toBe(404);
    expect((await admin().db.collection('users').doc('user-b').get()).get('isPremium')).toBe(false);
  });

  test('grants and removes Pro, which changes the account\'s real allowance and is audited', async ({ page }) => {
    await unlockConsole(page);
    await page.getByRole('button', { name: 'Users', exact: true }).click();
    await page.getByLabel('Search users').fill('user-b@example.test');
    await page.getByLabel('Search users').press('Enter');
    await page.getByRole('button', { name: /User B/ }).click();

    const drawer = page.getByRole('dialog', { name: 'User B' });
    await expect(drawer.getByText('user-b@example.test').first()).toBeVisible();
    await drawer.getByRole('button', { name: '3 months' }).click();
    await drawer.getByLabel('Note for the audit log (optional)').fill('E2E: paid invoice #1042');
    await drawer.getByRole('button', { name: 'Review grant' }).click();
    await expect(drawer.getByRole('alert')).toContainText('Grant Pro to user-b@example.test until');
    await drawer.getByRole('button', { name: 'Confirm' }).click();
    await expect(drawer.getByRole('status')).toHaveText('Pro granted.');
    await expect(drawer.getByText(/^Pro until /).first()).toBeVisible();

    // The account's server-side allowance reflects the plan immediately.
    const token = await idTokenFor('user-b@example.test');
    const premium = await (await fetch('http://127.0.0.1:3000/api/users/premium', { headers: { Authorization: `Bearer ${token}` } })).json();
    expect(premium).toMatchObject({ isPremium: true, canGenerate: true });
    expect(Date.parse(premium.premiumUntil)).toBeGreaterThan(Date.now() + 80 * 86_400_000);

    await drawer.getByRole('radio', { name: 'Remove Pro' }).click();
    await drawer.getByRole('button', { name: 'Review removal' }).click();
    await drawer.getByRole('button', { name: 'Confirm' }).click();
    await expect(drawer.getByRole('status')).toHaveText('Pro removed.');
    const after = await (await fetch('http://127.0.0.1:3000/api/users/premium', { headers: { Authorization: `Bearer ${token}` } })).json();
    expect(after.isPremium).toBe(false);

    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Audit log' }).click();
    await expect(page.getByText('Pro granted').first()).toBeVisible();
    await expect(page.getByText(/note: E2E: paid invoice #1042/).first()).toBeVisible();
    await expect(page.getByText('Pro removed').first()).toBeVisible();
  });

  test('shows certificates, batch recipients, deliveries, and Pro requests', async ({ page }) => {
    await unlockConsole(page);

    await page.getByRole('button', { name: 'Certificates', exact: true }).click();
    await expect(page.getByText('Demo Recipient 1', { exact: true }).first()).toBeVisible();

    await page.getByRole('button', { name: 'Batches', exact: true }).click();
    await page.getByRole('button', { name: /Course Completion/ }).first().click();
    const recipients = page.getByRole('dialog', { name: 'Course Completion' });
    await expect(recipients.getByText('recipient-1@example.test')).toBeVisible();
    await expect(recipients.getByRole('listitem')).toHaveCount(4);
    await page.keyboard.press('Escape');

    await page.getByRole('button', { name: 'Deliveries', exact: true }).click();
    await expect(page.getByText('recipient-1@example.test')).toBeVisible();

    await page.getByRole('button', { name: 'Pro requests', exact: true }).click();
    await expect(page.getByText('About 400 certificates per month')).toBeVisible();
    await page.getByRole('button', { name: 'Open account' }).first().click();
    await expect(page.getByRole('dialog', { name: 'User B' })).toBeVisible();
  });

  test('locking ends the session', async ({ page }) => {
    await unlockConsole(page);
    await page.getByRole('button', { name: 'Lock' }).click();
    await expect(page.locator('#console-passphrase')).toBeVisible();
    const response = await page.request.get('/api/console/overview', { headers: { 'x-serenity-console': '1' } });
    expect(response.status()).toBe(404);
  });

  test('repeated wrong passphrases pause unlocking', async ({ page }) => {
    await page.goto(CONSOLE_PATH);
    await page.locator('#console-email').fill('ops-admin@example.test');
    await page.locator('#console-password').fill(PASSWORD);
    await page.getByRole('button', { name: /^sign in$/i }).click();
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await page.locator('#console-passphrase').fill(`wrong passphrase ${attempt}`);
      await page.getByRole('button', { name: /unlock console/i }).click();
      await expect(page.locator('#console-unlock-error')).toBeVisible();
    }
    await expect(page.locator('#console-unlock-error')).toContainText('Too many incorrect passphrases');
    // Even the right passphrase is refused while paused.
    await page.locator('#console-passphrase').fill(CONSOLE_PASSPHRASE);
    await page.getByRole('button', { name: /unlock console/i }).click();
    await expect(page.locator('#console-unlock-error')).toContainText('Too many incorrect passphrases');
  });

  test('stops spending reads once the daily console budget is used', async ({ page }) => {
    await unlockConsole(page);
    await admin().db.collection('_adminUsage').doc(today).set({ reads: 999_999, requests: 1 });
    await page.getByRole('button', { name: 'Certificates', exact: true }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'console read budget' })).toBeVisible();
    await page.getByRole('button', { name: 'Load anyway' }).click();
    await expect(page.getByText('Demo Recipient 1', { exact: true }).first()).toBeVisible();
  });
});
