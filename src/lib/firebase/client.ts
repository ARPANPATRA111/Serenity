import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { connectAuthEmulator } from 'firebase/auth';
import { connectFirestoreEmulator, getFirestore, Firestore } from 'firebase/firestore';
import { connectStorageEmulator, getStorage, FirebaseStorage } from 'firebase/storage';

export interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  useEmulators?: boolean;
}

// Initialize Firebase (singleton pattern)
let app: FirebaseApp;
let auth: Auth;
let db: Firestore;
let storage: FirebaseStorage;
let _isInitialized = false;
let _emulatorsConnected = false;

function connectEmulators(config: FirebaseConfig) {
  if (_emulatorsConnected || !config.useEmulators) return;

  if (!config.projectId.startsWith('demo-')) {
    throw new Error('Firebase emulator mode requires a demo-* project ID');
  }

  const hostname = typeof window !== 'undefined'
    ? (process.env.NEXT_PUBLIC_FIREBASE_EMULATOR_HOST || '127.0.0.1')
    : '127.0.0.1';

  connectAuthEmulator(auth, `http://${hostname}:9099`, { disableWarnings: true });
  connectFirestoreEmulator(db, hostname, 8080);
  connectStorageEmulator(storage, hostname, 9199);
  _emulatorsConnected = true;
}

function initializeFirebase(config?: FirebaseConfig) {
  if (_isInitialized && getApps().length > 0) {
    app = getApp();
    auth = getAuth(app);
    db = getFirestore(app);
    storage = getStorage(app);
    if (config) connectEmulators(config);
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
  if (config) connectEmulators(config);
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
