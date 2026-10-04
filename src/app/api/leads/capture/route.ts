import { NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';
import type { LeadCaptureEvent } from '@/types/fabric.d';
import { verifyAuth } from '@/lib/firebase/verifyAuth';
import { clientFromHeaders } from '@/lib/verification/service';

const ALLOWED_FEATURES = new Set<LeadCaptureEvent['feature']>([
  'bulk_email',
  'bulk_download',
  'custom_branding',
  'api_access',
  'pro_pricing',
]);
const MAX_METADATA_BYTES = 2_000;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// This endpoint is public and every accepted request costs Firestore writes,
// so each client is limited to a handful of submissions per window.
const SUBMISSION_WINDOW_MS = 10 * 60_000;
const SUBMISSIONS_PER_WINDOW = 5;
const submissionsByClient = new Map<string, { count: number; windowStart: number }>();

function allowSubmission(client: string): boolean {
  const now = Date.now();
  const entry = submissionsByClient.get(client);
  if (!entry || now - entry.windowStart > SUBMISSION_WINDOW_MS) {
    submissionsByClient.set(client, { count: 1, windowStart: now });
    if (submissionsByClient.size > 10_000) {
      const oldest = submissionsByClient.keys().next().value;
      if (oldest !== undefined) submissionsByClient.delete(oldest);
    }
    return true;
  }
  entry.count += 1;
  return entry.count <= SUBMISSIONS_PER_WINDOW;
}

export async function POST(request: NextRequest) {
  try {
    const client = clientFromHeaders(request.headers) || 'unknown';
    if (!allowSubmission(client)) {
      return NextResponse.json(
        { success: false, error: 'Too many requests. Please try again later.' },
        { status: 429, headers: { 'Retry-After': '600' } }
      );
    }

    const body = await request.json();
    const { email, feature, metadata } = body;
    // A client-supplied userId is never trusted: the operator console links
    // requests to accounts, so an unverified ID could point a plan grant at
    // the wrong person. Only a verified sign-in attaches an account.
    const authUser = await verifyAuth(request);

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

    const db = getAdminFirestore();

    const leadEvent: LeadCaptureEvent = {
      userId: authUser?.uid || 'anonymous',
      email: email || '',
      feature: feature as LeadCaptureEvent['feature'],
      timestamp: Date.now(),
      metadata: metadata || {},
    };

    await db.collection('leads').add({
      ...leadEvent,
      userIdVerified: Boolean(authUser),
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
