'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ConsoleRequestError, consoleFetch, type ConsoleUsage } from './api';
import { useConsole } from './context';

interface PageBody {
  nextCursor?: string | null;
  usage?: ConsoleUsage | null;
}

/**
 * Cursor pagination for console lists: the first page loads on mount (and
 * whenever `path` changes), later pages append.
 */
export function usePaged<TItem, TBody extends PageBody>(path: string, pick: (body: TBody) => TItem[]) {
  const { reportUsage, sessionEnded } = useConsole();
  const [items, setItems] = useState<TItem[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ConsoleRequestError | null>(null);
  const [lastBody, setLastBody] = useState<TBody | null>(null);
  const pickRef = useRef(pick);
  pickRef.current = pick;
  const generation = useRef(0);

  const load = useCallback(async (next: string | null, options: { force?: boolean } = {}) => {
    const request = ++generation.current;
    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    if (next) params.set('cursor', next);
    if (options.force) params.set('force', '1');
    const query = params.toString();
    const url = query ? `${path}${path.includes('?') ? '&' : '?'}${query}` : path;
    try {
      const body = await consoleFetch<TBody>(url);
      if (request !== generation.current) return;
      const page = pickRef.current(body);
      setItems((current) => (next ? [...current, ...page] : page));
      setCursor(body.nextCursor ?? null);
      setLastBody(body);
      reportUsage(body.usage);
    } catch (caught) {
      if (request !== generation.current) return;
      const failure = caught instanceof ConsoleRequestError ? caught : new ConsoleRequestError('Request failed', 0);
      if (failure.status === 404 && !failure.code) {
        sessionEnded();
        return;
      }
      setError(failure);
    } finally {
      if (request === generation.current) setLoading(false);
    }
  }, [path, reportUsage, sessionEnded]);

  useEffect(() => {
    setItems([]);
    setCursor(null);
    void load(null);
  }, [load]);

  return {
    items,
    setItems,
    loading,
    error,
    lastBody,
    hasMore: cursor !== null,
    loadMore: () => load(cursor),
    reload: (options?: { force?: boolean }) => load(null, options),
  };
}
