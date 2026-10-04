'use client';

import { FormEvent, useEffect, useState } from 'react';
import {
  EmailAuthProvider,
  GoogleAuthProvider,
  onIdTokenChanged,
  reauthenticateWithCredential,
  reauthenticateWithPopup,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import { KeyRound, Loader2, LockKeyhole, LogOut, ShieldAlert } from 'lucide-react';
import { auth } from '@/lib/firebase/client';
import { ConsoleRequestError, consoleFetch } from './api';

interface UnlockPanelProps {
  onUnlocked: (session: { email: string | null; expiresAt: string }) => void;
}

/**
 * Step 1: sign in with the operator's Serenity account (email/password or
 * Google). Step 2: enter the console passphrase. The server checks the account
 * claim, sign-in recency and the passphrase hash before issuing a session.
 */
export function UnlockPanel({ onUnlocked }: UnlockPanelProps) {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passphrase, setPassphrase] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsReauth, setNeedsReauth] = useState(false);

  useEffect(() => {
    if (!auth) {
      setAuthReady(true);
      return;
    }
    return onIdTokenChanged(auth, (current) => {
      setUser(current);
      setAuthReady(true);
    });
  }, []);

  const isPasswordAccount = user?.providerData.some((entry) => entry.providerId === 'password') ?? false;

  const signIn = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
      setPassword('');
    } catch {
      setError('Those credentials were not accepted.');
    } finally {
      setBusy(false);
    }
  };

  const signInWithGoogle = async () => {
    setBusy(true);
    setError(null);
    try {
      await signInWithPopup(auth, new GoogleAuthProvider());
    } catch {
      setError('Google sign-in did not complete.');
    } finally {
      setBusy(false);
    }
  };

  const reauthenticate = async () => {
    if (!user) return;
    if (isPasswordAccount) {
      if (!password) throw new ConsoleRequestError('Enter your account password to confirm it is you.', 401, 'REAUTH_REQUIRED');
      await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email || '', password));
      setPassword('');
    } else {
      await reauthenticateWithPopup(user, new GoogleAuthProvider());
    }
  };

  const unlock = async (event: FormEvent) => {
    event.preventDefault();
    if (!user) return;
    setBusy(true);
    setError(null);
    try {
      if (needsReauth) await reauthenticate();
      // Force a fresh token so a newly granted operator claim is included.
      const idToken = await user.getIdToken(true);
      const session = await consoleFetch<{ email: string | null; expiresAt: string }>('/api/console/session', {
        method: 'POST',
        idToken,
        body: JSON.stringify({ passphrase }),
      });
      setPassphrase('');
      setNeedsReauth(false);
      onUnlocked(session);
    } catch (caught) {
      if (caught instanceof ConsoleRequestError) {
        if (caught.code === 'REAUTH_REQUIRED') {
          setNeedsReauth(true);
          setError(isPasswordAccount
            ? 'For security, confirm your account password as well.'
            : 'For security, confirm your Google account, then unlock again.');
        } else if (caught.status === 404) {
          setError('This account cannot open the console.');
        } else {
          setError(caught.message);
        }
      } else {
        setError('Unlocking failed. Check your connection and try again.');
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-md">
      <div className="rounded-2xl border border-border bg-card p-6 shadow-xl sm:p-8">
        <div className="tile-primary mb-5 h-12 w-12">
          <LockKeyhole className="h-6 w-6" aria-hidden="true" />
        </div>
        <h1 className="font-display text-2xl font-bold">Operator console</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Restricted area. Access requires an operator account and the console passphrase.
        </p>

        {!authReady ? (
          <div className="mt-8 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-label="Loading" /></div>
        ) : !user ? (
          <form onSubmit={signIn} className="mt-6 space-y-4">
            <div>
              <label htmlFor="console-email" className="label">Account email</label>
              <input id="console-email" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} className="input mt-2" />
            </div>
            <div>
              <label htmlFor="console-password" className="label">Password</label>
              <input id="console-password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} className="input mt-2" />
            </div>
            <button type="submit" className="btn-primary w-full" disabled={busy}>
              {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              Sign in
            </button>
            <div className="flex items-center gap-3 text-xs text-muted-foreground" aria-hidden="true">
              <span className="h-px flex-1 bg-border" />or<span className="h-px flex-1 bg-border" />
            </div>
            <button type="button" onClick={signInWithGoogle} className="btn-outline w-full" disabled={busy}>
              Continue with Google
            </button>
          </form>
        ) : (
          <form onSubmit={unlock} className="mt-6 space-y-4">
            <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-muted/40 px-3 py-2.5 text-sm">
              <span className="min-w-0 truncate">Signed in as <strong>{user.email}</strong></span>
              <button
                type="button"
                onClick={() => signOut(auth)}
                className="inline-flex min-h-9 shrink-0 items-center gap-1 rounded-md px-2 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <LogOut className="h-3.5 w-3.5" aria-hidden="true" /> Switch
              </button>
            </div>

            {needsReauth && isPasswordAccount && (
              <div>
                <label htmlFor="console-reauth" className="label">Account password</label>
                <input id="console-reauth" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className="input mt-2" />
              </div>
            )}

            <div>
              <label htmlFor="console-passphrase" className="label">Console passphrase</label>
              <input
                id="console-passphrase"
                type="password"
                autoComplete="off"
                required
                value={passphrase}
                onChange={(e) => setPassphrase(e.target.value)}
                className="input mt-2"
              />
            </div>
            <button type="submit" className="btn-primary w-full" disabled={busy || !passphrase}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <KeyRound className="h-4 w-4" aria-hidden="true" />}
              {needsReauth && !isPasswordAccount ? 'Confirm with Google and unlock' : 'Unlock console'}
            </button>
          </form>
        )}

        {error && (
          <p id="console-unlock-error" role="alert" className="mt-4 flex items-start gap-2 rounded-lg bg-error/10 p-3 text-sm text-error">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
