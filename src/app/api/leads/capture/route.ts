import { NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';
import type { LeadCaptureEvent } from '@/types/fabric.d';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, email, feature, metadata } = body;

    if (!feature) {
      return NextResponse.json(
        { success: false, error: 'Feature is required' },
        { status: 400 }
      );
    }

    const db = getAdminFirestore();

    const leadEvent: LeadCaptureEvent = {
      userId: userId || 'anonymous',
      email: email || '',
      feature,
      timestamp: Date.now(),
      metadata,
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
