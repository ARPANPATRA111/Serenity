/**
 * 404 Not Found Page
 */

import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 text-center">
      <div className="mb-4 text-8xl font-bold text-primary/20">404</div>
      
      <h2 className="font-display text-2xl font-bold">Page Not Found</h2>
      <p className="mt-2 max-w-md text-muted-foreground">
        The page you're looking for doesn't exist or has been moved.
      </p>
      
      <div className="mt-8 flex gap-4">
        <Link href="/" className="btn-primary">
          Go Home
        </Link>
        <Link href="/dashboard" className="btn-outline">
          Dashboard
        </Link>
      </div>
    </div>
  );
}
