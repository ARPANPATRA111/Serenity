'use client';

import { FormEvent, useMemo, useState } from 'react';
import Link from 'next/link';
import { Loader2, MailCheck } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { AuthShell } from '@/components/auth/AuthShell';
import { AuthBenefits, AuthBenefitsCompact } from '@/components/auth/AuthBenefits';
import {
  AuthMessage,
  FormField,
  PasswordField,
  ProviderButton,
} from '@/components/auth/AuthFields';
import { describeAuthError } from '@/lib/auth/authErrors';
import { FREE_CERTIFICATE_LIMIT } from '@/lib/plans/certificateLimits';

const MIN_PASSWORD_LENGTH = 8;

export default function SignupPage() {
  const { signup, loginWithGoogle, isLoading, user } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const passwordHint = useMemo(() => {
    if (password.length === 0) return `At least ${MIN_PASSWORD_LENGTH} characters.`;
    if (password.length < MIN_PASSWORD_LENGTH) {
      return `${MIN_PASSWORD_LENGTH - password.length} more character${
        MIN_PASSWORD_LENGTH - password.length === 1 ? '' : 's'
      } needed.`;
    }
    return 'Password length looks good.';
  }, [password]);

  const confirmationHint = useMemo(() => {
    if (confirmation.length === 0) return ' ';
    return password === confirmation ? 'Passwords match.' : 'Passwords do not match yet.';
  }, [password, confirmation]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);

    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Your password must contain at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    if (password !== confirmation) {
      setError('The two passwords do not match.');
      return;
    }

    setSubmitting(true);
    try {
      await signup(name.trim(), email, password);
    } catch (reason) {
      setError(describeAuthError(reason, 'Unable to create the account. Try again.'));
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
      setError(describeAuthError(reason, 'Unable to continue with Google. Try again.'));
    } finally {
      setSubmitting(false);
    }
  };

  if (isLoading || user) {
    return (
      <AuthShell
        title="Create your free account"
        subtitle="Checking your secure session…"
        loading
      />
    );
  }

  return (
    <AuthShell
      title="Create your free account"
      subtitle={`${FREE_CERTIFICATE_LIMIT} persisted certificates, no card required.`}
      aside={<AuthBenefits />}
      footer={
        <p className="sr-body text-center text-sm">
          Already have an account?{' '}
          <Link href="/login" className="sr-link">
            Sign in
          </Link>
        </p>
      }
    >
      <div className="mb-6 lg:hidden">
        <AuthBenefitsCompact />
      </div>

      <div className="sr-card p-6 sm:p-7">
        {error && (
          <div className="mb-5">
            <AuthMessage tone="error">{error}</AuthMessage>
          </div>
        )}

        <ProviderButton onClick={handleGoogle} disabled={submitting} label="Sign up with Google" />

        <p className="sr-divider-text my-6">or use your email</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <FormField
            id="signup-name"
            label="Name"
            autoComplete="name"
            required
            value={name}
            onChange={(event) => setName(event.target.value)}
          />

          <FormField
            id="signup-email"
            label="Email address"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />

          <PasswordField
            id="signup-password"
            label="Password"
            autoComplete="new-password"
            minLength={MIN_PASSWORD_LENGTH}
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            hint={passwordHint}
          />

          <PasswordField
            id="signup-confirmation"
            label="Confirm password"
            autoComplete="new-password"
            required
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            hint={confirmationHint}
          />

          <button type="submit" disabled={submitting} className="sr-btn sr-btn-primary w-full">
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                Creating account…
              </>
            ) : (
              'Create account'
            )}
          </button>
        </form>

        <p className="sr-body mt-5 flex gap-2.5 text-sm">
          <MailCheck
            className="mt-0.5 h-4 w-4 shrink-0 text-[rgb(var(--sr-brand))]"
            aria-hidden="true"
          />
          <span>
            Serenity emails a verification link before your first email-and-password sign-in. Open
            it to activate the account.
          </span>
        </p>

        <p className="sr-hint mt-4">
          By creating an account you agree that Serenity may store the certificates, templates, and
          media you upload in order to provide the service. Your workspace is private to your
          account and is never shown on public verification pages.
        </p>
      </div>
    </AuthShell>
  );
}
