import Link from 'next/link';
import { ArrowLeft, Check, MessageCircle } from 'lucide-react';
import { SerenityBrand } from '@/components/brand/SerenityBrand';

export default function PremiumPage() {
  return (
    <main className="app-shell min-h-screen bg-background px-5 py-10 text-foreground">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-center justify-between">
          <Link href="/"><SerenityBrand /></Link>
          <Link href="/dashboard" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Dashboard
          </Link>
        </div>
        <section className="mt-12 rounded-3xl border border-border bg-card p-7 shadow-xl sm:p-12">
          <span className="inline-flex items-center gap-2 rounded-full bg-amber-500/10 px-3 py-1.5 text-xs font-semibold text-amber-600 dark:text-amber-400">
            <MessageCircle className="h-3.5 w-3.5" /> Pro access by conversation
          </span>
          <h1 className="mt-6 font-display text-4xl font-bold tracking-tight sm:text-5xl">Pro starts at $20 per month.</h1>
          <p className="mt-5 text-lg leading-8 text-muted-foreground">
            Pro is discussed before activation so generation volume, delivery limits, and support expectations are clear. There is no automatic checkout on this page.
          </p>
          <div className="mt-8 rounded-2xl border border-border bg-muted/30 p-6">
            <h2 className="font-semibold">Free tier included today</h2>
            <ul className="mt-4 space-y-3 text-sm">
              {[
                'Certificate template design and private saves',
                'CSV and Excel data import',
                'PDF generation and verification links',
                'Up to five persisted generated certificates',
              ].map((feature) => (
                <li key={feature} className="flex gap-3"><Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />{feature}</li>
              ))}
            </ul>
          </div>
          <p className="mt-7 text-sm leading-6 text-muted-foreground">
            Return to the pricing section to send a Pro interest request. Submitting a request does not change your account or create a payment.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link href="/dashboard" className="inline-flex min-h-11 items-center justify-center rounded-xl bg-primary px-5 font-semibold text-primary-foreground">Continue with free tier</Link>
            <Link href="/#pricing" className="inline-flex min-h-11 items-center justify-center rounded-xl border border-border px-5 font-semibold hover:bg-muted">Discuss Pro access</Link>
          </div>
        </section>
      </div>
    </main>
  );
}
