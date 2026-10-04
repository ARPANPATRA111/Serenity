import type { SVGProps } from 'react';

/**
 * Original certificate-inspired geometry used across the marketing surfaces.
 *
 * Every motif is abstract line/shape work drawn from the product itself —
 * an embossed seal, a batch of sheets, spreadsheet cells resolving into a
 * document, and a verification mark — so the brand reads as certificate
 * software without stock illustration or borrowed artwork.
 */

export function SealMotif({ className, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 64 64" fill="none" className={className} aria-hidden="true" {...props}>
      <circle cx="32" cy="32" r="26" stroke="currentColor" strokeOpacity=".22" />
      <circle cx="32" cy="32" r="19.5" stroke="currentColor" strokeOpacity=".38" />
      <circle cx="32" cy="32" r="13" stroke="currentColor" strokeOpacity=".8" strokeWidth="1.6" />
      <path
        d="M26.5 32.4 30.4 36.3 38 28.7"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M24 45.5 21 58l11-5.6L43 58l-3-12.5" stroke="currentColor" strokeOpacity=".45" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  );
}

export function SheetStackMotif({ className, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 64 64" fill="none" className={className} aria-hidden="true" {...props}>
      <rect x="10" y="14" width="34" height="42" rx="4" stroke="currentColor" strokeOpacity=".26" />
      <rect x="16" y="10" width="34" height="42" rx="4" stroke="currentColor" strokeOpacity=".45" />
      <rect x="22" y="6" width="34" height="42" rx="4" stroke="currentColor" strokeWidth="1.7" />
      <path d="M29 18h20M29 25h13M29 32h16" stroke="currentColor" strokeOpacity=".55" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M29 39h8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

export function DataFlowMotif({ className, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 64 64" fill="none" className={className} aria-hidden="true" {...props}>
      <rect x="4" y="16" width="22" height="32" rx="3" stroke="currentColor" strokeOpacity=".5" />
      <path d="M4 25h22M4 34h22M4 43h22M15 16v32" stroke="currentColor" strokeOpacity=".28" />
      <rect x="38" y="12" width="22" height="40" rx="3" stroke="currentColor" strokeWidth="1.7" />
      <path d="M44 24h10M44 31h7" stroke="currentColor" strokeOpacity=".6" strokeWidth="1.7" strokeLinecap="round" />
      <path
        d="M28 32h7m0 0-3-3m3 3-3 3"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function VerifyMotif({ className, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 64 64" fill="none" className={className} aria-hidden="true" {...props}>
      <rect x="7" y="7" width="18" height="18" rx="3" stroke="currentColor" strokeWidth="1.7" />
      <rect x="13" y="13" width="6" height="6" rx="1" fill="currentColor" />
      <rect x="39" y="7" width="18" height="18" rx="3" stroke="currentColor" strokeOpacity=".45" strokeWidth="1.7" />
      <rect x="7" y="39" width="18" height="18" rx="3" stroke="currentColor" strokeOpacity=".45" strokeWidth="1.7" />
      <path d="M39 39h6v6h-6zM51 39h6M45 51h6v6M39 57h6" stroke="currentColor" strokeOpacity=".7" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

/**
 * Abstract certificate face used where a decorative product-shaped surface is
 * wanted. It is unmistakably a placeholder composition — no fabricated data,
 * no recipient names, no fake browser chrome.
 */
export function CertificateFace({
  accent,
  wash,
  label,
  className = '',
}: {
  accent: string;
  wash: string;
  label: string;
  className?: string;
}) {
  return (
    <div
      className={`relative aspect-[1.414/1] overflow-hidden bg-white ${className}`}
      aria-hidden="true"
    >
      <div className="absolute inset-[4%] border" style={{ borderColor: accent, borderWidth: 2 }} />
      <div className="absolute inset-[6.5%] border" style={{ borderColor: wash }} />
      <div className="relative flex h-full flex-col items-center justify-center px-[10%] text-center">
        <SealMotif className="h-[13%] w-auto" style={{ color: accent }} />
        <p
          className="mt-[5%] text-[clamp(6px,1.05vw,10px)] font-bold uppercase tracking-[0.24em]"
          style={{ color: accent }}
        >
          {label}
        </p>
        <span className="mt-[7%] h-[5%] w-[52%] rounded-full" style={{ background: wash }} />
        <span className="mt-[3.5%] h-[3%] w-[34%] rounded-full" style={{ background: wash }} />
        <span className="mt-[6%] h-px w-[26%]" style={{ background: accent, opacity: 0.5 }} />
        <span className="mt-[5%] h-[2.5%] w-[44%] rounded-full bg-slate-200" />
      </div>
    </div>
  );
}
