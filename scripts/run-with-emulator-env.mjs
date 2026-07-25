import { spawn } from 'node:child_process';

const env = {
  ...process.env,
  USE_FIREBASE_EMULATORS: 'true',
  NEXT_PUBLIC_FIREBASE_EMULATOR_HOST: '127.0.0.1',
  FB_CREDENTIAL: 'demo-api-key',
  FB_AUTH_DOMAIN: 'demo-serenity.firebaseapp.com',
  FB_PROJECT: 'demo-serenity',
  FB_BUCKET: 'demo-serenity.appspot.com',
  FB_SENDER: '000000000000',
  FB_APP: '1:000000000000:web:demo',
  FIREBASE_ADMIN_PROJECT_ID: 'demo-serenity',
  FIREBASE_AUTH_EMULATOR_HOST: '127.0.0.1:9099',
  FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080',
  FIREBASE_STORAGE_EMULATOR_HOST: '127.0.0.1:9199',
  NEXT_PUBLIC_SITE_URL: 'http://127.0.0.1:3000',
  DAILY_IP_SALT: 'local-demo-salt',
  ENABLE_BULK_EMAIL_API: 'false',
};

const child = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'dev'], {
  env,
  stdio: 'inherit',
  shell: false,
});

child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 1);
});
