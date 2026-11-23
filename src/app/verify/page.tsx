'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldCheck, ArrowRight, Loader2, QrCode, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { SerenityBrand, SerenityMark } from '@/components/brand/SerenityBrand';
import { extractCertificateId } from '@/lib/verification/certificateId';
import { GuillocheSeal } from '@/components/brand/GuillocheSeal';

export default function VerifyPage() {
  const [query, setQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [inputError, setInputError] = useState<string | null>(null);
  const router = useRouter();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    // Accepts a bare ID, any verification URL (with tracking parameters,
    // repeated slashes or trailing punctuation) or a line of text holding one.
    const id = extractCertificateId(query);
    if (!id) {
      setInputError('That does not look like a certificate ID or verification link. Check it and try again.');
      return;
    }

    setInputError(null);
    setIsSearching(true);
    router.push(`/verify/${id}`);
  };

  return (
    <div className="app-shell flex min-h-screen flex-col">
      {/* Navbar */}
      <header className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" aria-label="Serenity home"><SerenityBrand /></Link>
        <ThemeToggle />
      </header>

      <main className="verify-desk flex flex-1 items-center justify-center px-4 py-12">
        <section className="verify-document">
          <GuillocheSeal id="verify-seal" className="verify-watermark" />
          <div className="verify-emblem"><ShieldCheck size={32} strokeWidth={1.4} aria-hidden="true" /></div>
          <h1>Verify a certificate</h1>
          <p className="mt-3 text-muted-foreground">Look up the original record to check the recipient, issuer and date on a certificate.</p>
          <form onSubmit={handleSearch} className="mt-7 space-y-3">
            <label htmlFor="certificate-search" className="block text-sm font-semibold">Certificate ID or verification URL</label>
            <input id="certificate-search" value={query} onChange={(event) => {
              setQuery(event.target.value);
              if (inputError) setInputError(null);
            }} placeholder="Paste an ID or link" aria-invalid={Boolean(inputError)}
              aria-describedby={inputError ? 'verify-input-error' : undefined} autoCapitalize="none" autoCorrect="off"
              spellCheck={false} className="input w-full" required />
            {inputError && (
              <p id="verify-input-error" role="alert" className="flex items-start gap-2 text-left text-sm text-error">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                {inputError}
              </p>
            )}

            <button type="submit" disabled={isSearching || !query.trim()} className="btn-primary w-full">
              {isSearching ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Verifying...
                </>
              ) : (
                <>
                  Verify Certificate
                  <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
                </>
              )}
            </button>
          </form>
          <p className="mt-6 flex items-start gap-2 border-t border-border pt-4 text-sm text-muted-foreground">
            <QrCode size={18} className="shrink-0" aria-hidden="true" />
            You can also scan the QR code on a printed certificate.
          </p>
        </section>
      </main>
      
      {/* Footer */}
      <footer className="border-t border-border bg-card/50 py-6 text-center text-sm text-muted-foreground">
        <div className="flex items-center justify-center gap-2">
          <SerenityMark className="h-5 w-5" />
          <span>© {new Date().getFullYear()} Serenity. All rights reserved.</span>
        </div>
      </footer>
    </div>
  );
}
