const compact = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 });
const whole = new Intl.NumberFormat('en-US');

/** 1,284 / 12.9K / 4.2M, per the stat-tile contract. */
export function formatCount(value: number): string {
  return Math.abs(value) >= 10_000 ? compact.format(value) : whole.format(value);
}

export function formatExact(value: number): string {
  return whole.format(value);
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export function formatDay(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

export function formatRelative(value: string | null | undefined, now = Date.now()): string {
  if (!value) return 'never';
  const then = Date.parse(value);
  if (Number.isNaN(then)) return 'never';
  const seconds = Math.round((now - then) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  if (days < 60) return `${days} days ago`;
  return formatDay(value);
}

export function providerLabel(provider: string): string {
  switch (provider) {
    case 'password': return 'Email and password';
    case 'google.com': return 'Google';
    case 'github.com': return 'GitHub';
    default: return provider;
  }
}

/** Clean y-axis: 0 / 1 / 2 ... for small counts, 1-2-5 steps otherwise. */
export function niceScale(max: number): { top: number; ticks: number[] } {
  if (max <= 4) {
    const top = Math.max(1, Math.ceil(max));
    return { top, ticks: Array.from({ length: top + 1 }, (_, index) => index) };
  }
  const rough = max / 4;
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const step = [1, 2, 5, 10].map((factor) => factor * magnitude).find((candidate) => candidate >= rough) ?? 10 * magnitude;
  const top = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let value = 0; value <= top; value += step) ticks.push(value);
  return { top, ticks };
}
