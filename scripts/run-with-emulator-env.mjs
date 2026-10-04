import { spawn } from 'node:child_process';
import { emulatorEnv } from './lib/emulator-env.mjs';

// Usage: node scripts/run-with-emulator-env.mjs [dev|start|build] [port]
const mode = process.argv[2] || 'dev';
const port = Number(process.argv[3] || process.env.PORT || 3000);

if (!['dev', 'start', 'build'].includes(mode)) {
  console.error(`Unknown mode "${mode}". Use dev, start, or build.`);
  process.exit(1);
}

const env = {
  ...process.env,
  ...emulatorEnv({ port }),
};

const args = ['node_modules/next/dist/bin/next', mode];
if (mode !== 'build') args.push('-p', String(port), '-H', '127.0.0.1');

const child = spawn(process.execPath, args, {
  env,
  stdio: 'inherit',
  shell: false,
});

child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 1);
});
