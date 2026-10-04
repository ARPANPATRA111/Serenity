'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { ConsoleRequestError, consoleFetch, type ConsoleUsage } from './api';

interface ConsoleContextValue {
  reportUsage: (usage: ConsoleUsage | null | undefined) => void;
  sessionEnded: () => void;
  openUser: (uid: string) => void;
}

export const ConsoleContext = createContext<ConsoleContextValue | null>(null);

export function useConsole(): ConsoleContextValue {
  const value = useContext(ConsoleContext);
  if (!value) throw new Error('useConsole must be used inside the console shell');
  return value;
}

export interface ResourceState<T> {
  data: T | null;
  error: ConsoleRequestError | null;
  loading: boolean;
  reload: (options?: { force?: boolean; extraQuery?: string }) => Promise<void>;
}

/**
 * Loads a console endpoint, reports its read usage to the shell, and ends the
 * session when the server no longer recognises it.
 */
export function useConsoleResource<T extends { usage?: ConsoleUsage | null }>(path: string | null): ResourceState<T> {
  const { reportUsage, sessionEnded } = useConsole();
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<ConsoleRequestError | null>(null);
  const [loading, setLoading] = useState(false);
  const latest = useRef(0);

  const reload = useCallback(async (options: { force?: boolean; extraQuery?: string } = {}) => {
    if (!path) return;
    const request = ++latest.current;
    setLoading(true);
    setError(null);
    const params = [options.force ? 'force=1' : '', options.extraQuery || ''].filter(Boolean).join('&');
    const url = params ? `${path}${path.includes('?') ? '&' : '?'}${params}` : path;
    try {
      const body = await consoleFetch<T>(url);
      if (request !== latest.current) return;
      setData(body);
      reportUsage(body.usage);
    } catch (caught) {
      if (request !== latest.current) return;
      const failure = caught instanceof ConsoleRequestError ? caught : new ConsoleRequestError('Request failed', 0);
      if (failure.status === 404 && !failure.code) {
        sessionEnded();
        return;
      }
      if (failure.body && typeof failure.body === 'object' && 'usage' in (failure.body as object)) {
        reportUsage((failure.body as { usage?: ConsoleUsage }).usage);
      }
      setError(failure);
    } finally {
      if (request === latest.current) setLoading(false);
    }
  }, [path, reportUsage, sessionEnded]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { data, error, loading, reload };
}
