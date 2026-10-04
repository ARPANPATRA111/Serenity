import { NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase/admin';

export const dynamic = 'force-dynamic';

let cachedStats: { users: number; certificates: number; timestamp: number } | null = null;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

async function getActualCounts(db: FirebaseFirestore.Firestore) {
  if (cachedStats && Date.now() - cachedStats.timestamp < CACHE_DURATION) {
    return cachedStats;
  }

  const [usersSnapshot, certificatesSnapshot] = await Promise.all([
    db.collection('users').count().get(),
    db.collection('certificates').count().get(),
  ]);
  const usersCount = usersSnapshot.data().count;
  const certificatesCount = certificatesSnapshot.data().count;

  cachedStats = {
    users: usersCount,
    certificates: certificatesCount,
    timestamp: Date.now(),
  };

  return cachedStats;
}

export async function GET() {
  try {
    const db = getAdminFirestore();
    
    const actualCounts = await getActualCounts(db);
    
    return NextResponse.json({
      success: true,
      stats: {
        certificatesGenerated: actualCounts.certificates,
        usersRegistered: actualCounts.users,
      },
    }, { headers: { 'Cache-Control': 'public, max-age=60, stale-while-revalidate=300' } });
  } catch (error) {
    console.error('[Stats API] Error fetching stats:', error);
    return NextResponse.json({
      success: false,
      error: 'Usage statistics are temporarily unavailable',
      code: 'STATS_UNAVAILABLE',
    }, { status: 503 });
  }
}
