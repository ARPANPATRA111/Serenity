import { NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase/admin';
import { forbiddenResponse, unauthorizedResponse, verifyAuth } from '@/lib/firebase/verifyAuth';
import { FREE_CERTIFICATE_LIMIT, getCertificateAllowance } from '@/lib/plans/certificateLimits';

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
    let actualCertCount = typeof userData?.certificatesGenerated === 'number'
      ? userData.certificatesGenerated
      : 0;

    // Legacy profiles without a counter are reconciled once. Normal modal
    // opens use the server-owned counter; certificate persistence performs the
    // authoritative count reconciliation before every write transaction.
    if (typeof userData?.certificatesGenerated !== 'number') {
      try {
        const certsSnapshot = await db.collection('certificates')
          .where('userId', '==', userId)
          .count()
          .get();
        actualCertCount = certsSnapshot.data().count;
      } catch {
        actualCertCount = 0;
      }
    }

    const allowance = getCertificateAllowance(isPremium, actualCertCount);
    return NextResponse.json({
      success: true,
      isPremium,
      certificatesGenerated: actualCertCount,
      freeLimit: FREE_CERTIFICATE_LIMIT,
      canGenerate: allowance.canGenerate,
      remainingFree: allowance.remaining,
    });
  } catch (error) {
    console.error('[Premium API] Error:', error);
    return NextResponse.json({ success: false, error: 'Failed to check premium status' }, { status: 500 });
  }
}

// Client-facing premium grants and counter mutations are intentionally disabled.
// Certificate creation owns the generation counter transactionally.
export async function POST(request: NextRequest) {
  try {
    const authUser = await verifyAuth(request);
    if (!authUser) {
      return unauthorizedResponse();
    }

    const body = await request.json();
    const { userId, action } = body;

    console.warn('[Premium API] Rejected client-facing premium-grant attempt', {
      requester: authUser.uid,
      target: typeof userId === 'string' ? userId : undefined,
    });
    return forbiddenResponse('Plan and usage mutations require a server-controlled workflow');
  } catch (error) {
    console.error('[Premium API] Error:', error);
    return NextResponse.json({ success: false, error: 'Failed to update premium status' }, { status: 500 });
  }
}
