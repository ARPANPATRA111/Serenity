import { NextRequest, NextResponse } from 'next/server';
import { createLogger, getErrorDetails } from '@/lib/logger';
import { requireConsoleSession, type ConsoleIdentity } from './session';
import { ReadBudgetExceededError, ReadMeter, assertWithinBudget, recordUsage, type UsageSnapshot } from './usage';

const logger = createLogger('ConsoleAPI');

const NO_STORE_HEADERS = {
  'Cache-Control': 'no-store, max-age=0',
  'X-Robots-Tag': 'noindex, nofollow',
};

export class ConsoleInputError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
    this.name = 'ConsoleInputError';
  }
}

type ConsoleHandler = (context: {
  identity: ConsoleIdentity;
  meter: ReadMeter;
  usage: UsageSnapshot | null;
}) => Promise<Record<string, unknown>>;

/**
 * Wraps a console API handler with session enforcement, read metering, the
 * daily read budget, and uniform non-cacheable responses.
 */
export async function handleConsoleRequest(
  request: NextRequest,
  handler: ConsoleHandler,
  options: { enforceBudget?: boolean } = {},
): Promise<NextResponse> {
  const identity = await requireConsoleSession(request);
  if (identity instanceof NextResponse) return identity;

  const meter = new ReadMeter();
  try {
    const usage = options.enforceBudget === false
      ? null
      : await assertWithinBudget(meter, request.nextUrl.searchParams.get('force') === '1');
    const payload = await handler({ identity, meter, usage });
    return NextResponse.json(
      {
        ...payload,
        usage: usage ? { ...usage, reads: usage.reads + meter.reads, thisRequest: meter.reads } : null,
      },
      { headers: NO_STORE_HEADERS },
    );
  } catch (error) {
    if (error instanceof ReadBudgetExceededError) {
      return NextResponse.json(
        {
          error: 'Today\'s console read budget is used up. Retry with force=1 only if the data is needed now.',
          code: 'READ_BUDGET_EXCEEDED',
          usage: error.usage,
        },
        { status: 429, headers: NO_STORE_HEADERS },
      );
    }
    if (error instanceof ConsoleInputError) {
      // A code distinguishes "record missing" from the bare 404 that means
      // the console session is gone.
      return NextResponse.json(
        { error: error.message, code: error.status === 404 ? 'MISSING' : 'INVALID_INPUT' },
        { status: error.status, headers: NO_STORE_HEADERS },
      );
    }
    logger.error('Console request failed', { path: request.nextUrl.pathname, error: getErrorDetails(error) });
    const code = (error as { code?: unknown })?.code;
    const quota = code === 8 || /RESOURCE_EXHAUSTED|quota/i.test(String((error as Error)?.message || ''));
    return NextResponse.json(
      {
        error: quota
          ? 'Firestore reported that the daily quota is exhausted. The console will work again when the quota resets.'
          : 'The console request failed. Check the server logs for details.',
        code: quota ? 'FIRESTORE_QUOTA' : 'CONSOLE_ERROR',
      },
      { status: quota ? 503 : 500, headers: NO_STORE_HEADERS },
    );
  } finally {
    await recordUsage(meter);
  }
}
