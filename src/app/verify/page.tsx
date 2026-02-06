'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { ShieldCheck, Search, ArrowRight, Loader2, Award, CheckCircle, QrCode, Link2, FileSearch } from 'lucide-react';
import Link from 'next/link';
import { ThemeToggle } from '@/components/ui/ThemeToggle';

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

  const features = [
    {
      icon: ShieldCheck,
      title: 'Verify Authenticity',
      description: 'Confirm the certificate is genuine and has not been tampered with',
      color: 'from-green-500 to-emerald-500',
    },
    {
      icon: FileSearch,
      title: 'View Details',
      description: 'See issuer information, recipient, and issuance date',
      color: 'from-blue-500 to-cyan-500',
    },
    {
      icon: QrCode,
      title: 'QR Code Support',
      description: 'Paste verification URLs from scanned QR codes',
      color: 'from-violet-500 to-purple-500',
    },
  ];

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Navbar */}
      <header className="sticky top-0 z-50 border-b border-border bg-card/80 backdrop-blur-lg">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-2">
            <div className="relative h-8 w-8 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-md">
              <Award className="h-4 w-4 text-white" />
            </div>
            <span className="font-display text-lg font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">Serenity</span>
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              Home
            </Link>
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex flex-1 flex-col items-center justify-center px-4 py-12 sm:py-16">
        <div className="w-full max-w-xl space-y-8 text-center">
          {/* Icon */}
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
            className="flex justify-center"
          >
            <div className="relative">
              <div className="absolute inset-0 rounded-full bg-primary/20 blur-xl animate-pulse" />
              <div className="relative h-20 w-20 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-2xl shadow-primary/30">
                <ShieldCheck className="h-10 w-10 text-white" />
              </div>
            </div>
          </motion.div>

          {/* Title */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="space-y-3"
          >
            <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight">
              Verify Certificate
            </h1>
            <p className="text-lg text-muted-foreground max-w-md mx-auto">
              Enter a certificate ID or paste the verification URL to check its authenticity.
            </p>
          </motion.div>

          {/* Search Form */}
          <motion.form 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            onSubmit={handleSearch} 
            className="space-y-4"
          >
            <div className="relative group">
              <div className="absolute -inset-1 bg-gradient-to-r from-primary/50 to-accent/50 rounded-xl blur opacity-0 group-focus-within:opacity-100 transition-opacity" />
              <div className="relative flex items-center">
                <div className="absolute left-4 text-muted-foreground">
                  <Search className="h-5 w-5" />
                </div>
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Certificate ID or verification URL"
                  className="h-14 w-full rounded-xl border border-border bg-card pl-12 pr-4 text-base ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 transition-all"
                  required
                />
              </div>
            </div>
            
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              type="submit"
              disabled={isSearching || !query.trim()}
              className="group flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary to-accent px-8 text-base font-semibold text-white shadow-lg shadow-primary/25 transition-all hover:shadow-xl hover:shadow-primary/30 disabled:pointer-events-none disabled:opacity-50"
            >
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
            </motion.button>
          </motion.form>

          {/* Features */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-8"
          >
            {features.map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 + index * 0.1 }}
                className="rounded-xl border border-border bg-card p-5 text-left hover:border-primary/30 hover:bg-card/80 transition-all"
              >
                <div className={`inline-flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br ${feature.color} mb-3`}>
                  <feature.icon className="h-5 w-5 text-white" />
                </div>
                <h3 className="font-semibold text-sm mb-1">{feature.title}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{feature.description}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </main>
      
      {/* Footer */}
      <footer className="border-t border-border bg-card/50 py-6 text-center text-sm text-muted-foreground">
        <div className="flex items-center justify-center gap-2">
          <Award className="h-4 w-4 text-primary" />
          <span>© {new Date().getFullYear()} Serenity. All rights reserved.</span>
        </div>
      </footer>
    </div>
  );
}
