declare global {
  interface Window {
    fabric: typeof import('fabric').fabric;
  }
}

declare module 'file-saver' {
  export function saveAs(blob: Blob, filename: string): void;
}

declare namespace NodeJS {
  interface ProcessEnv {
    FB_CREDENTIAL: string;
    FB_AUTH_DOMAIN: string;
    FB_PROJECT: string;
    FB_BUCKET: string;
    FB_SENDER: string;
    FB_APP: string;
    FIREBASE_ADMIN_PROJECT_ID: string;
    FIREBASE_ADMIN_CLIENT_EMAIL: string;
    FIREBASE_ADMIN_PRIVATE_KEY: string;
    RESEND_API_KEY: string;
    NEXT_PUBLIC_SITE_URL: string;
    DAILY_IP_SALT: string;
    DAILY_EMAIL_LIMIT?: string;
    FREE_BULK_EMAIL_LIMIT?: string;
  }
}

export {};
