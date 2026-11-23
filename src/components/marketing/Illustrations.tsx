/**
 * Product illustrations for the public pages: each one explains a step with
 * a picture instead of a paragraph. Pure SVG, themed through the `--sr-*`
 * tokens, animated with CSS (see `.art-*` in marketing.css) and still for
 * reduced-motion users.
 */

const ink = 'rgb(var(--sr-ink))';
const soft = 'rgb(var(--sr-ink-faint) / .35)';
const line = 'rgb(var(--sr-line-strong))';
const paper = 'rgb(var(--sr-canvas-raised))';
const brand = 'rgb(var(--sr-brand))';
const violet = 'rgb(var(--sr-violet-vivid))';
const amber = 'rgb(var(--sr-amber-vivid))';

/** Designing: a sheet on the canvas, a selected field and alignment guides. */
export function DesignArt({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 240 160" className={`art art-design ${className}`} aria-hidden="true">
      <rect x="8" y="8" width="224" height="144" rx="14" fill={paper} stroke={line} />
      <circle cx="22" cy="21" r="3" fill={soft} /><circle cx="32" cy="21" r="3" fill={soft} /><circle cx="42" cy="21" r="3" fill={soft} />
      <rect x="36" y="38" width="168" height="102" rx="3" fill="#fffdf7" stroke={line} />
      <rect x="36" y="38" width="30" height="102" fill="#1f2a5c" />
      <circle cx="51" cy="89" r="9" fill="none" stroke={amber} strokeWidth="1.5" />
      <rect x="82" y="54" width="62" height="5" rx="2.5" fill={soft} />
      <rect x="82" y="66" width="96" height="9" rx="3" fill="#1f2a5c" />
      <g className="art-select">
        <rect x="80" y="86" width="104" height="18" rx="2" fill={`rgb(var(--sr-brand) / .1)`} stroke={brand} strokeDasharray="3 2" />
        <rect x="88" y="92" width="74" height="6" rx="3" fill={brand} />
      </g>
      <line className="art-guide" x1="132" y1="30" x2="132" y2="148" stroke={violet} strokeDasharray="2 3" />
      <rect x="82" y="116" width="40" height="3" rx="1.5" fill={soft} /><rect x="142" y="116" width="40" height="3" rx="1.5" fill={soft} />
      <path className="art-cursor" d="M176 104l0 18 5-5 4 8 3-1.5-4-8 7 0z" fill={ink} stroke={paper} strokeWidth="1.2" />
    </svg>
  );
}

/** Importing: spreadsheet rows become a stack of personalised sheets. */
export function ImportArt({ className = '' }: { className?: string }) {
  const rows = [0, 1, 2, 3];
  return (
    <svg viewBox="0 0 240 160" className={`art art-import ${className}`} aria-hidden="true">
      <rect x="8" y="22" width="112" height="116" rx="10" fill={paper} stroke={line} />
      <rect x="8" y="22" width="112" height="22" rx="10" fill={`rgb(var(--sr-brand) / .14)`} />
      <rect x="18" y="30" width="34" height="6" rx="3" fill={brand} /><rect x="62" y="30" width="44" height="6" rx="3" fill={brand} />
      {rows.map((row) => (
        <g key={row} className="art-row" style={{ animationDelay: `${row * 0.5}s` }}>
          <rect x="12" y={50 + row * 21} width="104" height="17" rx="4" fill="transparent" />
          <rect x="18" y={56 + row * 21} width="30" height="5" rx="2.5" fill={soft} />
          <rect x="62" y={56 + row * 21} width={36 - row * 4} height="5" rx="2.5" fill={soft} />
        </g>
      ))}
      <path d="M128 80h26" stroke={brand} strokeWidth="2" strokeLinecap="round" className="art-flow" />
      <path d="M148 74l7 6-7 6" fill="none" stroke={brand} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {[2, 1, 0].map((sheet) => (
        <g key={sheet} transform={`translate(${168 + sheet * 6} ${46 + sheet * 8}) rotate(${sheet * 4})`}>
          <rect width="56" height="40" rx="2" fill={['#151a3b', '#fffaf6', '#fbf8f0'][sheet]} stroke={line} />
          <rect x="10" y="14" width="36" height="5" rx="2.5" fill={['#e8cf8e', '#ff7a59', '#0f4d3f'][sheet]} />
          <rect x="16" y="24" width="24" height="3" rx="1.5" fill={sheet === 0 ? '#8f96c0' : soft} />
        </g>
      ))}
    </svg>
  );
}

/** Delivering: an envelope, a QR code and a verified seal. */
export function DeliverArt({ className = '' }: { className?: string }) {
  const qr = [
    [0, 0], [1, 0], [2, 0], [0, 1], [2, 1], [0, 2], [1, 2], [2, 2], [4, 0], [5, 1], [4, 2], [3, 3], [5, 3], [0, 4], [2, 4], [4, 4], [1, 5], [3, 5], [5, 5],
  ];
  return (
    <svg viewBox="0 0 240 160" className={`art art-deliver ${className}`} aria-hidden="true">
      <g className="art-envelope">
        <rect x="16" y="44" width="120" height="80" rx="10" fill={paper} stroke={line} />
        <path d="M18 50l58 42 58-42" fill="none" stroke={line} strokeWidth="1.5" />
        <rect x="40" y="30" width="72" height="50" rx="3" fill="#fbf8f0" stroke={line} />
        <rect x="52" y="42" width="48" height="5" rx="2.5" fill="#0f4d3f" /><rect x="60" y="53" width="32" height="3" rx="1.5" fill={soft} />
      </g>
      <g transform="translate(156 40)">
        <rect width="66" height="66" rx="10" fill={paper} stroke={line} />
        {qr.map(([x, y]) => <rect key={`${x}-${y}`} x={9 + x * 8} y={9 + y * 8} width="7" height="7" rx="1.5" fill={ink} />)}
      </g>
      <g transform="translate(196 116)">
        <g className="art-badge">
          <circle r="18" fill={brand} />
          <path d="M-7 0l5 5 9-10" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        </g>
      </g>
    </svg>
  );
}

/** Verification: the public record on a phone, beside the printed QR. */
export function VerifyArt({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 320 300" className={`art art-verify ${className}`} aria-hidden="true">
      <g transform="translate(20 46) rotate(-6)">
        <rect width="170" height="120" rx="3" fill="#151a3b" />
        <rect x="8" y="8" width="154" height="104" fill="none" stroke="#c9a55a" strokeWidth=".8" />
        <rect x="45" y="30" width="80" height="6" rx="3" fill="#c9a55a" />
        <rect x="35" y="48" width="100" height="10" rx="4" fill="#f3e2b3" />
        <rect x="50" y="66" width="70" height="4" rx="2" fill="#8f96c0" />
        <g transform="translate(130 80)">
          <rect width="26" height="26" rx="2" fill="#fff" />
          <rect x="4" y="4" width="7" height="7" fill="#151a3b" /><rect x="15" y="4" width="7" height="7" fill="#151a3b" />
          <rect x="4" y="15" width="7" height="7" fill="#151a3b" /><rect x="15" y="16" width="4" height="4" fill="#151a3b" />
        </g>
      </g>
      <path className="art-flow" d="M178 150 C 196 150 196 120 214 118" fill="none" stroke={brand} strokeWidth="1.6" strokeDasharray="4 4" />
      <g transform="translate(188 22)">
        <rect width="118" height="232" rx="22" fill={ink} />
        <rect x="6" y="6" width="106" height="220" rx="17" fill={paper} />
        <rect x="44" y="12" width="30" height="5" rx="2.5" fill={soft} />
        <g transform="translate(59 64)">
          <g className="art-badge">
            <circle r="20" fill={`rgb(var(--sr-brand) / .14)`} />
            <circle r="13" fill={brand} />
            <path d="M-5 0l3.5 3.5 6.5-7" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
          </g>
        </g>
        <rect x="32" y="96" width="54" height="7" rx="3.5" fill={brand} />
        <rect x="18" y="116" width="82" height="9" rx="3" fill={ink} />
        {[134, 148, 162, 176].map((y, row) => (
          <g key={y}>
            <rect x="18" y={y} width="30" height="4" rx="2" fill={soft} />
            <rect x={row % 2 ? 58 : 52} y={y} width={row % 2 ? 42 : 48} height="4" rx="2" fill={line} />
          </g>
        ))}
        <rect x="18" y="196" width="82" height="18" rx="9" fill={`rgb(var(--sr-brand) / .12)`} />
        <rect x="36" y="203" width="46" height="4" rx="2" fill={brand} />
      </g>
    </svg>
  );
}
