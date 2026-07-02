import { NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase/admin';
import { createLogger, getErrorDetails } from '@/lib/logger';
import { forbiddenResponse, unauthorizedResponse, verifyAuth } from '@/lib/firebase/verifyAuth';

const logger = createLogger('Certificates.API');

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const certificatesCache = new Map<string, { certificates: any[]; timestamp: number }>();
const CACHE_TTL = 30 * 1000;

function cleanCache() {
  const now = Date.now();
  for (const [key, value] of Array.from(certificatesCache.entries())) {
    if (now - value.timestamp > CACHE_TTL * 2) {
      certificatesCache.delete(key);
    }
  }
}

export async function GET(request: NextRequest) {
  try {
    const authUser = await verifyAuth(request);
    if (!authUser) {
      return unauthorizedResponse();
    }

    const clientUserId = request.headers.get('x-user-id');
    if (clientUserId && clientUserId !== authUser.uid) {
      return forbiddenResponse('Authenticated user does not match requested user ID');
    }

    const userId = authUser.uid;
    const now = Date.now();
    const cached = certificatesCache.get(userId);
    if (cached && (now - cached.timestamp) < CACHE_TTL) {
      logger.debug('Returning cached certificates', { userId, count: cached.certificates.length });
      return NextResponse.json({ success: true, certificates: cached.certificates });
    }

    let db;
    try {
      db = getAdminFirestore();
    } catch (e) {
      logger.warn('Firebase Admin Init Failed', { userId }, e as Error);
      return NextResponse.json({ success: true, certificates: [], warning: 'Service temporarily unavailable' });
    }
    
    const certificatesRef = db.collection('certificates');
    
    let query: FirebaseFirestore.Query = certificatesRef.where('userId', '==', userId);
    
    let snapshot;
    try {
        snapshot = await query
        .orderBy('issuedAt', 'desc')
        .limit(100) 
        .get();
    } catch (e: any) {
        if (e.code === 9) {
          logger.debug('Index not ready, using fallback query', { userId });
          try {
            snapshot = await certificatesRef
              .where('userId', '==', userId)
              .limit(100)
              .get();
          } catch (fallbackError) {
            logger.error('Fallback query failed', { userId }, fallbackError as Error);
            return NextResponse.json({ success: true, certificates: [], error: 'Database temporarily unavailable' });
          }
        } else {
          logger.warn('Database query failed', { userId, errorCode: e.code });
          return NextResponse.json({ success: true, certificates: [], error: 'Database temporarily unavailable' });
        }
    }
    
    const certificates = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        recipientName: data.recipientName || 'Unknown',
        recipientEmail: data.recipientEmail || '',
        title: data.title || 'Certificate',
        issuerName: data.issuerName || 'Serenity',
        issuedAt: data.issuedAt || Date.now(),
        templateId: data.templateId || null,
        templateName: data.templateName || null,
        isActive: data.isActive !== false,
        viewCount: data.viewCount || 0,
        createdAt: data.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
        emailStatus: data.emailStatus || 'not_sent', // 'not_sent' | 'sent' | 'failed'
        emailSentAt: data.emailSentAt?.toDate?.()?.toISOString() || null,
        emailError: data.emailError || null,
        certificateImage: data.certificateImage || null, // URL to certificate image
      };
    });

    certificatesCache.set(userId, { certificates, timestamp: now });
    cleanCache();

    logger.debug('Fetched certificates', { userId, count: certificates.length });
    return NextResponse.json({ success: true, certificates });
  } catch (error) {
    const errorDetails = getErrorDetails(error);
    logger.error('Failed to fetch certificates', { error: errorDetails });
    return NextResponse.json(
      { success: false, error: 'Failed to fetch certificates' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const authUser = await verifyAuth(request);
    if (!authUser) {
      return unauthorizedResponse();
    }

    const body = await request.json();
    const { certificates } = body;

    if (!certificates || !Array.isArray(certificates) || certificates.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Certificates array is required' },
        { status: 400 }
      );
    }

    for (const cert of certificates) {
      if (!cert?.id || typeof cert.id !== 'string') {
        return NextResponse.json(
          { success: false, error: 'Each certificate must include an id' },
          { status: 400 }
        );
      }

      if (cert.userId && cert.userId !== authUser.uid) {
        return forbiddenResponse('Authenticated user does not match certificate user ID');
      }
    }

    const db = getAdminFirestore();
    const userId = authUser.uid;

    const certRefs = certificates.map(cert => db.collection('certificates').doc(cert.id));
    const existingCertDocs = await db.getAll(...certRefs);
    for (const existingDoc of existingCertDocs) {
      if (!existingDoc.exists) continue;

      const existingUserId = existingDoc.data()?.userId;
      if (existingUserId !== userId) {
        return forbiddenResponse('Cannot overwrite a certificate owned by another user');
      }
    }
    
    // Check user's certificate limit
    const userDoc = await db.collection('users').doc(userId).get();
    const userData = userDoc.data();
    const isPremium = userData?.isPremium === true;

    if (!isPremium) {
      // Get current certificate count for this user
      const certificatesGenerated = userData?.certificatesGenerated || 0;
      const newTotal = certificatesGenerated + certificates.length;

      if (newTotal > 5) {
        const remaining = Math.max(0, 5 - certificatesGenerated);
        return NextResponse.json({
          success: false,
          error: `Free tier limit reached. You can only generate ${remaining} more certificate(s). Upgrade to premium for unlimited certificates.`,
          limitReached: true,
          remaining,
        }, { status: 403 });
      }
    }

    const results: string[] = [];

    const batch = db.batch();
    const timestamp = new Date().toISOString();
    
    for (const cert of certificates) {
      const certRef = db.collection('certificates').doc(cert.id);
      batch.set(certRef, {
        ...cert,
        userId,
        createdAt: timestamp,
        updatedAt: timestamp,
      });
      results.push(cert.id);
    }
    
    try {
      await batch.commit();
    } catch (error) {
      console.error('[API/certificates] Batch write failed:', error);
      return NextResponse.json({
        success: false,
        error: 'Failed to save certificates',
      }, { status: 500 });
    }

    certificatesCache.delete(userId);

    return NextResponse.json({
      success: true,
      created: results.length,
      failed: 0,
    });
  } catch (error) {
    console.error('[API/certificates] POST Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create certificates' },
      { status: 500 }
    );
  }
}
