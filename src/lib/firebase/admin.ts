/**
 * Firebase Admin Configuration
 * 
 * Server-side Firebase Admin SDK for secure operations.
 * Used in API routes for:
 * - Certificate verification
 * - View counting with IP hashing
 * - Email rate limiting
 */

import { initializeApp, getApps, cert, App } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import { getAuth, Auth } from 'firebase-admin/auth';
import { getStorage, Storage } from 'firebase-admin/storage';

let adminApp: App;
let adminDb: Firestore;
let adminAuth: Auth;
let adminStorage: Storage;

function initializeAdmin() {
  if (getApps().length === 0) {
    adminApp = initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
        clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      }),
      storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    });
  } else {
    adminApp = getApps()[0];
  }

  adminDb = getFirestore(adminApp);
  adminAuth = getAuth(adminApp);
  adminStorage = getStorage(adminApp);

  return { adminApp, adminDb, adminAuth, adminStorage };
}

// Lazy initialization (only when needed in API routes)
export function getAdminFirestore(): Firestore {
  if (!adminDb) {
    initializeAdmin();
  }
  return adminDb;
}

export function getAdminAuth(): Auth {
  if (!adminAuth) {
    initializeAdmin();
  }
  return adminAuth;
}

export function getAdminStorage(): Storage {
  if (!adminStorage) {
    initializeAdmin();
  }
  return adminStorage;
}

export { adminApp, adminDb, adminAuth, adminStorage, initializeAdmin };
