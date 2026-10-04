'use client';

/** Fetch helper for console API routes: same-origin, custom header, typed errors. */

export class ConsoleRequestError extends Error {
  constructor(message: string, public status: number, public code?: string, public body?: unknown) {
    super(message);
    this.name = 'ConsoleRequestError';
  }
}

export interface ConsoleUsage {
  day: string;
  reads: number;
  requests: number;
  budget: number;
  thisRequest?: number;
}

export async function consoleFetch<T>(
  path: string,
  init: RequestInit & { idToken?: string } = {},
): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set('x-serenity-console', '1');
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  if (init.idToken) headers.set('Authorization', `Bearer ${init.idToken}`);

  const response = await fetch(path, {
    ...init,
    headers,
    credentials: 'same-origin',
    cache: 'no-store',
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = typeof (body as { error?: unknown }).error === 'string'
      ? (body as { error: string }).error
      : `Request failed (${response.status})`;
    throw new ConsoleRequestError(message, response.status, (body as { code?: string }).code, body);
  }
  return body as T;
}
