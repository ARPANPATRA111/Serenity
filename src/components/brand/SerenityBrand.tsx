import type { SVGProps } from 'react';

export function SerenityMark({
  className = '',
  ...props
}: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 48 48"
      fill="none"
      className={className}
      aria-hidden="true"
      {...props}
    >
      <rect x="1" y="1" width="46" height="46" rx="15" fill="#5B5FEF" />
      <path
        d="M29 1h3c8.3 0 15 6.7 15 15v16c0 8.3-6.7 15-15 15H20L29 1Z"
        fill="#8B5CF6"
        fillOpacity=".72"
      />
      <path
        d="M34.8 10.8a15.2 15.2 0 0 1 11.4 11.4v9.4L25.4 10.8h9.4Z"
        fill="#22D3EE"
        fillOpacity=".28"
      />
      <path d="M14 9.5h15.2l5.3 5.3v19.7a3 3 0 0 1-3 3h-17a3 3 0 0 1-3-3v-22a3 3 0 0 1 2.5-3Z" fill="white" />
      <path d="M29 9.5v5.8h5.5" fill="#DDE2FF" />
      <path d="M29 9.5v5.8h5.5" stroke="#A5B4FC" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M17 18.5h12M17 22.5h8" stroke="#818CF8" strokeWidth="2" strokeLinecap="round" />
      <path d="m20.5 33.2-2.2 7 5.7-3.1 5.7 3.1-2.2-7" fill="#FB7185" />
      <circle cx="24" cy="30.2" r="6.2" fill="#5B5FEF" stroke="white" strokeWidth="2" />
      <path d="m21.3 30.2 1.8 1.8 3.8-4" stroke="white" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function SerenityBrand({
  compact = false,
  className = '',
}: {
  compact?: boolean;
  className?: string;
}) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <SerenityMark className="h-10 w-10 shrink-0 drop-shadow-[0_8px_14px_rgba(79,70,229,.28)]" />
      {!compact && <span className="font-display text-lg font-bold tracking-[-0.025em]">Serenity</span>}
    </span>
  );
}
