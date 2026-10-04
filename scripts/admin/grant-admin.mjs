#!/usr/bin/env node
/**
 * Grants or removes operator-console access for one Firebase account by
 * setting the `serenityAdmin` custom claim. Custom claims can only be changed
 * with the service account, so this script (not any route in the app) is the
 * only way to create an operator.
 *
 *   Production:  node --env-file=.env.local scripts/admin/grant-admin.mjs --email you@example.com --project <projectId>
 *   Remove:      ... --revoke
 *   Emulators:   FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 FIREBASE_ADMIN_PROJECT_ID=demo-serenity node scripts/admin/grant-admin.mjs --email ...
 *
 * The operator must sign out and back in (or wait for the hourly token
 * refresh) before the claim takes effect. Removing access also revokes the
 * account's refresh tokens, which ends any open console session.
 */
import { connect, hasFlag, readFlag } from './lib/firebase.mjs';

const CLAIM = 'serenityAdmin';

async function main() {
  const argv = process.argv.slice(2);
  const email = readFlag(argv, '--email');
  if (!email) throw new Error('Usage: grant-admin.mjs --email <address> [--revoke] [--project <projectId>]');

  const { auth, projectId, emulator } = connect(argv);
  const user = await auth.getUserByEmail(email);
  const claims = { ...(user.customClaims || {}) };

  if (hasFlag(argv, '--revoke')) {
    delete claims[CLAIM];
    await auth.setCustomUserClaims(user.uid, claims);
    await auth.revokeRefreshTokens(user.uid);
    console.log(`Removed console access for ${email} (${user.uid}) in ${projectId}${emulator ? ' [emulator]' : ''}.`);
    return;
  }

  if (!user.emailVerified) {
    throw new Error(`${email} has not verified its email address; the console requires a verified account.`);
  }

  claims[CLAIM] = true;
  await auth.setCustomUserClaims(user.uid, claims);
  console.log(`Granted console access to ${email} (${user.uid}) in ${projectId}${emulator ? ' [emulator]' : ''}.`);
  console.log('Sign out and back in before unlocking the console.');
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
