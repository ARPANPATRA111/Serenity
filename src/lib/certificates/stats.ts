import { AggregateField, Timestamp, type Firestore, type Query } from 'firebase-admin/firestore';

/**
 * Account totals computed with Firestore aggregation queries, so they stay
 * exact however many certificates an account has. The dashboard and history
 * previously derived them from the 12 or 50 most recent records and stopped
 * growing past that. An aggregation is billed as one read per 1,000 matching
 * index entries, so the whole set costs about a dozen reads.
 */

export interface CertificateStats {
  totalCertificates: number;
  totalTemplates: number;
  emailsSent: number;
  emailsFailed: number;
  totalViews: number;
  /** Null when the (userId, createdAt) index is not available yet. */
  certificatesLast30Days: number | null;
  certificatesPrevious30Days: number | null;
}

const DAY_MS = 24 * 60 * 60 * 1000;

async function count(query: Query): Promise<number> {
  return (await query.count().get()).data().count;
}

/**
 * Certificates created in [from, to). `createdAt` was stored as an ISO string,
 * a Timestamp or epoch milliseconds by different releases; Firestore orders
 * values by type first, so each representation is counted with its own range.
 */
async function countCreatedBetween(certificates: Query, from: Date, to: Date): Promise<number> {
  const ranges: Array<[unknown, unknown]> = [
    [from.toISOString(), to.toISOString()],
    [Timestamp.fromDate(from), Timestamp.fromDate(to)],
    [from.getTime(), to.getTime()],
  ];
  const counts = await Promise.all(ranges.map(([start, end]) => count(
    certificates.where('createdAt', '>=', start).where('createdAt', '<', end),
  )));
  return counts.reduce((sum, value) => sum + value, 0);
}

export async function getCertificateStats(db: Firestore, userId: string, now = new Date()): Promise<CertificateStats> {
  const certificates = db.collection('certificates').where('userId', '==', userId);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * DAY_MS);
  const sixtyDaysAgo = new Date(now.getTime() - 60 * DAY_MS);
  // Upper bound for "last 30 days" with headroom for clock skew between clients and the server.
  const tomorrow = new Date(now.getTime() + DAY_MS);

  const [
    totalCertificates,
    totalTemplates,
    emailsSent,
    emailsFailed,
    viewsSnapshot,
    certificatesLast30Days,
    certificatesPrevious30Days,
  ] = await Promise.all([
    count(certificates),
    count(db.collection('templates').where('userId', '==', userId)),
    count(certificates.where('emailStatus', '==', 'sent')),
    count(certificates.where('emailStatus', '==', 'failed')),
    certificates.aggregate({ views: AggregateField.sum('viewCount') }).get(),
    // Range counts need the (userId, createdAt) index; without it the
    // dashboard keeps its estimate instead of failing.
    countCreatedBetween(certificates, thirtyDaysAgo, tomorrow).catch(() => null),
    countCreatedBetween(certificates, sixtyDaysAgo, thirtyDaysAgo).catch(() => null),
  ]);

  return {
    totalCertificates,
    totalTemplates,
    emailsSent,
    emailsFailed,
    totalViews: Number(viewsSnapshot.data().views) || 0,
    certificatesLast30Days,
    certificatesPrevious30Days,
  };
}
