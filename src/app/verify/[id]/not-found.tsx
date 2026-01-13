import Link from 'next/link';

export default function VerifyNotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <div className="text-center">
        <h1 className="font-display text-6xl font-bold text-primary">404</h1>
        <h2 className="mt-4 text-2xl font-semibold">Certificate Not Found</h2>
        <p className="mt-2 text-muted-foreground">
          The certificate ID you&apos;re looking for doesn&apos;t exist or may have been removed.
        </p>
        <Link
          href="/"
          className="btn-primary mt-8 inline-flex"
        >
          Go to Homepage
        </Link>
      </div>
    </div>
  );
}
