'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { applyActionCode, verifyPasswordResetCode, confirmPasswordReset } from 'firebase/auth';
import { auth, initializeFirebase } from '@/lib/firebase/client';
import Link from 'next/link';
import { CheckCircle2, XCircle, Loader2, Sparkles } from 'lucide-react';

function AuthActionContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    initializeFirebase();
    
    const mode = searchParams.get('mode');
    const oobCode = searchParams.get('oobCode');

    if (!oobCode) {
      setStatus('error');
      setMessage('Invalid verification link.');
      return;
    }

    const handleAction = async () => {
      try {
        switch (mode) {
          case 'verifyEmail':
            await applyActionCode(auth, oobCode);
            setStatus('success');
            setMessage('Your email has been verified successfully! You can now sign in.');
            break;
          case 'resetPassword':
            await verifyPasswordResetCode(auth, oobCode);
            setStatus('success');
            setMessage('Password reset link is valid. Please set your new password.');
            break;
          default:
            setStatus('error');
            setMessage('Unknown action type.');
        }
      } catch (error: any) {
        setStatus('error');
        if (error.code === 'auth/invalid-action-code') {
          setMessage('This link has expired or already been used. Please request a new one.');
        } else if (error.code === 'auth/expired-action-code') {
          setMessage('This link has expired. Please request a new verification email.');
        } else {
          setMessage('Failed to verify. Please try again.');
        }
      }
    };

    handleAction();
  }, [searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md text-center">
        <Link href="/" className="inline-flex items-center gap-3 mb-8">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg">
            <Sparkles className="h-5 w-5 text-white" />
          </div>
          <span className="font-display text-2xl font-bold">Serenity</span>
        </Link>

        <div className="bg-card border border-border rounded-2xl p-8 shadow-lg">
          {status === 'loading' && (
            <div className="flex flex-col items-center gap-4">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
              <p className="text-muted-foreground">Verifying...</p>
            </div>
          )}

          {status === 'success' && (
            <div className="flex flex-col items-center gap-4">
              <div className="h-16 w-16 rounded-full bg-green-500/10 flex items-center justify-center">
                <CheckCircle2 className="h-8 w-8 text-green-500" />
              </div>
              <h1 className="text-2xl font-bold">Email Verified!</h1>
              <p className="text-muted-foreground">{message}</p>
              <Link
                href="/login"
                className="mt-4 inline-flex items-center justify-center rounded-xl bg-primary px-6 py-3 font-medium text-white hover:bg-primary/90 transition-colors"
              >
                Sign In
              </Link>
            </div>
          )}

          {status === 'error' && (
            <div className="flex flex-col items-center gap-4">
              <div className="h-16 w-16 rounded-full bg-red-500/10 flex items-center justify-center">
                <XCircle className="h-8 w-8 text-red-500" />
              </div>
              <h1 className="text-2xl font-bold">Verification Failed</h1>
              <p className="text-muted-foreground">{message}</p>
              <Link
                href="/signup"
                className="mt-4 inline-flex items-center justify-center rounded-xl bg-primary px-6 py-3 font-medium text-white hover:bg-primary/90 transition-colors"
              >
                Try Again
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AuthActionPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    }>
      <AuthActionContent />
    </Suspense>
  );
}
