/**
 * Collects coarse stage timings for a response's `Server-Timing` header, so
 * browser traces and `curl -i` show where an API request spent its time
 * (auth verification, queries, aggregates) without logging any data.
 */
export interface ServerTimer {
  /** Times a promise under `name` and returns its result. */
  measure<T>(name: string, work: Promise<T> | (() => Promise<T>)): Promise<T>;
  /** Value for the `Server-Timing` header. */
  header(): string;
}

const NAME = /^[a-z][a-z0-9-]{0,31}$/;

export function createServerTimer(): ServerTimer {
  const entries: Array<{ name: string; duration: number }> = [];
  const started = performance.now();

  return {
    async measure(name, work) {
      const start = performance.now();
      try {
        return await (typeof work === 'function' ? work() : work);
      } finally {
        if (NAME.test(name)) entries.push({ name, duration: performance.now() - start });
      }
    },
    header() {
      const total = performance.now() - started;
      return [...entries, { name: 'total', duration: total }]
        .map(({ name, duration }) => `${name};dur=${duration.toFixed(1)}`)
        .join(', ');
    },
  };
}
