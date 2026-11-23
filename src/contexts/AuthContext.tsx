'use client';

import { createContext, useContext, useEffect, useRef, useState, ReactNode, type MutableRefObject } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import {
  onIdTokenChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  sendEmailVerification,
  sendPasswordResetEmail,
  GoogleAuthProvider,
  GithubAuthProvider,
  signInWithPopup,
  ActionCodeSettings,
  User as FirebaseUser,
} from 'firebase/auth';
import { auth, initializeFirebase } from '@/lib/firebase/client';
import { authenticatedFetch } from '@/lib/api/authFetch';
import { authPageHref, sanitizeAuthRedirect } from '@/lib/navigation/safeRedirect';
import { clearPrivateSessionState } from '@/lib/session/privateSessionState';

interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  emailVerified: boolean;
  isPremium: boolean;
  certificatesGenerated: number;
}

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  loginWithGoogle: () => Promise<void>;
  loginWithGithub: () => Promise<void>;
  resendVerificationEmail: () => Promise<void>;
  forgotPassword: (email: string) => Promise<void>;
  updateUser: (updates: { name?: string }) => Promise<void>;
  deleteAccount: () => Promise<void>;
  refreshPremiumStatus: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// `/templates` is the public gallery: it reads only the public template API,
// and opening a design goes through the protected editor.
const PROTECTED_ROUTES = ['/dashboard', '/editor', '/events', '/history', '/settings'];
const AUTH_ROUTES = ['/login', '/signup'];

/**
 * Called for every auth state. When the signed-in account changes (sign-out
 * here or in another tab, or a different account signing in elsewhere) the
 * previous account's spreadsheet, generation results, editor details, cached
 * responses, and draft are cleared. Token refreshes keep the same UID and
 * change nothing.
 */
function applySessionOwner(ownerRef: MutableRefObject<string | null | undefined>, nextUid: string | null) {
  const previousUid = ownerRef.current;
  ownerRef.current = nextUid;
  if (previousUid === nextUid) return;
  // The first state in a tab has nothing in memory to clear, but a signed-out
  // browser should not keep someone's unscoped editor draft.
  if (previousUid === undefined && nextUid !== null) return;

  clearPrivateSessionState();

  // Pages already on screen still hold the previous account's records in
  // component state. A full load of the dashboard discards all of it.
  if (previousUid && nextUid && typeof window !== 'undefined'
    && PROTECTED_ROUTES.some((route) => window.location.pathname.startsWith(route))) {
    window.location.assign('/dashboard');
  }
}

async function saveUserViaAPI(user: {
  id: string;
  email: string;
  name: string;
  emailVerified: boolean;
  avatar?: string;
}): Promise<void> {
  try {
    const response = await authenticatedFetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(user),
    });

    if (!response.ok) {
      const data = await response.json();
      console.error('[Auth] Failed to save user via API:', data.error);
    }
  } catch (error) {
    console.error('[Auth] Error saving user via API:', error);
  }
}

function mapFirebaseUser(firebaseUser: FirebaseUser, displayName?: string): User {
  return {
    id: firebaseUser.uid,
    email: firebaseUser.email || '',
    name: displayName || firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'User',
    avatar: firebaseUser.photoURL || undefined,
    emailVerified: firebaseUser.emailVerified,
    isPremium: false,
    certificatesGenerated: 0,
  };
}

// Fetch user profile from Firestore (includes updated name, etc.)
async function fetchUserProfile(_userId: string): Promise<{
  name?: string;
  avatar?: string;
  isPremium: boolean;
  certificatesGenerated: number;
} | null> {
  try {
    const response = await authenticatedFetch('/api/users');
    if (response.ok) {
      const data = await response.json();
      if (data.success && data.user) {
        return {
          name: data.user.name,
          avatar: data.user.avatar,
          isPremium: data.user.isPremium === true,
          certificatesGenerated: data.user.certificatesGenerated || 0,
        };
      }
    }
  } catch (error) {
    console.error('[Auth] Error fetching user profile:', error);
  }
  return null;
}

async function fetchPremiumStatus(_userId: string): Promise<{ isPremium: boolean; certificatesGenerated: number }> {
  try {
    const response = await authenticatedFetch('/api/users/premium');
    if (response.ok) {
      const data = await response.json();
      if (data.success) {
        return {
          isPremium: data.isPremium || false,
          certificatesGenerated: data.certificatesGenerated || 0,
        };
      }
    }
  } catch (error) {
    console.error('[Auth] Error fetching premium status:', error);
  }
  return { isPremium: false, certificatesGenerated: 0 };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const authRefreshSequence = useRef(0);
  // UID whose private state this tab currently holds; undefined until the
  // first auth state arrives.
  const sessionOwnerRef = useRef<string | null | undefined>(undefined);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (typeof window !== 'undefined') {
      initializeFirebase();
    }
  }, []);

  useEffect(() => {
    if (!auth) {
      setIsLoading(false);
      return;
    }

    let initialStateResolved = false;
    const handleAuthState = (fbUser: FirebaseUser | null) => {
      initialStateResolved = true;
      const refreshSequence = ++authRefreshSequence.current;
      applySessionOwner(sessionOwnerRef, fbUser?.emailVerified ? fbUser.uid : null);

      if (fbUser) {
        setFirebaseUser(fbUser);
        
        if (fbUser.emailVerified) {
          const mappedUser = mapFirebaseUser(fbUser);

          // Firebase identity is sufficient to render protected routes. Profile
          // and plan metadata refresh without holding the application shell.
          setUser(mappedUser);
          setIsLoading(false);

          // Persisted sessions only need one profile read. User-document writes
          // are reserved for an interactive sign-in/signup instead of every
          // reload, which reduces latency and Firestore write pressure.
          void fetchUserProfile(fbUser.uid).then((userProfile) => {
            if (authRefreshSequence.current !== refreshSequence || auth.currentUser?.uid !== fbUser.uid) {
              return;
            }

            setUser({
              ...mappedUser,
              isPremium: userProfile?.isPremium ?? mappedUser.isPremium,
              certificatesGenerated: userProfile?.certificatesGenerated ?? mappedUser.certificatesGenerated,
              name: userProfile?.name || mappedUser.name,
              avatar: userProfile?.avatar || mappedUser.avatar,
            });
          });
          return;
        } else {
          setUser(null);
        }
      } else {
        setFirebaseUser(null);
        setUser(null);
      }
      setIsLoading(false);
    };

    const unsubscribe = onIdTokenChanged(auth, handleAuthState);
    void auth.authStateReady()
      .then(() => {
        if (!initialStateResolved) handleAuthState(auth.currentUser);
      })
      .catch((error) => {
        console.error('[Auth] Failed to restore persisted state:', error);
        if (!initialStateResolved) setIsLoading(false);
      });

    // A broken network or browser storage implementation must not leave auth
    // routes on an infinite spinner. Late Firebase callbacks still update the
    // user and redirect correctly after this fallback.
    const fallbackTimer = window.setTimeout(() => {
      if (!initialStateResolved) setIsLoading(false);
    }, 4_000);

    return () => {
      window.clearTimeout(fallbackTimer);
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (isLoading) return;

    const isProtectedRoute = PROTECTED_ROUTES.some(route => pathname.startsWith(route));
    const isAuthRoute = AUTH_ROUTES.includes(pathname);

    if (isProtectedRoute && !user) {
      router.replace(`/login?redirect=${encodeURIComponent(pathname + window.location.search)}`);
    } else if (isAuthRoute && user) {
      router.replace(sanitizeAuthRedirect(new URLSearchParams(window.location.search).get('redirect')));
    }
  }, [pathname, user, isLoading, router]);

  const getActionCodeSettings = (continuePath = '/auth/action'): ActionCodeSettings => {
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 
      (typeof window !== 'undefined' ? window.location.origin : '');
    return {
      url: `${baseUrl}${continuePath}`,
      handleCodeInApp: true,
    };
  };

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      
      if (!userCredential.user.emailVerified) {
        await signOut(auth);
        throw new Error('Please verify your email before logging in. Check your inbox for the verification link.');
      }

      void saveUserViaAPI(mapFirebaseUser(userCredential.user));

      const params = new URLSearchParams(window.location.search);
      const redirect = sanitizeAuthRedirect(params.get('redirect'));
      router.push(redirect);
    } catch (error: any) {
      console.error('Login error:', error);
      if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
        throw new Error('Invalid email or password');
      }
      if (error.code === 'auth/invalid-credential') {
        throw new Error('Invalid email or password');
      }
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const signup = async (name: string, email: string, password: string) => {
    const redirect = new URLSearchParams(window.location.search).get('redirect');
    setIsLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      
      try {
        await sendEmailVerification(userCredential.user, getActionCodeSettings(authPageHref('/login', redirect)));
      } catch (verificationError: any) {
        if (verificationError.code === 'auth/unauthorized-continue-uri') {
          await sendEmailVerification(userCredential.user);
        } else {
          throw verificationError;
        }
      }
      
      const userToSave = {
        id: userCredential.user.uid,
        email: userCredential.user.email || email,
        name: name,
        emailVerified: false,
      };
      await saveUserViaAPI(userToSave);
      
      await signOut(auth);
      
      router.push(authPageHref('/login', redirect, true));
    } catch (error: any) {
      console.error('Signup error:', error);
      if (error.code === 'auth/email-already-in-use') {
        throw new Error('This email is already registered. Please login instead.');
      }
      if (error.code === 'auth/weak-password') {
        throw new Error('Password should be at least 6 characters');
      }
      if (error.code === 'auth/unauthorized-continue-uri') {
        throw new Error('Email verification setup error. Please contact support.');
      }
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
      // The auth listener clears this too; doing it here means nothing from
      // the session survives even if the listener is slow.
      clearPrivateSessionState();
      setUser(null);
      setFirebaseUser(null);
      router.push('/');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const loginWithGoogle = async () => {
    setIsLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      const userCredential = await signInWithPopup(auth, provider);
      void saveUserViaAPI(mapFirebaseUser(userCredential.user));

      // Honour the same validated redirect the email/password path uses, so
      // arriving at /login?redirect=/history lands in the right place.
      const params = new URLSearchParams(window.location.search);
      router.push(sanitizeAuthRedirect(params.get('redirect')));
    } catch (error: any) {
      console.error('Google login error:', error);
      if (error.code === 'auth/popup-closed-by-user') {
        throw new Error('Login cancelled');
      }
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const loginWithGithub = async () => {
    setIsLoading(true);
    try {
      const provider = new GithubAuthProvider();
      const userCredential = await signInWithPopup(auth, provider);
      void saveUserViaAPI(mapFirebaseUser(userCredential.user));
      
      router.push('/dashboard');
    } catch (error: any) {
      console.error('GitHub login error:', error);
      if (error.code === 'auth/popup-closed-by-user') {
        throw new Error('Login cancelled');
      }
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const resendVerificationEmail = async () => {
    if (firebaseUser && !firebaseUser.emailVerified) {
      try {
        await sendEmailVerification(firebaseUser, getActionCodeSettings());
      } catch (error: any) {
        if (error.code === 'auth/unauthorized-continue-uri') {
          await sendEmailVerification(firebaseUser);
        } else {
          throw error;
        }
      }
    } else {
      throw new Error('No unverified user found');
    }
  };

  const forgotPassword = async (email: string) => {
    if (!auth) throw new Error('Firebase not initialized');
    
    try {
      await sendPasswordResetEmail(auth, email, getActionCodeSettings());
    } catch (error: any) {
      if (error.code === 'auth/unauthorized-continue-uri') {
        await sendPasswordResetEmail(auth, email);
      } else if (error.code === 'auth/user-not-found') {
        return;
      } else {
        throw error;
      }
    }
  };

  const updateUser = async (updates: { name?: string }) => {
    if (!user) {
      throw new Error('No user logged in');
    }

    try {
      const response = await authenticatedFetch('/api/users', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: user.id, ...updates }),
      });

      if (!response.ok) {
        throw new Error('Failed to update profile');
      }

      // Update local user state immediately
      setUser(prev => prev ? { ...prev, ...updates } : null);
    } catch (error) {
      console.error('[Auth] Error updating user:', error);
      throw error;
    }
  };

  const deleteAccount = async () => {
    if (!user) {
      throw new Error('No user logged in');
    }

    try {
      // Soft delete: mark user as deleted in Firestore (data is preserved)
      const response = await authenticatedFetch('/api/users', {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete account data');
      }

      // Sign out the user (account data is preserved but marked as deleted)
      await logout();
    } catch (error: any) {
      console.error('[Auth] Error deleting account:', error);
      throw error;
    }
  };

  const refreshPremiumStatus = async () => {
    if (!user) return;
    const premiumInfo = await fetchPremiumStatus(user.id);
    setUser(prev => prev ? { ...prev, ...premiumInfo } : null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        signup,
        logout,
        loginWithGoogle,
        loginWithGithub,
        resendVerificationEmail,
        forgotPassword,
        updateUser,
        deleteAccount,
        refreshPremiumStatus,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export function AuthLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        <p className="text-muted-foreground">Loading...</p>
      </div>
    </div>
  );
}
