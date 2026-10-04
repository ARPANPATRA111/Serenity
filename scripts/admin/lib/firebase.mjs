import { cert, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

/**
 * Admin SDK bootstrap for operator scripts.
 *
 * Against the emulators (FIREBASE_AUTH_EMULATOR_HOST set) only demo-* projects
 * are accepted. Against a real project the service-account variables must be
 * present (for example `node --env-file=.env.local ...`) and the operator must
 * repeat the project ID with --project, so a script never touches a project by
 * accident.
 */
export function connect(argv) {
  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID || process.env.FB_PROJECT;
  if (!projectId) throw new Error('FIREBASE_ADMIN_PROJECT_ID is not set.');

  const emulator = Boolean(process.env.FIREBASE_AUTH_EMULATOR_HOST || process.env.FIRESTORE_EMULATOR_HOST);
  if (emulator && !projectId.startsWith('demo-')) {
    throw new Error('Emulator mode requires a demo-* project ID.');
  }

  const confirmed = readFlag(argv, '--project');
  if (!emulator && confirmed !== projectId) {
    throw new Error(`Refusing to run against "${projectId}" without --project ${projectId}.`);
  }

  const app = initializeApp(emulator
    ? { projectId }
    : {
        projectId,
        credential: cert({
          projectId,
          clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        }),
      });

  return { projectId, emulator, auth: getAuth(app), db: getFirestore(app) };
}

export function readFlag(argv, name) {
  const index = argv.indexOf(name);
  if (index === -1) return null;
  const value = argv[index + 1];
  return value && !value.startsWith('--') ? value : null;
}

export function hasFlag(argv, name) {
  return argv.includes(name);
}
