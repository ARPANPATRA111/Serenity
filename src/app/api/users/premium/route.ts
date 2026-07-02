import { NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase/admin';
import { forbiddenResponse, unauthorizedResponse, verifyAuth } from '@/lib/firebase/verifyAuth';

function rejectMismatchedUserId(clientUserId: unknown, uid: string) {
  if (clientUserId && typeof clientUserId === 'string' && clientUserId !== uid) {
    return forbiddenResponse('Authenticated user does not match requested user ID');
  }

  return null;
}

export async function GET(request: NextRequest) {
  try {
    const authUser = await verifyAuth(request);
    if (!authUser) {
      return unauthorizedResponse();
    }

    const { searchParams } = new URL(request.url);
    const mismatch = rejectMismatchedUserId(searchParams.get('userId'), authUser.uid);
    if (mismatch) return mismatch;

    const userId = authUser.uid;
    const db = getAdminFirestore();

    const userDoc = await db.collection('users').doc(userId).get();
    const userData = userDoc.exists ? userDoc.data() : null;

    const isPremium = userData?.isPremium === true;
    const certificatesGenerated = userData?.certificatesGenerated || 0;

    let actualCertCount = certificatesGenerated;
    try {
      const certsSnapshot = await db.collection('certificates')
        .where('userId', '==', userId)
        .count()
        .get();
      actualCertCount = certsSnapshot.data().count;
    } catch {
      // Fallback to stored count if count query fails.
    }

    return NextResponse.json({
      success: true,
      isPremium,
      certificatesGenerated: actualCertCount,
      freeLimit: 5,
      canGenerate: isPremium || actualCertCount < 5,
      remainingFree: isPremium ? Infinity : Math.max(0, 5 - actualCertCount),
    });
  } catch (error) {
    console.error('[Premium API] Error:', error);
    return NextResponse.json({ success: false, error: 'Failed to check premium status' }, { status: 500 });
  }
}

// POST - Admin premium grant or authenticated generation count increment.
export async function POST(request: NextRequest) {
  try {
    const authUser = await verifyAuth(request);
    if (!authUser) {
      return unauthorizedResponse();
    }

    const body = await request.json();
    const { userId, action, count } = body;
    const db = getAdminFirestore();

    if (action === 'incrementCount') {
      const mismatch = rejectMismatchedUserId(userId, authUser.uid);
      if (mismatch) return mismatch;

      const trustedUserId = authUser.uid;
      const userRef = db.collection('users').doc(trustedUserId);
      const increment = typeof count === 'number' && count > 0 ? count : 1;
      const userDoc = await userRef.get();
      const currentCount = userDoc.exists ? (userDoc.data()?.certificatesGenerated || 0) : 0;

      await userRef.update({
        certificatesGenerated: currentCount + increment,
        lastGeneratedAt: new Date(),
      });

      return NextResponse.json({
        success: true,
        certificatesGenerated: currentCount + increment,
      });
    }

    console.warn('[Premium API] Rejected client-facing premium-grant attempt', {
      requester: authUser.uid,
      target: typeof userId === 'string' ? userId : undefined,
    });
    return forbiddenResponse('Premium grants require an admin-controlled workflow');
  } catch (error) {
    console.error('[Premium API] Error:', error);
    return NextResponse.json({ success: false, error: 'Failed to update premium status' }, { status: 500 });
  }
}
