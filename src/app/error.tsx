/**
 * Global Error Boundary
 */

'use client';

import { useEffect } from 'react';
import Link from 'next/link';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 text-center">
      <div className="mb-4 h-16 w-16 rounded-full bg-red-500/10 p-4">
        <svg
          className="h-8 w-8 text-red-500"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
      </div>
      
      <h2 className="font-display text-2xl font-bold">Something went wrong!</h2>
      <p className="mt-2 max-w-md text-muted-foreground">
        An unexpected error occurred. Please try again or contact support if the problem persists.
      </p>
      
      <div className="mt-8 flex gap-4">
        <button
          onClick={reset}
          className="btn-primary"
        >
          Try again
        </button>
        <Link href="/" className="btn-outline">
          Go home
        </Link>
      </div>
      
      {process.env.NODE_ENV === 'development' && (
        <pre className="mt-8 max-w-2xl overflow-auto rounded-lg bg-muted p-4 text-left text-sm">
          {error.message}
        </pre>
      )}
    </div>
  );
}
