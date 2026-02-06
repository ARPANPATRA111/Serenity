const firebaseEnvVars = [
  'FB_CREDENTIAL',
  'FB_AUTH_DOMAIN',
  'FB_PROJECT',
  'FB_BUCKET',
  'FB_SENDER',
  'FB_APP',
] as const;

const serverOnlyEnvVars = [
  'FIREBASE_ADMIN_PROJECT_ID',
  'FIREBASE_ADMIN_CLIENT_EMAIL',
  'FIREBASE_ADMIN_PRIVATE_KEY',
  'RESEND_API_KEY',
  'DAILY_IP_SALT',
] as const;

const optionalEnvVars = [
  'BLOB_READ_WRITE_TOKEN', // Vercel Blob for media storage
] as const;

export function validateEnv(): void {
  const missing: string[] = [];

  if (typeof window === 'undefined') {
    for (const varName of firebaseEnvVars) {
      if (!process.env[varName]) {
        missing.push(varName);
      }
    }

    for (const varName of serverOnlyEnvVars) {
      if (!process.env[varName]) {
        missing.push(varName);
      }
    }
  }

  if (missing.length > 0) {
    console.warn(
      `⚠️  Missing environment variables:\n${missing.map((v) => `  - ${v}`).join('\n')}\n` +
      'Please check your .env.local file.'
    );
  }
}

// Run validation in development
if (process.env.NODE_ENV === 'development') {
  validateEnv();
}
