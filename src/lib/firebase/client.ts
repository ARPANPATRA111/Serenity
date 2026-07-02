import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getStorage, FirebaseStorage } from 'firebase/storage';

export interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
}

// Initialize Firebase (singleton pattern)
let app: FirebaseApp;
let auth: Auth;
let db: Firestore;
let storage: FirebaseStorage;
let _isInitialized = false;

function initializeFirebase(config?: FirebaseConfig) {
  if (_isInitialized && getApps().length > 0) {
    app = getApp();
    auth = getAuth(app);
    db = getFirestore(app);
    storage = getStorage(app);
    return { app, auth, db, storage };
  }

  if (!config && getApps().length === 0) {
    console.warn('[Firebase] No config provided and no existing app. Firebase will not initialize.');
    return { app, auth, db, storage };
  }

  if (getApps().length === 0 && config) {
    app = initializeApp(config);
  } else {
    app = getApp();
  }

  auth = getAuth(app);
  db = getFirestore(app);
  storage = getStorage(app);
  _isInitialized = true;

  return { app, auth, db, storage };
}

export function isFirebaseInitialized() {
  return _isInitialized;
}

/**
 * Get the current user's Firebase ID token for authenticating API requests.
 * Returns null if no user is signed in. Attach as `Authorization: Bearer <token>`.
 */
export async function getIdToken(): Promise<string | null> {
  try {
    if (!auth) {
      initializeFirebase();
    }
    const current = auth?.currentUser;
    if (!current) return null;
    return await current.getIdToken();
  } catch {
    return null;
  }
}

export { app, auth, db, storage, initializeFirebase };
