'use client';

import { useEffect, useState } from 'react';
import { Loader2, RefreshCw, ShieldQuestion } from 'lucide-react';
import { VerifyShell } from './VerifyShell';

const RETRY_DELAYS_SECONDS = [5, 15, 30, 60];
const ATTEMPT_WINDOW_MS = 10 * 60_000;

function attemptKey() {
  return `serenity:verify-retry:${window.location.pathname}`;
}

/** Retries survive the reload they trigger, so the backoff actually grows. */
function readAttempt(): number {
  try {
    const raw = window.sessionStorage.getItem(attemptKey());
    if (!raw) return 0;
    const { attempt, at } = JSON.parse(raw) as { attempt: number; at: number };
    return Date.now() - at > ATTEMPT_WINDOW_MS ? 0 : attempt;
  } catch {
    return RETRY_DELAYS_SECONDS.length;
  }
}

function writeAttempt(attempt: number) {
  try {
    window.sessionStorage.setItem(attemptKey(), JSON.stringify({ attempt, at: Date.now() }));
  } catch {
    // Without storage, automatic retries stop after the first page load.
  }
}

/**
 * Shown when the verification service could not give a definitive answer
 * (database unreachable, daily quota exhausted, misconfiguration). It says
 * plainly that this is not a verdict on the certificate and retries on its own
 * with a growing delay, then stops and leaves the manual retry.
 */
export default function VerificationUnavailable() {
  const [attempt, setAttempt] = useState<number | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [retrying, setRetrying] = useState(false);

  useEffect(() => {
    setAttempt(readAttempt());
  }, []);

  const exhausted = attempt !== null && attempt >= RETRY_DELAYS_SECONDS.length;

  useEffect(() => {
    if (attempt === null || exhausted) return;
    let remaining = RETRY_DELAYS_SECONDS[attempt];
    setSecondsLeft(remaining);
    const interval = window.setInterval(() => {
      remaining -= 1;
      setSecondsLeft(remaining);
      if (remaining <= 0) {
        window.clearInterval(interval);
        writeAttempt(attempt + 1);
        setRetrying(true);
        window.location.reload();
      }
    }, 1000);
    return () => window.clearInterval(interval);
  }, [attempt, exhausted]);

  return (
    <VerifyShell>
      <section className="mx-auto max-w-xl text-center" aria-live="polite" aria-labelledby="unavailable-heading">
        <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-warning/15">
          <ShieldQuestion className="h-10 w-10 text-warning" aria-hidden="true" />
        </div>
        <h1 id="unavailable-heading" className="font-display text-3xl font-bold">Verification is temporarily unavailable</h1>
        <p className="mt-4 text-muted-foreground">
          We could not reach the verification service just now.{' '}
          <strong className="text-foreground">This does not mean the certificate is invalid.</strong>{' '}
          Please try again in a moment.
        </p>

        <div className="mt-8 flex flex-col items-center gap-3">
          <button
            type="button"
            onClick={() => {
              writeAttempt(0);
              setRetrying(true);
              window.location.reload();
            }}
            className="btn-primary inline-flex min-h-11 items-center gap-2 px-6"
            disabled={retrying}
          >
            {retrying ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <RefreshCw className="h-4 w-4" aria-hidden="true" />}
            Try again now
          </button>
          {attempt !== null && !exhausted && !retrying && (
            <p className="text-sm text-muted-foreground">Retrying automatically in {secondsLeft}s…</p>
          )}
        </div>
      </section>
    </VerifyShell>
  );
}
