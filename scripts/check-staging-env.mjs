#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const groups = [
  {
    title: 'required for build',
    required: true,
    names: [
      'FB_CREDENTIAL',
      'FB_AUTH_DOMAIN',
      'FB_PROJECT',
      'FB_BUCKET',
      'FB_SENDER',
      'FB_APP',
      'NEXT_PUBLIC_SITE_URL',
    ],
  },
  {
    title: 'required for server runtime',
    required: true,
    names: [
      'FIREBASE_ADMIN_PROJECT_ID',
      'FIREBASE_ADMIN_CLIENT_EMAIL',
      'FIREBASE_ADMIN_PRIVATE_KEY',
      'BLOB_READ_WRITE_TOKEN',
      'DAILY_IP_SALT',
    ],
  },
  {
    title: 'required for email test',
    required: true,
    names: [
      'SEND_IN_BLUE_API_KEY',
      'BREVO_SENDER_EMAIL',
      'EMAIL_SENDER_NAME',
    ],
  },
  {
    title: 'optional',
    required: false,
    names: [
      'DAILY_EMAIL_LIMIT',
      'FREE_BULK_EMAIL_LIMIT',
      'ENABLE_BULK_EMAIL_API',
      'CERTIFICATE_MEDIA_HOSTS',
      'RESEND_API_KEY',
    ],
  },
];

const publicIdentifierNames = new Set([
  'FB_AUTH_DOMAIN',
  'FB_PROJECT',
  'FB_BUCKET',
  'FIREBASE_ADMIN_PROJECT_ID',
  'NEXT_PUBLIC_SITE_URL',
  'BREVO_SENDER_EMAIL',
  'EMAIL_SENDER_NAME',
]);

const obviousProductionPatterns = [
  /(^|[-_.])prod($|[-_.])/i,
  /production/i,
  /^https?:\/\/serenity-certificate\.vercel\.app(?:\/|$)/i,
  /^https?:\/\/(?:www\.)?serenity\.app(?:\/|$)/i,
];

const stagingMarkers = [
  /(^|[-_.])staging($|[-_.])/i,
  /(^|[-_.])stage($|[-_.])/i,
  /(^|[-_.])test($|[-_.])/i,
  /(^|[-_.])dev($|[-_.])/i,
  /preview/i,
  /sandbox/i,
  /localhost/i,
  /127\.0\.0\.1/i,
];

function parseArgs(argv) {
  const result = { envFile: process.env.STAGING_ENV_FILE || '' };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--env-file') {
      result.envFile = argv[i + 1] || '';
      i += 1;
    } else if (arg.startsWith('--env-file=')) {
      result.envFile = arg.slice('--env-file='.length);
    }
  }

  return result;
}

function parseEnvFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const parsed = {};

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const equalsIndex = line.indexOf('=');
    if (equalsIndex <= 0) continue;

    const key = line.slice(0, equalsIndex).trim();
    let value = line.slice(equalsIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    parsed[key] = value;
  }

  return parsed;
}

function hasValue(envMap, name) {
  return typeof envMap[name] === 'string' && envMap[name].trim().length > 0;
}

function looksProduction(value) {
  return obviousProductionPatterns.some((pattern) => pattern.test(value));
}

function hasStagingMarker(value) {
  return stagingMarkers.some((pattern) => pattern.test(value));
}

function main() {
  const { envFile } = parseArgs(process.argv.slice(2));
  const envMap = { ...process.env };
  const warnings = [];
  const failures = [];

  if (envFile) {
    const resolved = path.resolve(envFile);
    if (!fs.existsSync(resolved)) {
      failures.push(`Env file not found: ${envFile}`);
    } else if (path.basename(resolved) === '.env.local') {
      failures.push('Refusing to use .env.local for staging checks without an explicitly staging-only env file.');
    } else {
      Object.assign(envMap, parseEnvFile(resolved));
      console.log(`Env source: ${envFile}`);
    }
  } else {
    console.log('Env source: current process environment only');
    warnings.push('No staging env file supplied. Use --env-file .env.staging.local for a local staging-only file.');
  }

  console.log('\nStaging environment variable presence:');

  for (const group of groups) {
    console.log(`\n${group.title}:`);
    for (const name of group.names) {
      const present = hasValue(envMap, name);
      console.log(`- ${name}: ${present ? 'present' : 'missing'}`);
      if (group.required && !present) {
        failures.push(`${name} is missing (${group.title})`);
      }
    }
  }

  const identifierValues = [];
  for (const name of publicIdentifierNames) {
    if (hasValue(envMap, name)) {
      identifierValues.push({ name, value: envMap[name] });
    }
  }

  for (const { name, value } of identifierValues) {
    if (looksProduction(value)) {
      failures.push(`${name} looks production-like. Refusing to treat this as staging.`);
    } else if (!hasStagingMarker(value)) {
      warnings.push(`${name} does not clearly look like staging/test/dev/preview.`);
    }
  }

  console.log('\nSafety warnings:');
  if (warnings.length === 0) {
    console.log('- none');
  } else {
    for (const warning of warnings) {
      console.log(`- ${warning}`);
    }
  }

  console.log('\nResult:');
  if (failures.length > 0) {
    console.log('FAIL');
    for (const failure of failures) {
      console.log(`- ${failure}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log('PASS');
  if (warnings.length > 0) {
    console.log('Review warnings before using this environment for staging verification.');
  }
}

main();
