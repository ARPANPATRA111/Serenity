'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { applyActionCode, verifyPasswordResetCode, confirmPasswordReset } from 'firebase/auth';
import { auth, initializeFirebase } from '@/lib/firebase/client';
import Link from 'next/link';
import { CheckCircle2, XCircle, Loader2, Sparkles, Lock, Eye, EyeOff, ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';

function AuthActionContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState<'loading' | 'success' | 'error' | 'resetPassword'>('loading');
  const [message, setMessage] = useState('');
  const [oobCode, setOobCode] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [passwordError, setPasswordError] = useState('');

  useEffect(() => {
    initializeFirebase();
    
    const mode = searchParams.get('mode');
    const code = searchParams.get('oobCode');

    if (!code) {
      setStatus('error');
      setMessage('Invalid verification link.');
      return;
    }

    setOobCode(code);

    const handleAction = async () => {
      try {
        switch (mode) {
          case 'verifyEmail':
            await applyActionCode(auth, code);
            setStatus('success');
            setMessage('Your email has been verified successfully! You can now sign in.');
            break;
          case 'resetPassword':
            await verifyPasswordResetCode(auth, code);
            setStatus('resetPassword');
            setMessage('Enter your new password below.');
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

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError('');

    if (newPassword.length < 6) {
      setPasswordError('Password must be at least 6 characters.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('Passwords do not match.');
      return;
    }

    if (!oobCode) {
      setPasswordError('Invalid reset code.');
      return;
    }

    setIsSubmitting(true);

    try {
      await confirmPasswordReset(auth, oobCode, newPassword);
      setStatus('success');
      setMessage('Your password has been reset successfully! You can now sign in with your new password.');
    } catch (error: any) {
      if (error.code === 'auth/weak-password') {
        setPasswordError('Password is too weak. Please choose a stronger password.');
      } else if (error.code === 'auth/expired-action-code') {
        setPasswordError('This link has expired. Please request a new password reset.');
      } else {
        setPasswordError('Failed to reset password. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

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

          {status === 'resetPassword' && (
            <div className="flex flex-col items-center gap-4">
              <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                <Lock className="h-8 w-8 text-primary" />
              </div>
              <h1 className="text-2xl font-bold">Reset Password</h1>
              <p className="text-muted-foreground text-sm">{message}</p>

              {passwordError && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="w-full flex items-center gap-2 rounded-lg bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive text-left"
                >
                  <XCircle className="h-4 w-4 flex-shrink-0" />
                  {passwordError}
                </motion.div>
              )}

              <form onSubmit={handlePasswordReset} className="w-full space-y-4 mt-2 text-left">
                <div>
                  <label htmlFor="newPassword" className="block text-sm font-medium mb-2">
                    New Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                    <input
                      id="newPassword"
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="input pl-10 pr-10"
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label htmlFor="confirmPassword" className="block text-sm font-medium mb-2">
                    Confirm Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                    <input
                      id="confirmPassword"
                      type={showConfirmPassword ? 'text' : 'password'}
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="input pl-10 pr-10"
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                </div>

                <motion.button
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                  type="submit"
                  disabled={isSubmitting}
                  className="btn-primary w-full py-3"
                >
                  {isSubmitting ? (
                    <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      Reset Password
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </motion.button>
              </form>
            </div>
          )}

          {status === 'success' && (
            <div className="flex flex-col items-center gap-4">
              <div className="h-16 w-16 rounded-full bg-green-500/10 flex items-center justify-center">
                <CheckCircle2 className="h-8 w-8 text-green-500" />
              </div>
              <h1 className="text-2xl font-bold">Success!</h1>
              <p className="text-muted-foreground">{message}</p>
              <Link
                href="/login?message=password-reset"
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
                href="/forgot-password"
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
