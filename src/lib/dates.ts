export function toIsoDate(value: unknown, fallback = new Date(0).toISOString()): string {
  try {
    if (value && typeof value === 'object' && 'toDate' in value) {
      const toDate = (value as { toDate?: unknown }).toDate;
      if (typeof toDate === 'function') {
        const date = toDate.call(value) as Date;
        if (!Number.isNaN(date.getTime())) return date.toISOString();
      }
    }

    if (typeof value === 'number' || typeof value === 'string') {
      const date = new Date(value);
      if (!Number.isNaN(date.getTime())) return date.toISOString();
    }
  } catch {
    // Return the stable caller-provided fallback below.
  }

  return fallback;
}
