import { BadgeCheck, Users } from 'lucide-react';
import { SealMotif } from './CertificateMotif';

/**
 * Hero product composition.
 *
 * An original certificate face with two pinned panels showing what surrounds a
 * batch in the real product: the recipient list a spreadsheet produces, and
 * generation progress. Every value is synthetic sample data (`Alex Example`),
 * matching the convention used in the committed product screenshots.
 *
 * The whole composition is decorative — the headline and lead carry the
 * meaning, and the real annotated screenshots appear further down the page —
 * so it is hidden from assistive technology rather than described twice.
 */

const recipients = [
  { initial: 'A', name: 'Alex Example', tone: 'var(--sr-brand)' },
  { initial: 'P', name: 'Priya Example', tone: 'var(--sr-violet-vivid)' },
  { initial: 'M', name: 'Marcus Example', tone: 'var(--sr-teal-vivid)' },
];

function QrGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="h-full w-full" fill="none">
      <rect x="1" y="1" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.6" />
      <rect x="4" y="4" width="2" height="2" fill="currentColor" />
      <rect x="15" y="1" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.6" />
      <rect x="18" y="4" width="2" height="2" fill="currentColor" />
      <rect x="1" y="15" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.6" />
      <rect x="4" y="18" width="2" height="2" fill="currentColor" />
      <path
        d="M15 15h3v3h-3zM21 15h2M19 21h4M15 22h2"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function HeroShowcase() {
  return (
    <div className="relative" aria-hidden="true">
      {/* ------------------------------------------------ certificate face */}
      <div className="sr-panel overflow-hidden p-3 sm:p-4">
        <div className="relative aspect-[1.414/1] overflow-hidden rounded-[var(--sr-r-sm)] bg-white">
          <div className="absolute inset-[3.5%] rounded-[3px] border-2 border-[#1A5CFF]/70" />
          <div className="absolute inset-[5.5%] rounded-[2px] border border-[#1A5CFF]/25" />

          <div className="relative flex h-full flex-col items-center justify-center px-[9%] text-center">
            <SealMotif className="h-[13%] w-auto text-[#1A5CFF]" />

            <p className="mt-[4%] text-[clamp(6px,0.85vw,10px)] font-bold uppercase tracking-[0.28em] text-[#1A5CFF]">
              Certificate of Completion
            </p>
            <p className="mt-[3.5%] text-[clamp(6px,0.72vw,9px)] uppercase tracking-[0.18em] text-slate-400">
              This certifies that
            </p>

            <p className="mt-[3%] rounded-[4px] border border-[#1A5CFF]/25 bg-[#1A5CFF]/[0.04] px-[4%] py-[1.5%] font-display text-[clamp(13px,2.05vw,28px)] font-bold leading-tight tracking-[-0.02em] text-[#0B1829]">
              Alex Example
            </p>

            <p className="mt-[3.5%] text-[clamp(6px,0.78vw,10px)] text-slate-500">
              has successfully completed
            </p>
            <p className="mt-[1.5%] text-[clamp(7px,0.95vw,12px)] font-semibold text-[#0B1829]">
              Product Design Workshop
            </p>

            <div className="mt-[5%] flex w-full items-end justify-center gap-[9%]">
              <span className="flex flex-col items-center gap-[3px]">
                <span className="h-px w-[70px] bg-slate-300 sm:w-[84px]" />
                <span className="text-[clamp(5px,0.6vw,8px)] uppercase tracking-[0.14em] text-slate-400">
                  Serenity Learning Studio
                </span>
              </span>
              <span className="flex flex-col items-center gap-[3px]">
                <span className="h-px w-[52px] bg-slate-300 sm:w-[64px]" />
                <span className="text-[clamp(5px,0.6vw,8px)] uppercase tracking-[0.14em] text-slate-400">
                  July 2026
                </span>
              </span>
            </div>
          </div>

          {/* verification block, bottom-left, as the product places it */}
          <div className="absolute bottom-[5.5%] left-[6.5%] flex items-center gap-[6px]">
            <span className="h-[22px] w-[22px] text-[#0B1829]/70 sm:h-[26px] sm:w-[26px]">
              <QrGlyph />
            </span>
            <span className="font-mono text-[clamp(4px,0.5vw,7px)] leading-tight text-slate-400">
              verify.serenity.app
              <br />
              /c/SC24831
            </span>
          </div>
        </div>
      </div>

      {/* --------------------------------------------------- verified badge */}
      <div className="absolute -top-3 right-3 hidden items-center gap-1.5 rounded-full bg-[rgb(var(--sr-teal-vivid))] px-3 py-1.5 text-[0.75rem] font-bold text-[#04231F] shadow-[var(--sr-shadow-2)] sm:inline-flex">
        <BadgeCheck className="h-3.5 w-3.5" />
        QR verified
      </div>

      {/* ------------------------------------------------- recipients panel */}
      {/* Pinned high on the left, where the certificate's margin is empty. The
          copy is centred, so a panel at mid-height would sit on the recipient
          name — the one thing the composition exists to show. */}
      {/* Shown where the hero visual is full width (md) and where the two-column
          layout is wide enough to hold the overhang (xl). Between them the
          right column is ~470px and the panels were clipped by the shell. */}
      <div className="sr-float absolute -left-5 top-[24%] hidden w-[12rem] rounded-[var(--sr-r-md)] border border-[rgb(var(--sr-line))] bg-[rgb(var(--sr-canvas-raised))] p-3.5 shadow-[var(--sr-shadow-3)] md:block lg:hidden xl:block xl:-left-16">
        <p className="flex items-center gap-1.5 text-[0.6875rem] font-bold uppercase tracking-[0.14em] text-[rgb(var(--sr-ink-faint))]">
          <Users className="h-3 w-3" />
          Recipients
        </p>
        <ul className="mt-2.5 space-y-2">
          {recipients.map((person) => (
            <li key={person.name} className="flex items-center gap-2">
              <span
                className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-[0.625rem] font-bold text-white"
                style={{ background: `rgb(${person.tone})` }}
              >
                {person.initial}
              </span>
              <span className="truncate text-[0.75rem] font-medium text-[rgb(var(--sr-ink))]">
                {person.name}
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-2.5 border-t border-[rgb(var(--sr-line))] pt-2 text-[0.6875rem] text-[rgb(var(--sr-ink-faint))]">
          + 27 more from your sheet
        </p>
      </div>

      {/* --------------------------------------------------- progress panel */}
      {/* Low on the right: the verification block anchors the bottom-left, so
          this corner is the only large empty area left. */}
      <div className="sr-float-slow absolute -right-4 bottom-[9%] hidden w-[11.5rem] rounded-[var(--sr-r-md)] border border-[rgb(var(--sr-line))] bg-[rgb(var(--sr-canvas-raised))] p-3.5 shadow-[var(--sr-shadow-3)] md:block lg:hidden xl:block xl:-right-12">
        <p className="flex items-center gap-2 text-[0.75rem] font-semibold text-[rgb(var(--sr-ink))]">
          <span className="h-2 w-2 rounded-full bg-[rgb(var(--sr-teal-vivid))]" />
          Generating
        </p>
        <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-[rgb(var(--sr-canvas-sunken))]">
          <div className="h-full w-3/5 rounded-full bg-[rgb(var(--sr-brand))]" />
        </div>
        <p className="mt-2 text-[0.6875rem] text-[rgb(var(--sr-ink-faint))]">18 of 30 · PDF + PNG</p>
      </div>
    </div>
  );
}
