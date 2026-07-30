import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { getAdminFirestore } from '@/lib/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';
import { isSafeCertificateMediaUrl } from '@/lib/security/mediaUrl';
import { getEvent, toPublicEventContext } from '@/lib/firebase/events';

function getDailySalt(): string {
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  const baseSalt = process.env.DAILY_IP_SALT;
  const localMode = process.env.NODE_ENV !== 'production' || process.env.USE_FIREBASE_EMULATORS === 'true';
  if (!baseSalt && !localMode) {
    throw new Error('DAILY_IP_SALT is required outside local or emulator mode');
  }
  return `${baseSalt || 'local-emulator-only'}-${today}`;
}

function hashIP(ip: string): string {
  const salt = getDailySalt();
  return createHash('sha256')
    .update(`${ip}-${salt}`)
    .digest('hex')
    .substring(0, 32); // Truncate for storage efficiency
}

function getClientIP(request: NextRequest): string {
  // Check various headers for IP (supports proxies/load balancers)
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  
  const realIP = request.headers.get('x-real-ip');
  if (realIP) {
    return realIP;
  }
  
  // Fallback
  return '127.0.0.1';
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id: certificateId } = await params;
    console.log('[API/verify] Verifying certificate:', certificateId);
    
    if (!certificateId || certificateId.length < 8) {
      return NextResponse.json(
        { success: false, error: 'Invalid certificate ID' },
        { status: 400 }
      );
    }

    let db;
    try {
      db = getAdminFirestore();
    } catch (firebaseError) {
      console.error('[API/verify] Firebase initialization error:', firebaseError);
      return NextResponse.json(
        { 
          success: false, 
          isValid: false,
          error: 'Database not configured' 
        },
        { status: 500 }
      );
    }
    
    const certificateRef = db.collection('certificates').doc(certificateId);
    
    // Get certificate data
    const certificateDoc = await certificateRef.get();
    
    if (!certificateDoc.exists) {
      return NextResponse.json(
        { 
          success: false, 
          isValid: false,
          error: 'Certificate not found' 
        },
        { status: 404 }
      );
    }

    const certificateData = certificateDoc.data();
    
    // Check if certificate is active
    if (!certificateData?.isActive) {
      return NextResponse.json(
        { 
          success: false,
          isValid: false,
          error: 'Certificate has been revoked' 
        },
        { status: 410 }
      );
    }

    // Handle view counting with IP hashing
    const clientIP = getClientIP(request);
    const ipHash = hashIP(clientIP);
    
    // Count a unique daily viewer transactionally. Event context is fetched in
    // parallel so an optional event link does not add a serial round trip.
    const visitorRef = certificateRef.collection('visitors').doc(ipHash);
    const eventPromise = typeof certificateData.eventId === 'string'
      ? getEvent(certificateData.eventId).then((event) => {
          if (!event || event.userId !== certificateData.userId) return null;
          return toPublicEventContext(event);
        })
      : Promise.resolve(null);

    const viewPromise = db.runTransaction(async (transaction) => {
      const visitorDoc = await transaction.get(visitorRef);
      if (!visitorDoc.exists) {
        transaction.set(visitorRef, {
          firstViewAt: FieldValue.serverTimestamp(),
          lastViewAt: FieldValue.serverTimestamp(),
          viewCount: 1,
        });
        transaction.update(certificateRef, {
          viewCount: FieldValue.increment(1),
        });
        return true;
      }

      transaction.update(visitorRef, {
        lastViewAt: FieldValue.serverTimestamp(),
        viewCount: FieldValue.increment(1),
      });
      return false;
    });

    const [event, isNewView] = await Promise.all([eventPromise, viewPromise]);
    const viewCount = (certificateData.viewCount || 0) + (isNewView ? 1 : 0);
    const certificateImage =
      isSafeCertificateMediaUrl(certificateData.certificateImage)
        ? certificateData.certificateImage
        : null;

    // Return certificate verification data (privacy-preserving)
    return NextResponse.json({
      success: true,
      isValid: true,
      isNewView,
      certificate: {
        id: certificateId,
        certificateId,
        recipientName: certificateData.recipientName,
        title: certificateData.title,
        issuedAt: certificateData.issuedAt,
        issuerName: certificateData.issuerName,
        status: certificateData.isActive === false ? 'revoked' : 'active',
        viewCount,
        certificateImage,
        event,
      },
    }, { headers: { 'Cache-Control': 'private, no-store' } });

  } catch (error) {
    console.error('Verification error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Internal server error' 
      },
      { status: 500 }
    );
  }
}
