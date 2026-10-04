'use client';

import { useId, useMemo, useState } from 'react';
import { Table2, BarChart3 } from 'lucide-react';
import { formatExact, niceScale } from './format';
import styles from './console.module.css';

interface DailyColumnsProps {
  title: string;
  subtitle: string;
  days: string[];
  values: number[];
  unit: string;
}

function dayLabel(day: string, style: 'short' | 'long'): string {
  const date = new Date(`${day}T00:00:00Z`);
  return date.toLocaleDateString('en-US', style === 'short'
    ? { month: 'short', day: 'numeric', timeZone: 'UTC' }
    : { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}

const PLOT_HEIGHT = 160;

export function DailyColumns({ title, subtitle, days, values, unit }: DailyColumnsProps) {
  const [showTable, setShowTable] = useState(false);
  const [active, setActive] = useState<number | null>(null);
  const titleId = useId();

  const { top, ticks } = useMemo(() => niceScale(Math.max(0, ...values)), [values]);
  const peakIndex = values.reduce((best, value, index) => (value > values[best] ? index : best), 0);
  const lastIndex = values.length - 1;
  const total = values.reduce((sum, value) => sum + value, 0);
  // Label the latest day and the peak only; the axis, tooltip and table carry the rest.
  const labelled = new Set(total > 0 ? [lastIndex, peakIndex] : []);

  return (
    <figure className={`${styles.viz} rounded-2xl border border-border bg-card p-4 sm:p-5`} aria-labelledby={titleId}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <figcaption>
          <h3 id={titleId} className="font-semibold">{title}</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {subtitle} · {formatExact(total)} {unit} in total
          </p>
        </figcaption>
        <button
          type="button"
          onClick={() => setShowTable((value) => !value)}
          className="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-lg border border-border px-2.5 text-xs font-medium hover:bg-muted"
          aria-pressed={showTable}
        >
          {showTable ? <BarChart3 className="h-3.5 w-3.5" aria-hidden="true" /> : <Table2 className="h-3.5 w-3.5" aria-hidden="true" />}
          {showTable ? 'Chart' : 'Table'}
        </button>
      </div>

      {showTable ? (
        <div className="max-h-72 overflow-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground">
                <th className="py-1.5 font-medium">Day (UTC)</th>
                <th className="py-1.5 text-right font-medium capitalize">{unit}</th>
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {days.map((day, index) => (
                <tr key={day} className="border-t border-border">
                  <td className="py-1.5">{dayLabel(day, 'long')}</td>
                  <td className="py-1.5 text-right">{formatExact(values[index])}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="flex gap-2">
          <div className="relative w-8 shrink-0 text-right text-[11px] tabular-nums text-muted-foreground" style={{ height: PLOT_HEIGHT }} aria-hidden="true">
            {ticks.map((tick) => (
              <span key={tick} className="absolute right-0 -translate-y-1/2" style={{ top: PLOT_HEIGHT - (tick / top) * PLOT_HEIGHT }}>
                {formatExact(tick)}
              </span>
            ))}
          </div>

          <div className="min-w-0 flex-1">
            <div className="relative" style={{ height: PLOT_HEIGHT }}>
              {ticks.map((tick) => (
                <div
                  key={tick}
                  className={`${styles.gridline} pointer-events-none absolute inset-x-0`}
                  style={{ top: PLOT_HEIGHT - (tick / top) * PLOT_HEIGHT }}
                  aria-hidden="true"
                />
              ))}

              <ol className="absolute inset-0 flex items-stretch" aria-label={`${title}, ${days.length} days`}>
                {days.map((day, index) => {
                  const value = values[index];
                  const height = top > 0 ? Math.max(value > 0 ? 2 : 0, (value / top) * PLOT_HEIGHT) : 0;
                  const isActive = active === index;
                  return (
                    <li key={day} className="relative flex flex-1 justify-center">
                      <button
                        type="button"
                        className={`${styles.slot} ${isActive ? styles.slotActive : ''} relative flex h-full w-full items-end justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-ring`}
                        onPointerEnter={() => setActive(index)}
                        onPointerLeave={() => setActive((current) => (current === index ? null : current))}
                        onFocus={() => setActive(index)}
                        onBlur={() => setActive((current) => (current === index ? null : current))}
                        aria-label={`${dayLabel(day, 'long')}: ${formatExact(value)} ${unit}`}
                      >
                        <span className={`${styles.bar} block w-[62%] max-w-[24px]`} style={{ height }} />
                        {labelled.has(index) && !isActive && value > 0 && (
                          <span
                            className="pointer-events-none absolute left-1/2 -translate-x-1/2 text-[11px] font-semibold tabular-nums text-foreground"
                            style={{ bottom: height + 4 }}
                            aria-hidden="true"
                          >
                            {formatExact(value)}
                          </span>
                        )}
                      </button>

                      {isActive && (
                        <div
                          role="tooltip"
                          className={`pointer-events-none absolute z-10 whitespace-nowrap rounded-lg border border-border bg-card px-2.5 py-1.5 text-left shadow-lg ${
                            index > days.length / 2 ? 'right-1/2' : 'left-1/2'
                          }`}
                          style={{ bottom: Math.min(PLOT_HEIGHT - 8, height + 10) }}
                        >
                          <p className="text-sm font-semibold tabular-nums text-foreground">{formatExact(value)} {unit}</p>
                          <p className="text-[11px] text-muted-foreground">{dayLabel(day, 'long')}</p>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ol>
            </div>

            <div className="mt-2 flex text-[11px] text-muted-foreground" aria-hidden="true">
              {days.map((day, index) => (
                <span key={day} className="flex-1 text-center">
                  {index === 0 || index === lastIndex || index === Math.floor(lastIndex / 2) ? dayLabel(day, 'short') : ''}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </figure>
  );
}
