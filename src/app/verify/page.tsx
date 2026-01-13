'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldCheck, Search, ArrowRight, Loader2 } from 'lucide-react';
import Link from 'next/link';

export default function VerifyPage() {
  const [query, setQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const router = useRouter();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setIsSearching(true);
    
    // Extract ID if a full URL is pasted
    let id = query.trim();
    if (id.includes('/verify/')) {
      const parts = id.split('/verify/');
      if (parts.length > 1) {
        id = parts[1].split('?')[0]; // Remove query params if any
      }
    }

    // Simulate short delay for UX then redirect
    setTimeout(() => {
      router.push(`/verify/${id}`);
    }, 500);
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Navbar */}
      <header className="flex h-16 items-center border-b border-border bg-card px-6">
        <div className="flex items-center gap-2 font-bold text-primary">
          <ShieldCheck className="h-6 w-6" />
          <span>Serenity Verify</span>
        </div>
        <div className="ml-auto">
          <Link href="/" className="text-sm font-medium text-muted-foreground hover:text-foreground">
            Home
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex flex-1 flex-col items-center justify-center p-6">
        <div className="w-full max-w-md space-y-8 text-center">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold tracking-tight">Verify Certificate</h1>
            <p className="text-muted-foreground">
              Enter a certificate ID or paste the verification URL to check its validity.
            </p>
          </div>

          <form onSubmit={handleSearch} className="space-y-4">
            <div className="relative">
              <div className="absolute left-3 top-3 text-muted-foreground">
                <Search className="h-5 w-5" />
              </div>
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Certificate ID or Verification URL"
                className="h-11 w-full rounded-md border border-input bg-background pl-10 pr-4 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                required
              />
            </div>
            
            <button
              type="submit"
              disabled={isSearching || !query.trim()}
              className="group flex h-11 w-full items-center justify-center gap-2 rounded-md bg-primary px-8 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-50"
            >
              {isSearching ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  Verify Now
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </>
              )}
            </button>
          </form>

          <div className="rounded-lg border border-border bg-card/50 p-4 text-left text-sm text-muted-foreground">
            <p className="font-medium text-foreground mb-1">How it works:</p>
            <ul className="list-inside list-disc space-y-1">
              <li>Check the authenticity of any Serenity certificate.</li>
              <li>View issuer details and issuance date.</li>
              <li>Confirm the recipient's identity.</li>
            </ul>
          </div>
        </div>
      </main>
      
      {/* Footer */}
      <footer className="border-t border-border bg-card py-6 text-center text-sm text-muted-foreground">
        © {new Date().getFullYear()} Serenity. All rights reserved.
      </footer>
    </div>
  );
}
