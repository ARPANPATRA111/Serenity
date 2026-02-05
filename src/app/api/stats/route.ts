import { NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase/admin';

export const dynamic = 'force-dynamic';

const BASE_CERTIFICATES = 10000;
const BASE_USERS = 5000;

let cachedStats: { users: number; certificates: number; timestamp: number } | null = null;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

async function getActualCounts(db: FirebaseFirestore.Firestore) {
  if (cachedStats && Date.now() - cachedStats.timestamp < CACHE_DURATION) {
    return cachedStats;
  }

  const usersSnapshot = await db.collection('users').count().get();
  const usersCount = usersSnapshot.data().count;

  const certificatesSnapshot = await db.collection('certificates').count().get();
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
        certificatesGenerated: BASE_CERTIFICATES + actualCounts.certificates,
        usersRegistered: BASE_USERS + actualCounts.users,
      },
    });
  } catch (error) {
    console.error('[Stats API] Error fetching stats:', error);
    return NextResponse.json({
      success: true,
      stats: {
        certificatesGenerated: BASE_CERTIFICATES,
        usersRegistered: BASE_USERS,
      },
    });
  }
}
