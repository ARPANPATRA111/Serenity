/**
 * The one background every page shares: security paper.
 *
 * Rendered once in the root layout as a fixed layer behind all content, so the
 * landing page, sign-in, the studio and every inner page sit on the same sheet.
 *
 *   - two soft light fields (verdigris and register blue) give the page depth;
 *   - a woven guilloche ribbon: two families of sine lines with slightly
 *     different wavelengths, whose crossings make the moiré printed under
 *     banknotes; each line is a handful of quadratic segments, so the whole
 *     field is a few kilobytes;
 *   - a fine paper grain.
 *
 * No JavaScript. Where the browser supports scroll-driven animations the
 * ribbon drifts slowly against the scroll (see `.bd-*` in globals.css).
 */

type Family = { count: number; baseY: number; gap: number; amplitude: number; growth: number; wavelength: number; phase: number };

const WIDTH = 1600;

function sineLine(y: number, amplitude: number, wavelength: number, offset: number): string {
  // Quadratic segments, one per half period: the control point at twice the
  // amplitude puts the curve's apex exactly at the amplitude.
  const half = wavelength / 2;
  let x = -((offset % wavelength) + wavelength);
  let path = `M${x.toFixed(0)} ${y.toFixed(1)}Q${(x + half / 2).toFixed(0)} ${(y - 2 * amplitude).toFixed(1)} ${(x + half).toFixed(0)} ${y.toFixed(1)}`;
  x += half;
  while (x < WIDTH + wavelength) {
    x += half;
    path += `T${x.toFixed(0)} ${y.toFixed(1)}`;
  }
  return path;
}

function family({ count, baseY, gap, amplitude, growth, wavelength, phase }: Family): string {
  const lines: string[] = [];
  for (let index = 0; index < count; index += 1) {
    lines.push(sineLine(baseY + index * gap, amplitude + index * growth, wavelength, index * phase));
  }
  return lines.join('');
}

const WARP = family({ count: 18, baseY: 470, gap: 15, amplitude: 58, growth: 2.2, wavelength: 760, phase: 22 });
const WEFT = family({ count: 18, baseY: 480, gap: 15, amplitude: 64, growth: 1.6, wavelength: 820, phase: -26 });

export function SiteBackdrop() {
  return (
    <div className="site-backdrop" aria-hidden="true">
      <div className="bd-light" />
      <svg className="bd-ribbon" viewBox={`0 0 ${WIDTH} 1000`} preserveAspectRatio="xMidYMid slice" focusable="false">
        <g transform="rotate(-9 800 500)">
          <path d={WARP} className="bd-warp" />
          <path d={WEFT} className="bd-weft" />
        </g>
      </svg>
      <div className="bd-grain" />
    </div>
  );
}
