/**
 * Bulk Email API Route
 * 
 * POST /api/email/bulk
 * 
 * Handles bulk email sending with freemium upsell logic.
 * Free users are limited to 5 bulk emails - beyond that, capture as lead.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';

const FREE_BULK_LIMIT = parseInt(process.env.FREE_BULK_EMAIL_LIMIT || '5', 10);

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
    const body: BulkEmailRequest = await request.json();
    const { emails, userId, userTier } = body;

    if (!emails || !Array.isArray(emails) || emails.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No emails provided' },
        { status: 400 }
      );
    }

    // Check if free user is trying to send more than the limit
    if (userTier === 'free' && emails.length > FREE_BULK_LIMIT) {
      // Log this as a lead capture opportunity
      const db = getAdminFirestore();
      
      await db.collection('leads').add({
        userId,
        feature: 'bulk_email',
        attemptedCount: emails.length,
        limit: FREE_BULK_LIMIT,
        timestamp: FieldValue.serverTimestamp(),
        metadata: {
          userTier,
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

    // For pro/enterprise users or free users within limit,
    // process emails (in production, this would queue them)
    const results = {
      queued: emails.length,
      estimatedDelivery: '5-10 minutes',
    };

    // In a real implementation, you would queue these emails
    // using a job queue like Bull or similar
    
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
