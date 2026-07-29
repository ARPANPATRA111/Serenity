'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { Check, Loader2, ShieldCheck, X } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { FREE_CERTIFICATE_LIMIT } from '@/lib/plans/certificateLimits';

/**
 * Free-tier claims mirror the server-enforced allowance in
 * `certificateLimits.ts`. Pro is a contact request, not a self-serve
 * subscription, and the copy says so — Serenity has no billing integration.
 */
const freeFeatures = [
  `${FREE_CERTIFICATE_LIMIT} persisted certificates in total`,
  'Visual editor and reusable templates',
  'CSV and Excel column mapping',
  'PDF, PNG, and ZIP export',
  'Verification URL and QR code on every certificate',
];

const proFeatures = [
  'Higher certificate and batch limits',
  'Higher reviewed email allowances',
  'Public and private template workflows',
  'Everything included in Free',
];

export function PricingSection() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [requirements, setRequirements] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');

  const submitInterest = async (event: FormEvent) => {
    event.preventDefault();
    setStatus('sending');

    try {
      const response = await fetch('/api/leads/capture', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          feature: 'pro_pricing',
          metadata: { requirements: requirements.trim().slice(0, 1200), source: 'landing_pricing' },
        }),
      });

      if (!response.ok) throw new Error('Unable to send request');
      setStatus('sent');
    } catch {
      setStatus('error');
    }
  };

  return (
    <section id="pricing" className="sr-section sr-section-subtle" style={{ scrollMarginTop: '4rem' }}>
      <div className="sr-container">
        <div className="mx-auto max-w-2xl text-center">
          <p className="sr-eyebrow">Pricing</p>
          <h2 className="sr-h2 mt-3">Start free. Talk to us when the programme grows.</h2>
          <p className="sr-lead mt-4">
            The free plan covers the complete workflow, from design through verification, with a
            server-enforced allowance. Pro starts at $20 per month and is arranged through a
            request — there is no self-serve checkout yet.
          </p>
        </div>

        <div className="mx-auto mt-12 grid max-w-3xl gap-6 md:grid-cols-2">
          <div className="sr-card flex h-full flex-col p-7">
            <p className="sr-eyebrow">Available now</p>
            <h3 className="sr-h3 mt-3 text-2xl">Free</h3>
            <p className="mt-4 flex items-end gap-2">
              <span className="font-display text-5xl font-bold leading-none">$0</span>
              <span className="sr-hint pb-1">no card required</span>
            </p>
            <ul className="mt-7 flex-1 space-y-3">
              {freeFeatures.map((feature) => (
                <li key={feature} className="sr-body flex gap-3">
                  <Check className="mt-1 h-4 w-4 shrink-0 text-[rgb(var(--sr-aqua))]" aria-hidden="true" />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
            <Link href="/signup" className="sr-btn sr-btn-primary mt-8 w-full">
              Create a free account
            </Link>
          </div>

          <div className="sr-card flex h-full flex-col border-[rgb(var(--sr-brand)/0.4)] p-7">
            <p className="sr-eyebrow">By request</p>
            <h3 className="sr-h3 mt-3 text-2xl">Pro</h3>
            <p className="mt-4 flex items-end gap-2">
              <span className="font-display text-5xl font-bold leading-none">$20</span>
              <span className="sr-hint pb-1">per month, starting point</span>
            </p>
            <ul className="mt-7 flex-1 space-y-3">
              {proFeatures.map((feature) => (
                <li key={feature} className="sr-body flex gap-3">
                  <Check className="mt-1 h-4 w-4 shrink-0 text-[rgb(var(--sr-aqua))]" aria-hidden="true" />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={() => setDialogOpen(true)}
              className="sr-btn sr-btn-secondary mt-8 w-full"
            >
              Request a pricing conversation
            </button>
          </div>
        </div>

        <p className="sr-body mx-auto mt-8 flex max-w-3xl items-start gap-3">
          <ShieldCheck
            className="mt-0.5 h-5 w-5 shrink-0 text-[rgb(var(--sr-brand))]"
            aria-hidden="true"
          />
          <span>
            Usage limits and plan changes stay server-controlled. Nothing on this page can grant Pro
            access or reset a certificate count.
          </span>
        </p>
      </div>

      <Modal
        isOpen={dialogOpen}
        onClose={() => setDialogOpen(false)}
        showCloseButton={false}
        className="max-w-lg overflow-hidden p-0"
      >
        <div className="sr-scope">
          <div className="relative border-b border-[rgb(var(--sr-line))] bg-[rgb(var(--sr-canvas-subtle))] px-6 py-6">
            <button
              type="button"
              onClick={() => setDialogOpen(false)}
              className="sr-btn sr-btn-quiet sr-btn-icon absolute right-3 top-3"
              aria-label="Close pricing dialog"
            >
              <X className="h-4 w-4" />
            </button>
            <h3 className="sr-h3 pr-10 text-2xl">Tell us what you need</h3>
            <p className="sr-body mt-2">
              $20 per month is the starting plan. We can discuss volume, delivery, and operating
              limits before anything is activated.
            </p>
          </div>
          <div className="p-6">
            {status === 'sent' ? (
              <div role="status" className="sr-notice sr-notice-success flex-col">
                <p className="font-bold">Request received</p>
                <p className="mt-1">
                  Your details are saved for a Pro pricing conversation. No subscription or
                  entitlement was activated.
                </p>
                <button
                  type="button"
                  onClick={() => setDialogOpen(false)}
                  className="sr-btn sr-btn-primary mt-4 self-start"
                >
                  Close
                </button>
              </div>
            ) : (
              <form onSubmit={submitInterest} className="space-y-5">
                <div>
                  <label htmlFor="pricing-email" className="sr-field-label mb-2">
                    Work email
                  </label>
                  <input
                    id="pricing-email"
                    type="email"
                    required
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    className="sr-input"
                    placeholder="you@organization.com"
                  />
                </div>
                <div>
                  <label htmlFor="pricing-needs" className="sr-field-label mb-2">
                    What should the plan support?{' '}
                    <span className="font-normal text-[rgb(var(--sr-ink-faint))]">(optional)</span>
                  </label>
                  <textarea
                    id="pricing-needs"
                    value={requirements}
                    onChange={(event) => setRequirements(event.target.value)}
                    maxLength={1200}
                    rows={4}
                    className="sr-input resize-none"
                    placeholder="Approximate certificates per month, email volume, team size, or rollout timing"
                  />
                </div>
                {status === 'error' && (
                  <p role="alert" className="sr-notice sr-notice-error">
                    The request could not be sent. Please try again.
                  </p>
                )}
                <button
                  type="submit"
                  disabled={status === 'sending'}
                  className="sr-btn sr-btn-primary w-full"
                >
                  {status === 'sending' ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Sending request…
                    </>
                  ) : (
                    'Send request'
                  )}
                </button>
                <p className="sr-hint text-center">
                  This sends an interest request only. It does not create a payment or change your
                  account.
                </p>
              </form>
            )}
          </div>
        </div>
      </Modal>
    </section>
  );
}
