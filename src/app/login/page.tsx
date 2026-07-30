'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { AuthShell } from '@/components/auth/AuthShell';
import {
  AuthMessage,
  FormField,
  PasswordField,
  ProviderButton,
} from '@/components/auth/AuthFields';
import { describeAuthError } from '@/lib/auth/authErrors';

export default function LoginPage() {
  const { login, loginWithGoogle, isLoading, user } = useAuth();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const message =
    searchParams.get('message') === 'verification-sent'
      ? 'Account created. Open the verification link we emailed you, then sign in.'
      : null;

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email, password);
    } catch (reason) {
      setError(describeAuthError(reason, 'Unable to sign in. Try again.'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogle = async () => {
    setError(null);
    setSubmitting(true);
    try {
      await loginWithGoogle();
    } catch (reason) {
      setError(describeAuthError(reason, 'Unable to sign in with Google. Try again.'));
    } finally {
      setSubmitting(false);
    }
  };

  if (isLoading || user) {
    return (
      <AuthShell title="Welcome back" subtitle="Checking your secure session…" loading />
    );
  }

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in to design, generate, and verify certificates with Serenity."
      footer={
        <p className="sr-body text-center text-sm">
          New to Serenity?{' '}
          <Link href="/signup" className="sr-link">
            Create a free account
          </Link>
        </p>
      }
    >
      <div className="sr-card p-6 sm:p-7">
        <div className="space-y-4">
          {message && <AuthMessage tone="success">{message}</AuthMessage>}
          {error && <AuthMessage tone="error">{error}</AuthMessage>}
        </div>

        <div className={message || error ? 'mt-5' : ''}>
          <ProviderButton onClick={handleGoogle} disabled={submitting} label="Continue with Google" />
        </div>

        <p className="sr-divider-text my-6">or use your email</p>

        <form onSubmit={handleSubmit} className="space-y-5" noValidate={false}>
          <FormField
            id="login-email"
            label="Email address"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />

          <PasswordField
            id="login-password"
            label="Password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            action={
              <Link href="/forgot-password" className="sr-link text-sm">
                Forgot password?
              </Link>
            }
          />

          <button type="submit" disabled={submitting} className="sr-btn sr-btn-primary w-full">
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                Signing in…
              </>
            ) : (
              'Sign in'
            )}
          </button>
        </form>
      </div>
    </AuthShell>
  );
}
