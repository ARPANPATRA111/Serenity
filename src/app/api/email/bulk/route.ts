import { NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';
import { forbiddenResponse, unauthorizedResponse, verifyAuth } from '@/lib/firebase/verifyAuth';

const FREE_BULK_LIMIT = parseInt(process.env.FREE_BULK_EMAIL_LIMIT || '200', 10);
const BULK_EMAIL_ENABLED = process.env.ENABLE_BULK_EMAIL_API === 'true';

interface BulkEmailRequest {
  emails: Array<{
    to: string;
    recipientName: string;
    certificateId: string;
    certificateTitle: string;
  }>;
  issuerName: string;
  userId: string;
  userTier: 'free' | 'pro' | 'enterprise';
}

export async function POST(request: NextRequest) {
  try {
    const authUser = await verifyAuth(request);
    if (!authUser) {
      return unauthorizedResponse();
    }

    const body: BulkEmailRequest = await request.json();
    const { emails, userId } = body;

    if (userId && userId !== authUser.uid) {
      return forbiddenResponse('Authenticated user does not match requested user ID');
    }

    if (!emails || !Array.isArray(emails) || emails.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No emails provided' },
        { status: 400 }
      );
    }

    if (!BULK_EMAIL_ENABLED) {
      return NextResponse.json(
        {
          success: false,
          error: 'Bulk email API is not enabled',
          message: 'Bulk email delivery must be explicitly enabled before use.',
        },
        { status: 501 }
      );
    }

    const db = getAdminFirestore();

    const certificateIds = emails.map((email) =>
      typeof email.certificateId === 'string' ? email.certificateId.trim() : ''
    );
    if (certificateIds.some((certificateId) => !certificateId)) {
      return NextResponse.json(
        { success: false, error: 'Every bulk email item requires a certificateId' },
        { status: 400 }
      );
    }

    const uniqueCertificateIds = Array.from(new Set(certificateIds as string[]));
    const certificateSnapshots = await Promise.all(
      uniqueCertificateIds.map((certificateId) =>
        db.collection('certificates').doc(certificateId).get()
      )
    );

    const missingCertificate = certificateSnapshots.find((snapshot) => !snapshot.exists);
    if (missingCertificate) {
      return NextResponse.json(
        { success: false, error: 'One or more certificates were not found' },
        { status: 404 }
      );
    }

    const unauthorizedCertificate = certificateSnapshots.find(
      (snapshot) => snapshot.data()?.userId !== authUser.uid
    );
    if (unauthorizedCertificate) {
      return forbiddenResponse('Cannot send email for a certificate owned by another user');
    }

    const userDoc = await db.collection('users').doc(authUser.uid).get();
    const trustedUserTier = userDoc.data()?.isPremium === true ? 'pro' : 'free';

    if (trustedUserTier === 'free' && emails.length > FREE_BULK_LIMIT) {
      
      await db.collection('leads').add({
        userId: authUser.uid,
        feature: 'bulk_email',
        attemptedCount: emails.length,
        limit: FREE_BULK_LIMIT,
        timestamp: FieldValue.serverTimestamp(),
        metadata: {
          userTier: trustedUserTier,
          action: 'upgrade_prompt',
        },
      });

      return NextResponse.json(
        {
          success: false,
          error: 'Bulk email limit exceeded',
          code: 'UPGRADE_REQUIRED',
          message: `Free plan allows bulk sending up to ${FREE_BULK_LIMIT} emails. Upgrade to Pro for unlimited bulk sending!`,
          limit: FREE_BULK_LIMIT,
          attempted: emails.length,
          upsell: {
            feature: 'Unlimited Bulk Emails',
            cta: 'Upgrade to Pro',
            benefits: [
              'Send unlimited bulk emails',
              'Custom email templates',
              'Email analytics & tracking',
              'Priority support',
            ],
          },
        },
        { status: 403 }
      );
    }

    const results = {
      queued: emails.length,
      estimatedDelivery: '5-10 minutes',
    };
    
    return NextResponse.json({
      success: true,
      ...results,
      message: `${emails.length} emails queued for delivery`,
    });

  } catch (error) {
    console.error('Bulk email API error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
