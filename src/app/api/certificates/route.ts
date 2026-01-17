import { NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase/admin';

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
    const userId = request.headers.get('x-user-id');
    
    if (!userId) {
      return NextResponse.json({ success: true, certificates: [] });
    }

    const now = Date.now();
    const cached = certificatesCache.get(userId);
    if (cached && (now - cached.timestamp) < CACHE_TTL) {
      return NextResponse.json({ success: true, certificates: cached.certificates });
    }

    let db;
    try {
      db = getAdminFirestore();
    } catch (e) {
      console.warn('Firebase Admin Init Failed:', e);
      return NextResponse.json({ success: true, certificates: [], warning: 'Service unavailable' });
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
          try {
            snapshot = await certificatesRef
              .where('userId', '==', userId)
              .limit(100)
              .get();
          } catch {
            return NextResponse.json({ success: true, certificates: [], error: 'Database unavailable' });
          }
        } else {
          console.warn('[Certificates API] Database query failed');
          return NextResponse.json({ success: true, certificates: [], error: 'Database unavailable' });
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
      };
    });

    certificatesCache.set(userId, { certificates, timestamp: now });
    cleanCache();

    return NextResponse.json({ success: true, certificates });
  } catch (error) {
    console.error('[API/certificates] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch certificates' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { certificates } = body;

    if (!certificates || !Array.isArray(certificates)) {
      return NextResponse.json(
        { success: false, error: 'Certificates array is required' },
        { status: 400 }
      );
    }

    const db = getAdminFirestore();
    const results: string[] = [];
    const errors: { id: string; error: string }[] = [];

    const batch = db.batch();
    const timestamp = new Date().toISOString();
    
    for (const cert of certificates) {
      const certRef = db.collection('certificates').doc(cert.id);
      batch.set(certRef, {
        ...cert,
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

    const userId = certificates[0]?.userId;
    if (userId) {
      certificatesCache.delete(userId);
    }

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
