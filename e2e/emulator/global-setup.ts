import { spawnSync } from 'node:child_process';
import { rmSync } from 'node:fs';
import path from 'node:path';

async function reachable(url: string): Promise<boolean> {
  try {
    await fetch(url);
    return true;
  } catch {
    return false;
  }
}

export default async function globalSetup() {
  const emulators = ['http://127.0.0.1:9099/', 'http://127.0.0.1:8080/'];
  for (const url of emulators) {
    if (!(await reachable(url))) {
      throw new Error(`Firebase emulator not reachable at ${url}. Start them with "pnpm emulators" first.`);
    }
  }

  // Start every run from the same dataset.
  const seed = spawnSync(process.execPath, ['scripts/seed-emulator.mjs'], {
    stdio: 'inherit',
    env: {
      ...process.env,
      FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080',
      FIREBASE_AUTH_EMULATOR_HOST: '127.0.0.1:9099',
      FIREBASE_ADMIN_PROJECT_ID: 'demo-serenity',
    },
  });
  if (seed.status !== 0) throw new Error('Seeding the emulator failed');

  rmSync(path.join(process.cwd(), '.local-object-store', 'outbox'), { recursive: true, force: true });
}
