import { FieldValue } from 'firebase-admin/firestore';
import { getAdminFirestore } from '@/lib/firebase/admin';
import { ADMIN_COLLECTIONS, getDailyReadBudget } from './config';

/**
 * Tracks the Firestore reads the console spends so it can never exhaust the
 * project's daily quota that real users depend on (50,000 reads per day on the
 * Spark plan). Estimates follow Firestore billing: a query costs one read per
 * returned document (minimum one), an aggregation one read per 1,000 index
 * entries it covers (minimum one), and a document lookup one read.
 */
export class ReadMeter {
  reads = 0;

  document(count = 1) {
    this.reads += Math.max(0, count);
  }

  query(returnedDocuments: number) {
    this.reads += Math.max(1, returnedDocuments);
  }

  aggregate(entriesCovered: number) {
    this.reads += Math.max(1, Math.ceil(entriesCovered / 1000));
  }
}

export function usageDay(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

export interface UsageSnapshot {
  day: string;
  reads: number;
  requests: number;
  budget: number;
}

export async function readUsage(meter?: ReadMeter): Promise<UsageSnapshot> {
  const day = usageDay();
  const snapshot = await getAdminFirestore().collection(ADMIN_COLLECTIONS.usage).doc(day).get();
  meter?.document();
  const data = snapshot.data() || {};
  return {
    day,
    reads: typeof data.reads === 'number' ? data.reads : 0,
    requests: typeof data.requests === 'number' ? data.requests : 0,
    budget: getDailyReadBudget(),
  };
}

/** Adds this request's reads to today's total. One write per console request. */
export async function recordUsage(meter: ReadMeter): Promise<void> {
  try {
    await getAdminFirestore().collection(ADMIN_COLLECTIONS.usage).doc(usageDay()).set({
      reads: FieldValue.increment(meter.reads),
      requests: FieldValue.increment(1),
      updatedAt: new Date().toISOString(),
    }, { merge: true });
  } catch {
    // Metering must never break the console.
  }
}

export class ReadBudgetExceededError extends Error {
  constructor(public usage: UsageSnapshot) {
    super('The console read budget for today is used up');
    this.name = 'ReadBudgetExceededError';
  }
}

/** Refuses expensive work once today's budget is spent, unless explicitly forced. */
export async function assertWithinBudget(meter: ReadMeter, force = false): Promise<UsageSnapshot> {
  const usage = await readUsage(meter);
  if (!force && usage.reads >= usage.budget) throw new ReadBudgetExceededError(usage);
  return usage;
}
