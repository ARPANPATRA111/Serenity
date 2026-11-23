import type { CSSProperties } from 'react';

/**
 * Guilloche rosette — the line-work printed under banknotes and security
 * certificates, and the one ornament Serenity uses.
 *
 * Each band is a single closed curve, r(θ) = R + a·sin(kθ), drawn once in
 * <defs> and repeated with small rotations. Rotating the curve is the same as
 * shifting its phase, so the overlapping copies weave the familiar mesh while
 * the markup stays a few kilobytes. Strokes use `currentColor`; set `color`
 * on the element (or a parent) to tint it.
 *
 * Pure and deterministic, so it renders identically on the server and client.
 * Pass a distinct `id` when more than one seal can appear on a page.
 */

type Band = { key: string; radius: number; amplitude: number; lobes: number; copies: number; samplesPerLobe: number; className?: string };

const BANDS: Band[] = [
  { key: 'outer', radius: 166, amplitude: 15, lobes: 30, copies: 9, samplesPerLobe: 12 },
  { key: 'middle', radius: 118, amplitude: 13, lobes: 20, copies: 7, samplesPerLobe: 12 },
  { key: 'core', radius: 60, amplitude: 14, lobes: 12, copies: 6, samplesPerLobe: 14, className: 'gl-core' },
];

const RULES = [188, 192, 144, 92, 40];

function curve({ radius, amplitude, lobes, samplesPerLobe }: Band): string {
  const steps = lobes * samplesPerLobe;
  const points: string[] = [];
  for (let index = 0; index < steps; index += 1) {
    const theta = (index / steps) * Math.PI * 2;
    const r = radius + amplitude * Math.sin(lobes * theta);
    points.push(`${(r * Math.cos(theta)).toFixed(1)} ${(r * Math.sin(theta)).toFixed(1)}`);
  }
  return `M${points.join(' ')}Z`;
}

const PATHS = Object.fromEntries(BANDS.map((band) => [band.key, curve(band)]));

export function GuillocheSeal({
  id = 'gl',
  className = '',
  draw = false,
  style,
}: {
  id?: string;
  className?: string;
  /** Draw the line-work in once on mount (respects reduced motion). */
  draw?: boolean;
  style?: CSSProperties;
}) {
  let order = 0;
  return (
    <svg
      viewBox="-200 -200 400 400"
      className={`guilloche ${draw ? 'guilloche-draw' : ''} ${className}`}
      style={style}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        {BANDS.map((band) => (
          <path key={band.key} id={`${id}-${band.key}`} d={PATHS[band.key]} pathLength={1} />
        ))}
      </defs>
      {RULES.map((radius) => (
        <circle key={radius} r={radius} className="gl-rule" />
      ))}
      {BANDS.map((band) => {
        const step = 360 / (band.lobes * band.copies);
        return (
          <g key={band.key} className={band.className}>
            {Array.from({ length: band.copies }, (_, copy) => {
              order += 1;
              return (
                <use
                  key={copy}
                  href={`#${id}-${band.key}`}
                  className="gl-fine"
                  transform={copy ? `rotate(${(copy * step).toFixed(3)})` : undefined}
                  style={{ '--i': order } as CSSProperties}
                />
              );
            })}
          </g>
        );
      })}
    </svg>
  );
}
