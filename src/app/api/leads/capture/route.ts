import { NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';
import type { LeadCaptureEvent } from '@/types/fabric.d';

const ALLOWED_FEATURES = new Set<LeadCaptureEvent['feature']>([
  'bulk_email',
  'bulk_download',
  'custom_branding',
  'api_access',
]);
const MAX_METADATA_BYTES = 2_000;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, email, feature, metadata } = body;

    if (typeof feature !== 'string' || !ALLOWED_FEATURES.has(feature as LeadCaptureEvent['feature'])) {
      return NextResponse.json(
        { success: false, error: 'Invalid feature' },
        { status: 400 }
      );
    }

    if (email && (typeof email !== 'string' || !EMAIL_REGEX.test(email))) {
      return NextResponse.json(
        { success: false, error: 'Invalid email address' },
        { status: 400 }
      );
    }

    let metadataSize = 0;
    try {
      metadataSize = Buffer.byteLength(JSON.stringify(metadata || {}), 'utf8');
    } catch {
      return NextResponse.json(
        { success: false, error: 'Invalid metadata' },
        { status: 400 }
      );
    }

    if (metadataSize > MAX_METADATA_BYTES) {
      return NextResponse.json(
        { success: false, error: 'Metadata is too large' },
        { status: 400 }
      );
    }

    // TODO: Add IP/email based rate limiting before enabling wider lead capture.
    const db = getAdminFirestore();

    const leadEvent: LeadCaptureEvent = {
      userId: typeof userId === 'string' && userId.trim() ? userId : 'anonymous',
      email: email || '',
      feature: feature as LeadCaptureEvent['feature'],
      timestamp: Date.now(),
      metadata: metadata || {},
    };

    await db.collection('leads').add({
      ...leadEvent,
      createdAt: FieldValue.serverTimestamp(),
    });

    if (email) {
      const waitlistRef = db.collection('waitlist').doc(email.toLowerCase());
      const existingDoc = await waitlistRef.get();

      if (!existingDoc.exists) {
        await waitlistRef.set({
          email: email.toLowerCase(),
          features: [feature],
          createdAt: FieldValue.serverTimestamp(),
          source: 'feature_gate',
        });
      } else {
        await waitlistRef.update({
          features: FieldValue.arrayUnion(feature),
          lastInteraction: FieldValue.serverTimestamp(),
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Thanks for your interest! We\'ll notify you when this feature launches.',
    });

  } catch (error) {
    console.error('Lead capture error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
