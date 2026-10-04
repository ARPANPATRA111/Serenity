/**
 * Saves generated certificate records through the authenticated API.
 *
 * Records are sent in chunks: one request for a whole batch exceeded the
 * 4.5 MB request-body limit of Vercel functions on large spreadsheets, and a
 * rejected request left every certificate in the downloaded ZIP pointing at a
 * verification record that was never saved. Chunks are retried on network and
 * server errors (saving is idempotent per certificate ID), and the result
 * reports exactly which certificates were and were not saved.
 */

export const PERSIST_CHUNK_SIZE = 100;
const DEFAULT_ATTEMPTS = 3;

export interface PersistFailure {
  ids: string[];
  message: string;
  retryable: boolean;
  limitReached?: boolean;
  remaining?: number;
}

export interface PersistOutcome {
  persistedIds: string[];
  failures: PersistFailure[];
}

interface PersistOptions {
  authToken?: string;
  chunkSize?: number;
  maxAttempts?: number;
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  onChunk?: (saved: number, total: number) => void;
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

async function persistChunk(
  records: Array<{ id: string }>,
  options: Required<Pick<PersistOptions, 'maxAttempts' | 'fetchImpl' | 'sleep'>> & { authToken?: string },
): Promise<{ ok: true; ids: string[] } | { ok: false; failure: PersistFailure }> {
  const ids = records.map((record) => record.id);
  let lastMessage = 'Failed to save certificates';

  for (let attempt = 1; attempt <= options.maxAttempts; attempt += 1) {
    try {
      const response = await options.fetchImpl('/api/certificates', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(options.authToken ? { Authorization: `Bearer ${options.authToken}` } : {}),
        },
        body: JSON.stringify({ certificates: records }),
      });
      const data = await response.json().catch(() => ({})) as {
        success?: boolean;
        ids?: unknown;
        error?: string;
        limitReached?: boolean;
        remaining?: number;
      };

      if (response.ok && data.success) {
        const savedIds = Array.isArray(data.ids)
          ? data.ids.filter((id): id is string => typeof id === 'string')
          : ids;
        return { ok: true, ids: savedIds };
      }

      lastMessage = typeof data.error === 'string' ? data.error : `Saving failed with status ${response.status}`;
      // Client errors (plan limit, validation, ownership) will not change on retry.
      if (response.status >= 400 && response.status < 500 && response.status !== 408 && response.status !== 429) {
        return {
          ok: false,
          failure: {
            ids,
            message: lastMessage,
            retryable: false,
            ...(data.limitReached ? { limitReached: true, remaining: data.remaining ?? 0 } : {}),
          },
        };
      }
    } catch (error) {
      lastMessage = error instanceof Error ? error.message : 'Network error while saving certificates';
    }

    if (attempt < options.maxAttempts) await options.sleep(500 * 2 ** (attempt - 1));
  }

  return { ok: false, failure: { ids, message: lastMessage, retryable: true } };
}

export async function persistCertificateRecords(
  records: Array<{ id: string }>,
  options: PersistOptions = {},
): Promise<PersistOutcome> {
  const chunkSize = Math.max(1, options.chunkSize ?? PERSIST_CHUNK_SIZE);
  const settings = {
    authToken: options.authToken,
    maxAttempts: Math.max(1, options.maxAttempts ?? DEFAULT_ATTEMPTS),
    // Browsers reject window.fetch called as a method of another object
    // ("Illegal invocation"), so the global is always called directly.
    fetchImpl: options.fetchImpl ?? ((input: RequestInfo | URL, init?: RequestInit) => fetch(input, init)),
    sleep: options.sleep ?? defaultSleep,
  };

  const outcome: PersistOutcome = { persistedIds: [], failures: [] };
  for (let index = 0; index < records.length; index += chunkSize) {
    const chunk = records.slice(index, index + chunkSize);
    const result = await persistChunk(chunk, settings);
    if (result.ok) {
      outcome.persistedIds.push(...result.ids);
    } else {
      outcome.failures.push(result.failure);
      // Once the plan limit is reached, later chunks would be refused too.
      if (result.failure.limitReached) {
        const remainingIds = records.slice(index + chunkSize).map((record) => record.id);
        if (remainingIds.length > 0) {
          outcome.failures.push({ ids: remainingIds, message: result.failure.message, retryable: false, limitReached: true, remaining: result.failure.remaining });
        }
        break;
      }
    }
    options.onChunk?.(outcome.persistedIds.length, records.length);
  }
  return outcome;
}
