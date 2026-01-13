'use client';

/**
 * Authentication Context
 * 
 * Provides authentication state and methods throughout the app.
 * Uses local storage for demo purposes - in production, use Firebase Auth.
 */

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';

interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
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
}

const AuthContext = createContext<AuthContextValue | null>(null);

// Routes that require authentication
const PROTECTED_ROUTES = ['/dashboard', '/editor', '/history'];

// Routes that should redirect to dashboard if authenticated
const AUTH_ROUTES = ['/login', '/signup'];

/**
 * Generate a consistent user ID from email
 * This ensures the same email always gets the same ID across devices
 */
function generateUserIdFromEmail(email: string): string {
  // Simple hash function for consistent ID generation
  let hash = 0;
  const normalizedEmail = email.toLowerCase().trim();
  for (let i = 0; i < normalizedEmail.length; i++) {
    const char = normalizedEmail.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  // Convert to positive number and base36
  const positiveHash = Math.abs(hash);
  return `user_${positiveHash.toString(36)}`;
}

/**
 * Migrate user data from old ID to new ID via API
 */
async function migrateUserData(oldUserId: string, newUserId: string): Promise<void> {
  try {
    const response = await fetch('/api/migrate-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ oldUserId, newUserId }),
    });
    
    const data = await response.json();
    if (data.success) {
      console.log(`[Auth] ${data.message}`);
    } else {
      console.warn('[Auth] Migration failed:', data.error);
    }
  } catch (error) {
    console.error('[Auth] Error migrating user data:', error);
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  // Check for existing session on mount AND migrate user ID if needed
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const savedUser = localStorage.getItem('serenity_user');
        if (savedUser) {
          const parsedUser = JSON.parse(savedUser);
          
          // Check if user ID needs migration to the new consistent format
          const expectedId = generateUserIdFromEmail(parsedUser.email);
          if (parsedUser.id !== expectedId) {
            console.log(`[Auth] Migrating user ID from ${parsedUser.id} to ${expectedId}`);
            
            // Migrate data in Firebase from old ID to new ID
            await migrateUserData(parsedUser.id, expectedId);
            
            // Update local user
            parsedUser.id = expectedId;
            localStorage.setItem('serenity_user', JSON.stringify(parsedUser));
          }
          
          setUser(parsedUser);
        }
      } catch (error) {
        console.error('Error checking auth:', error);
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, []);

  // Handle route protection
  useEffect(() => {
    if (isLoading) return;

    const isProtectedRoute = PROTECTED_ROUTES.some(route => pathname.startsWith(route));
    const isAuthRoute = AUTH_ROUTES.includes(pathname);

    if (isProtectedRoute && !user) {
      // Redirect to login if trying to access protected route without auth
      router.push(`/login?redirect=${encodeURIComponent(pathname)}`);
    } else if (isAuthRoute && user) {
      // Redirect to dashboard if already authenticated
      router.push('/dashboard');
    }
  }, [pathname, user, isLoading, router]);

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      // Simulate API call - in production, use Firebase Auth
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Generate consistent user ID from email (same email = same ID across devices)
      const newUser: User = {
        id: generateUserIdFromEmail(email),
        email,
        name: email.split('@')[0],
      };

      localStorage.setItem('serenity_user', JSON.stringify(newUser));
      setUser(newUser);

      // Get redirect URL from query params
      const params = new URLSearchParams(window.location.search);
      const redirect = params.get('redirect') || '/dashboard';
      router.push(redirect);
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const signup = async (name: string, email: string, password: string) => {
    setIsLoading(true);
    try {
      // Simulate API call - in production, use Firebase Auth
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Generate consistent user ID from email (same email = same ID across devices)
      const newUser: User = {
        id: generateUserIdFromEmail(email),
        email,
        name,
      };

      localStorage.setItem('serenity_user', JSON.stringify(newUser));
      setUser(newUser);
      router.push('/dashboard');
    } catch (error) {
      console.error('Signup error:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem('serenity_user');
    setUser(null);
    router.push('/');
  };

  const loginWithGoogle = async () => {
    setIsLoading(true);
    try {
      // Simulate OAuth - in production, use Firebase Auth with Google provider
      await new Promise(resolve => setTimeout(resolve, 1500));

      // For demo, use a consistent ID for demo@google.com
      const newUser: User = {
        id: generateUserIdFromEmail('demo@google.com'),
        email: 'demo@google.com',
        name: 'Google User',
      };

      localStorage.setItem('serenity_user', JSON.stringify(newUser));
      setUser(newUser);
      router.push('/dashboard');
    } catch (error) {
      console.error('Google login error:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const loginWithGithub = async () => {
    setIsLoading(true);
    try {
      // Simulate OAuth - in production, use Firebase Auth with GitHub provider
      await new Promise(resolve => setTimeout(resolve, 1500));

      // For demo, use a consistent ID for demo@github.com
      const newUser: User = {
        id: generateUserIdFromEmail('demo@github.com'),
        email: 'demo@github.com',
        name: 'GitHub User',
      };

      localStorage.setItem('serenity_user', JSON.stringify(newUser));
      setUser(newUser);
      router.push('/dashboard');
    } catch (error) {
      console.error('GitHub login error:', error);
      throw error;
    } finally {
      setIsLoading(false);
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

// Loading component for protected routes
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
