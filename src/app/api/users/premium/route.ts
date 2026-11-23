import { NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase/admin';
import { forbiddenResponse, unauthorizedResponse, verifyAuth } from '@/lib/firebase/verifyAuth';
import { FREE_CERTIFICATE_LIMIT, getCertificateAllowance } from '@/lib/plans/certificateLimits';
import { summarizePremium } from '@/lib/plans/premium';

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

    const premium = summarizePremium(userData);
    const isPremium = premium.active;
    let actualCertCount = typeof userData?.certificatesGenerated === 'number'
      ? userData.certificatesGenerated
      : 0;

    // A legacy numeric counter may also undercount. Match the save transaction
    // whenever that discrepancy could let a free user start an unusable batch.
    if (typeof userData?.certificatesGenerated !== 'number' || (!isPremium && actualCertCount < FREE_CERTIFICATE_LIMIT)) {
      const owned = await db.collection('certificates').where('userId', '==', userId).count().get();
      actualCertCount = Math.max(actualCertCount, owned.data().count);
    }

    const allowance = getCertificateAllowance(isPremium, actualCertCount);
    return NextResponse.json({
      success: true,
      isPremium,
      premiumUntil: premium.until,
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
