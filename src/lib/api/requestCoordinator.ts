type CacheEntry = { expiresAt: number; value: unknown };

const cache = new Map<string, CacheEntry>();
const inFlight = new Map<string, Promise<unknown>>();

export async function coordinatedJson<T>(
  key: string,
  request: () => Promise<Response>,
  ttlMs = 0,
): Promise<T> {
  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.value as T;

  const existing = inFlight.get(key);
  if (existing) return existing as Promise<T>;

  const pending = request().then(async (response) => {
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload.error || `Request failed with status ${response.status}`);
    }
    if (ttlMs > 0) cache.set(key, { expiresAt: Date.now() + ttlMs, value: payload });
    return payload as T;
  }).finally(() => {
    inFlight.delete(key);
  });

  inFlight.set(key, pending);
  return pending;
}

export function invalidateCoordinatedRequests(prefix: string) {
  for (const key of Array.from(cache.keys())) {
    if (key.startsWith(prefix)) cache.delete(key);
  }
}

export function readSessionJson<T>(key: string, maxAgeMs: number): T | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(`serenity-cache:${key}`);
    if (!raw) return null;
    const entry = JSON.parse(raw) as { savedAt: number; value: T };
    if (!entry.savedAt || Date.now() - entry.savedAt > maxAgeMs) {
      window.sessionStorage.removeItem(`serenity-cache:${key}`);
      return null;
    }
    return entry.value;
  } catch {
    return null;
  }
}

export function writeSessionJson<T>(key: string, value: T) {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(`serenity-cache:${key}`, JSON.stringify({
      savedAt: Date.now(),
      value,
    }));
  } catch {
    // Storage can be unavailable in private browsing or when quota is full.
  }
}
