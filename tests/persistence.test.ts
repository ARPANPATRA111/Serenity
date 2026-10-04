import { describe, expect, test, vi } from 'vitest';
import { persistCertificateRecords } from '../src/lib/generator/persistence';

const records = (count: number) => Array.from({ length: count }, (_, index) => ({ id: `cert${String(index).padStart(8, '0')}` }));
const noSleep = async () => undefined;

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

function okFor(init: RequestInit | undefined) {
  const { certificates } = JSON.parse(String(init?.body));
  return jsonResponse(200, { success: true, ids: certificates.map((certificate: { id: string }) => certificate.id) });
}

describe('persistCertificateRecords', () => {
  test('calls the global fetch the way browsers require (no "Illegal invocation")', async () => {
    const original = globalThis.fetch;
    // Browsers throw when fetch is invoked with `this` bound to another object.
    globalThis.fetch = function strictFetch(this: unknown, _input: RequestInfo | URL, init?: RequestInit) {
      if (this !== undefined && this !== globalThis) {
        return Promise.reject(new TypeError("Failed to execute 'fetch' on 'Window': Illegal invocation"));
      }
      return Promise.resolve(okFor(init));
    } as typeof fetch;
    try {
      const outcome = await persistCertificateRecords(records(2), { sleep: noSleep, maxAttempts: 1 });
      expect(outcome.failures).toEqual([]);
      expect(outcome.persistedIds).toHaveLength(2);
    } finally {
      globalThis.fetch = original;
    }
  });

  test('saves in chunks small enough for the hosting body limit', async () => {
    const fetchImpl = vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => okFor(init));
    const outcome = await persistCertificateRecords(records(250), { fetchImpl, sleep: noSleep, authToken: 'token' });

    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect(outcome.persistedIds).toHaveLength(250);
    expect(outcome.failures).toEqual([]);
    const [, init] = fetchImpl.mock.calls[0];
    expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer token');
    expect(JSON.parse(String(init?.body)).certificates).toHaveLength(100);
  });

  test('retries network and server errors, then succeeds', async () => {
    let calls = 0;
    const fetchImpl = vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
      calls += 1;
      if (calls === 1) throw new TypeError('Failed to fetch');
      if (calls === 2) return jsonResponse(500, { success: false, error: 'Failed to save certificates' });
      return okFor(init);
    });
    const outcome = await persistCertificateRecords(records(3), { fetchImpl, sleep: noSleep });
    expect(calls).toBe(3);
    expect(outcome.persistedIds).toHaveLength(3);
  });

  test('reports exactly which records failed after retries are exhausted', async () => {
    const fetchImpl = vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
      const { certificates } = JSON.parse(String(init?.body));
      return certificates[0].id === 'cert00000100'
        ? jsonResponse(503, { success: false, error: 'Service unavailable' })
        : okFor(init);
    });
    const outcome = await persistCertificateRecords(records(150), { fetchImpl, sleep: noSleep, maxAttempts: 2 });
    expect(outcome.persistedIds).toHaveLength(100);
    expect(outcome.failures).toHaveLength(1);
    expect(outcome.failures[0]).toMatchObject({ retryable: true, message: 'Service unavailable' });
    expect(outcome.failures[0].ids).toHaveLength(50);
  });

  test('does not retry client errors, and stops at the plan limit', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(403, { success: false, error: 'Free tier limit reached.', limitReached: true, remaining: 0 }));
    const outcome = await persistCertificateRecords(records(250), { fetchImpl, sleep: noSleep });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(outcome.persistedIds).toEqual([]);
    const failedIds = outcome.failures.flatMap((failure) => failure.ids);
    expect(failedIds).toHaveLength(250);
    expect(outcome.failures.every((failure) => failure.limitReached && !failure.retryable)).toBe(true);
  });
});
