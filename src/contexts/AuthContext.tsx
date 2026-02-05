'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import {
  onAuthStateChanged,
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

interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  emailVerified: boolean;
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
}

const AuthContext = createContext<AuthContextValue | null>(null);

const PROTECTED_ROUTES = ['/dashboard', '/editor', '/history', '/templates', '/settings'];
const AUTH_ROUTES = ['/login', '/signup'];

function generateOldUserIdFromEmail(email: string): string {
  let hash = 0;
  const normalizedEmail = email.toLowerCase().trim();
  for (let i = 0; i < normalizedEmail.length; i++) {
    const char = normalizedEmail.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  const positiveHash = Math.abs(hash);
  return `user_${positiveHash.toString(36)}`;
}

async function migrateUserData(oldUserId: string, newUserId: string): Promise<void> {
  try {
    const response = await fetch('/api/migrate-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ oldUserId, newUserId }),
    });
    
    const data = await response.json();
    if (data.success && data.migratedTemplates > 0) {
      console.log(`[Auth] Migrated ${data.migratedTemplates} templates and ${data.migratedCertificates} certificates`);
    }
  } catch (error) {
    console.error('[Auth] Error migrating user data:', error);
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
    const response = await fetch('/api/users', {
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
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (typeof window !== 'undefined') {
      initializeFirebase();
    }
  }, []);

  useEffect(() => {
    if (!auth) return;

    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      if (fbUser) {
        setFirebaseUser(fbUser);
        
        if (fbUser.emailVerified) {
          const mappedUser = mapFirebaseUser(fbUser);
          setUser(mappedUser);
          await saveUserViaAPI(mappedUser);
        } else {
          setUser(null);
        }
      } else {
        setFirebaseUser(null);
        setUser(null);
      }
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (isLoading) return;

    const isProtectedRoute = PROTECTED_ROUTES.some(route => pathname.startsWith(route));
    const isAuthRoute = AUTH_ROUTES.includes(pathname);

    if (isProtectedRoute && !user) {
      router.push(`/login?redirect=${encodeURIComponent(pathname)}`);
    } else if (isAuthRoute && user) {
      router.push('/dashboard');
    }
  }, [pathname, user, isLoading, router]);

  const getActionCodeSettings = (): ActionCodeSettings => {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 
      (typeof window !== 'undefined' ? window.location.origin : '');
    return {
      url: `${baseUrl}/auth/action`,
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

      const mappedUser = mapFirebaseUser(userCredential.user);
      setUser(mappedUser);
      await saveUserViaAPI(mappedUser);

      const oldUserId = generateOldUserIdFromEmail(email);
      if (oldUserId !== mappedUser.id) {
        await migrateUserData(oldUserId, mappedUser.id);
      }

      const params = new URLSearchParams(window.location.search);
      const redirect = params.get('redirect') || '/dashboard';
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
    setIsLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      
      try {
        await sendEmailVerification(userCredential.user, getActionCodeSettings());
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
      
      router.push('/login?message=verification-sent');
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
      
      const mappedUser = mapFirebaseUser(userCredential.user);
      setUser(mappedUser);
      await saveUserViaAPI(mappedUser);

      if (mappedUser.email) {
        const oldUserId = generateOldUserIdFromEmail(mappedUser.email);
        if (oldUserId !== mappedUser.id) {
          await migrateUserData(oldUserId, mappedUser.id);
        }
      }
      
      router.push('/dashboard');
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
      
      const mappedUser = mapFirebaseUser(userCredential.user);
      setUser(mappedUser);
      await saveUserViaAPI(mappedUser);

      if (mappedUser.email) {
        const oldUserId = generateOldUserIdFromEmail(mappedUser.email);
        if (oldUserId !== mappedUser.id) {
          await migrateUserData(oldUserId, mappedUser.id);
        }
      }
      
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
      const response = await fetch('/api/users', {
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
      // Delete user data from Firestore
      const response = await fetch(`/api/users?id=${user.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete account data');
      }

      // Delete Firebase Auth account
      if (firebaseUser) {
        await firebaseUser.delete();
      }

      setUser(null);
      setFirebaseUser(null);
      router.push('/');
    } catch (error: any) {
      console.error('[Auth] Error deleting account:', error);
      // If requires re-authentication
      if (error.code === 'auth/requires-recent-login') {
        throw new Error('Please log out and log back in before deleting your account for security reasons.');
      }
      throw error;
    }
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
