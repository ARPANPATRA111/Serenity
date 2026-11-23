'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowUpRight, ChevronLeft, ChevronRight, Pause, Play, ShieldCheck, Sheet } from 'lucide-react';
import { GuillocheSeal } from '@/components/brand/GuillocheSeal';

export type ShowcaseSlide = {
  symbolId: string;
  templateId: string;
  templateName: string;
  category: string;
  recipient: string;
};

/** A new certificate lands every five seconds. */
const INTERVAL = 5000;
/** Sheets drawn at once: the new top sheet, two behind it, one fading out. */
const DEPTH = 4;

/**
 * The landing proof: a stack of finished certificates, each a different
 * curated design. Every five seconds a new sheet drops onto the pile and the
 * older ones settle back, without end.
 *
 * It keeps playing while the page scrolls and while the pointer rests on it;
 * only the pause button (and a hidden tab) stops it. Each change restarts the
 * five-second timer, so a manual step is followed by a full interval. With
 * reduced motion the sheets swap without the drop animation.
 */
export function HeroShowcase({ slides }: { slides: ShowcaseSlide[] }) {
  const count = slides.length;
  // The pile, top sheet first. Each sheet keeps a serial key for its whole
  // life, so a new one mounts (and drops in) while the rest slide back.
  const [deck, setDeck] = useState(() =>
    Array.from({ length: Math.min(DEPTH - 1, count) }, (_, depth) => ({
      key: DEPTH - depth,
      slide: (count - depth) % count,
    })),
  );
  const [stopped, setStopped] = useState(false);

  const go = useCallback((step: number) => {
    setDeck((pile) => [
      { key: pile[0].key + 1, slide: (pile[0].slide + step + count) % count },
      ...pile,
    ].slice(0, DEPTH));
  }, [count]);

  const playing = !stopped && count > 1;
  const topKey = deck[0].key;

  useEffect(() => {
    if (!playing) return;
    const timer = window.setTimeout(() => {
      go(1);
    }, INTERVAL);
    return () => window.clearTimeout(timer);
  }, [playing, topKey, go]);

  const index = deck[0].slide;
  const current = slides[index];

  return (
    <figure className="proof-folio" aria-roledescription="carousel" aria-label="Certificates made with Serenity">
      <div className="proof-stage">
        <GuillocheSeal id="hero-seal" className="proof-rosette" draw />
        <div className="proof-deck">
          {deck.map((entry, depth) => ({ ...entry, depth })).reverse().map(({ key, slide, depth }) => (
            <div key={key} className="proof-card" data-depth={depth} aria-hidden={depth !== 0}>
              <svg viewBox="0 0 842 595" role={depth === 0 ? 'img' : undefined}
                aria-label={depth === 0 ? `${slides[slide].templateName} certificate awarded to ${slides[slide].recipient}` : undefined}>
                <use href={`#${slides[slide].symbolId}`} />
              </svg>
            </div>
          ))}
        </div>
      </div>

      {/* What the product did for this sheet, kept beside it, never over it. */}
      <div className="proof-meta" aria-hidden="true">
        <div className="proof-chip">
          <span className="proof-chip-icon"><Sheet size={15} /></span>
          <span>
            <span className="proof-chip-label">Spreadsheet row {index + 1}</span>
            <span key={current.recipient} className="proof-chip-value">{current.recipient}</span>
          </span>
        </div>
        <div className="proof-chip">
          <span className="proof-chip-icon is-verified"><ShieldCheck size={15} /></span>
          <span>
            <span className="proof-chip-value">Verified record</span>
            <span className="proof-chip-label">Public link and QR code</span>
          </span>
        </div>
      </div>

      <figcaption className="proof-caption">
        <Link href={`/editor?template=${current.templateId}`} className="proof-template">
          <span key={current.templateId} className="proof-template-name">{current.templateName}</span>
          <ArrowUpRight size={16} aria-hidden="true" />
        </Link>
        <div className="proof-controls">
          <button type="button" aria-label="Previous design" onClick={() => go(-1)}><ChevronLeft size={16} aria-hidden="true" /></button>
          <span className="proof-count" aria-live={playing ? 'off' : 'polite'} aria-atomic="true">
            {index + 1} / {count}<span className="sr-only">, {current.templateName}</span>
          </span>
          <button type="button" aria-label="Next design" onClick={() => go(1)}><ChevronRight size={16} aria-hidden="true" /></button>
          <button
            type="button"
            aria-label={stopped ? 'Play slideshow' : 'Pause slideshow'}
            onClick={() => {
              // Resuming shows the next design straight away.
              if (stopped) go(1);
              setStopped((value) => !value);
            }}
          >
            {stopped ? <Play size={14} aria-hidden="true" /> : <Pause size={14} aria-hidden="true" />}
          </button>
        </div>
        <span className="proof-timer" aria-hidden="true">
          <span key={topKey} style={{ animationDuration: `${INTERVAL}ms`, animationPlayState: playing ? 'running' : 'paused' }} />
        </span>
      </figcaption>
    </figure>
  );
}
