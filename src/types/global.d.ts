/**
 * Global Type Declarations
 */

// Ensure fabric is available globally for browser context
declare global {
  interface Window {
    fabric: typeof import('fabric').fabric;
  }
}

// Module declarations for packages without types
declare module 'file-saver' {
  export function saveAs(blob: Blob, filename: string): void;
}

// Extend process.env for type safety
declare namespace NodeJS {
  interface ProcessEnv {
    NEXT_PUBLIC_FIREBASE_API_KEY: string;
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: string;
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: string;
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: string;
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: string;
    NEXT_PUBLIC_FIREBASE_APP_ID: string;
    FIREBASE_ADMIN_PROJECT_ID: string;
    FIREBASE_ADMIN_CLIENT_EMAIL: string;
    FIREBASE_ADMIN_PRIVATE_KEY: string;
    RESEND_API_KEY: string;
    NEXT_PUBLIC_APP_URL: string;
    DAILY_IP_SALT: string;
    DAILY_EMAIL_LIMIT?: string;
    FREE_BULK_EMAIL_LIMIT?: string;
  }
}

export {};
