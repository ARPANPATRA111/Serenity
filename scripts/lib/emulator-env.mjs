/**
 * Environment for running the app against the local Firebase emulators.
 *
 * Next.js loads `.env.local` even when these variables are present, and only
 * variables that are already defined win. `.env.local` holds PRODUCTION
 * secrets, so every secret it contains is shadowed here with an inert value:
 * without this, "emulator" runs uploaded to the production Blob store and could
 * send real email through Brevo.
 */
export function emulatorEnv({ port = 3000, siteUrl } = {}) {
  const origin = siteUrl || `http://127.0.0.1:${port}`;
  return {
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
    NEXT_PUBLIC_SITE_URL: origin,
    DAILY_IP_SALT: 'local-demo-salt',
    ENABLE_BULK_EMAIL_API: 'false',
    EMAIL_TRANSPORT: process.env.EMAIL_TRANSPORT || 'json',

    // Inert stand-ins for production secrets from .env.local.
    FIREBASE_ADMIN_CLIENT_EMAIL: 'emulator-only@demo-serenity.iam.gserviceaccount.com',
    FIREBASE_ADMIN_PRIVATE_KEY: 'emulator-only-not-a-key',
    BLOB_READ_WRITE_TOKEN: 'emulator-only-disabled',
    SEND_IN_BLUE_API_KEY: 'emulator-only-disabled',
    RESEND_API_KEY: 'emulator-only-disabled',
    BREVO_SENDER_EMAIL: 'certificates@example.test',

    // Operator console: enabled locally with a fixed, test-only path key.
    ADMIN_CONSOLE_ENABLED: process.env.ADMIN_CONSOLE_ENABLED || 'true',
    ADMIN_CONSOLE_PATH_KEY: process.env.ADMIN_CONSOLE_PATH_KEY || 'local-console-key-0123456789',
  };
}
