import { Check } from 'lucide-react';
import { SealMotif } from '@/components/marketing/CertificateMotif';
import { FREE_CERTIFICATE_LIMIT } from '@/lib/plans/certificateLimits';

/**
 * Signup-side value panel.
 *
 * Every line is a capability that exists today. There is no trial countdown,
 * no unlimited claim, and no customer logo wall, because none of those are
 * true of Serenity.
 */
const benefits = [
  'Design reusable certificate templates',
  'Import recipients from CSV or Excel',
  'Generate a personalised certificate per row',
  'Export as PDF, PNG, or a ZIP archive',
  'Give every certificate a verification URL and QR code',
];

export function AuthBenefits() {
  return (
    <div className="sr-card p-6 sm:p-7">
      <span
        className="grid h-11 w-11 place-items-center rounded-xl bg-[rgb(var(--sr-brand-wash))] text-[rgb(var(--sr-brand))]"
        aria-hidden="true"
      >
        <SealMotif className="h-6 w-6" />
      </span>
      <h2 className="sr-h3 mt-5">What the free plan includes</h2>
      <p className="sr-body mt-2">
        {FREE_CERTIFICATE_LIMIT} persisted certificates, no card required, and the complete workflow
        from design through verification.
      </p>
      <ul className="mt-5 space-y-3">
        {benefits.map((benefit) => (
          <li key={benefit} className="sr-body flex gap-3">
            <Check
              className="mt-1 h-4 w-4 shrink-0 text-[rgb(var(--sr-teal))]"
              aria-hidden="true"
            />
            <span>{benefit}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Condensed variant used above the fold on small screens. */
export function AuthBenefitsCompact() {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-2">
      {[
        'CSV and Excel import',
        'Bulk personalisation',
        'QR verification',
      ].map((item) => (
        <li key={item} className="sr-body flex items-center gap-1.5 text-sm">
          <Check className="h-3.5 w-3.5 shrink-0 text-[rgb(var(--sr-teal))]" aria-hidden="true" />
          {item}
        </li>
      ))}
    </ul>
  );
}
