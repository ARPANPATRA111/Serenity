const requiredEnvVars = [
  'NEXT_PUBLIC_FIREBASE_API_KEY',
  'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
  'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
  'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET',
  'NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
  'NEXT_PUBLIC_FIREBASE_APP_ID',
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

  // Check client-side vars
  for (const varName of requiredEnvVars) {
    if (!process.env[varName]) {
      missing.push(varName);
    }
  }

  // Check server-side vars only on server
  if (typeof window === 'undefined') {
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
