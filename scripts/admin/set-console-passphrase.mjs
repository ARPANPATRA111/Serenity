#!/usr/bin/env node
/**
 * Sets (or rotates) the operator-console passphrase. Only a scrypt hash is
 * stored, in Firestore `_adminSecrets/console`, which browser clients cannot
 * read (see firestore.rules). Rotating also clears any unlock lockout.
 *
 *   Production:  node --env-file=.env.local scripts/admin/set-console-passphrase.mjs --project <projectId>
 *   Emulators:   FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 FIREBASE_ADMIN_PROJECT_ID=demo-serenity node scripts/admin/set-console-passphrase.mjs
 *   Scripted:    ... --from-env CONSOLE_PASSPHRASE   (reads the passphrase from that variable)
 *
 * The passphrase is typed without echo and never printed or logged.
 */
import readline from 'node:readline';
import { connect, readFlag } from './lib/firebase.mjs';
import { hashPassphrase, MIN_PASSPHRASE_LENGTH } from './lib/passphrase.mjs';

function promptHidden(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    let muted = false;
    rl._writeToOutput = (text) => {
      if (!muted) rl.output.write(text);
    };
    rl.question(question, (answer) => {
      rl.close();
      process.stdout.write('\n');
      resolve(answer);
    });
    muted = true;
  });
}

async function main() {
  const argv = process.argv.slice(2);
  const { db, projectId, emulator } = connect(argv);

  let passphrase;
  const fromEnv = readFlag(argv, '--from-env');
  if (fromEnv) {
    passphrase = process.env[fromEnv];
    if (!passphrase) throw new Error(`Environment variable ${fromEnv} is empty.`);
  } else {
    if (!process.stdin.isTTY) throw new Error('Run this in an interactive terminal, or use --from-env.');
    console.log(`Setting the console passphrase for ${projectId}${emulator ? ' [emulator]' : ''}.`);
    console.log(`Use at least ${MIN_PASSPHRASE_LENGTH} characters; a few unrelated words work well.`);
    passphrase = await promptHidden('New passphrase: ');
    const repeated = await promptHidden('Repeat passphrase: ');
    if (passphrase !== repeated) throw new Error('The passphrases do not match. Nothing was changed.');
  }

  const passphraseHash = await hashPassphrase(passphrase);
  const now = new Date().toISOString();
  const secrets = db.collection('_adminSecrets');
  await secrets.doc('console').set({ passphraseHash, updatedAt: now, updatedBy: 'cli' });
  await secrets.doc('lockout').set({ failures: 0, windowStart: 0, lockedUntil: 0, updatedAt: now });
  await db.collection('adminAuditLog').add({
    at: now,
    action: 'console.passphrase_set',
    actorUid: null,
    actorEmail: 'cli',
    target: null,
    details: {},
    clientHash: null,
  });

  console.log('Console passphrase stored (hash only).');
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
