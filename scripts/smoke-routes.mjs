import { spawn } from 'node:child_process';

const port = 3199;
const baseUrl = `http://127.0.0.1:${port}`;
const env = {
  ...process.env,
  FB_CREDENTIAL: 'placeholder',
  FB_AUTH_DOMAIN: 'placeholder.firebaseapp.com',
  FB_PROJECT: 'placeholder-project',
  FB_BUCKET: 'placeholder.appspot.com',
  FB_SENDER: '000000000000',
  FB_APP: '1:000000000000:web:placeholder',
  FIREBASE_ADMIN_PROJECT_ID: 'placeholder-project',
  FIREBASE_ADMIN_CLIENT_EMAIL: 'placeholder@example.invalid',
  FIREBASE_ADMIN_PRIVATE_KEY: '-----BEGIN PRIVATE KEY-----\nplaceholder\n-----END PRIVATE KEY-----',
  DAILY_IP_SALT: 'placeholder',
  NEXT_PUBLIC_SITE_URL: baseUrl,
};

const child = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '-p', String(port)], {
  env,
  stdio: ['ignore', 'pipe', 'pipe'],
  shell: false,
});

let output = '';
child.stdout.on('data', (chunk) => { output += chunk.toString(); });
child.stderr.on('data', (chunk) => { output += chunk.toString(); });

async function waitForServer() {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (child.exitCode !== null) throw new Error(`Server exited before smoke tests.\n${output}`);
    try {
      const response = await fetch(baseUrl);
      if (response.status < 500) return;
    } catch {
      // Server is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Timed out waiting for the production server.\n${output}`);
}

try {
  await waitForServer();
  const routes = ['/', '/login', '/signup', '/dashboard', '/events', '/history', '/editor', '/templates', '/verify'];
  const results = await Promise.all(routes.map(async (route) => {
    const response = await fetch(`${baseUrl}${route}`, { redirect: 'manual' });
    if (response.status >= 500) throw new Error(`${route} returned ${response.status}`);
    return `${route} ${response.status}`;
  }));
  console.log(`Route smoke passed:\n${results.join('\n')}`);
} finally {
  child.kill('SIGTERM');
  await Promise.race([
    new Promise((resolve) => child.once('exit', resolve)),
    new Promise((resolve) => setTimeout(resolve, 2_000)),
  ]);
  if (child.exitCode === null) child.kill('SIGKILL');
}
