/**
 * Certificates API Route
 * 
 * GET /api/certificates - List all certificates for the current user
 * POST /api/certificates - Create new certificate(s) in Firebase
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id');
    
    // If no user ID, return empty array (certificates require authentication)
    if (!userId) {
      return NextResponse.json({ success: true, certificates: [] });
    }

    let db;
    try {
      db = getAdminFirestore();
    } catch (e) {
      console.warn('Firebase Admin Init Failed:', e);
      return NextResponse.json({ success: true, certificates: [], warning: 'Service unavailable' });
    }
    
    // Query certificates - we need to get certificates created by this user
    // Since we store templateId, we can filter by templates owned by this user
    // OR we can add a userId field to certificates during generation
    
    // For now, get all certificates and filter by metadata or templateId
    // In production, you'd add proper indexes and user ownership tracking
    const certificatesRef = db.collection('certificates');
    
    // Filter by user ID if provided
    let query: FirebaseFirestore.Query = certificatesRef;
    if (userId) {
      query = query.where('userId', '==', userId);
    }
    
    // Safely attempt to fetch certificates
    let snapshot;
    try {
        snapshot = await query
        .orderBy('issuedAt', 'desc')
        .limit(500)
        .get();
    } catch (e: any) {
        // If it's a credentials error, return empty in dev
        console.error('Firestore Error:', e);
        return NextResponse.json({ success: true, certificates: [], error: 'Database unavailable' });
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

    return NextResponse.json({ success: true, certificates });
  } catch (error) {
    console.error('[API/certificates] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch certificates' },
      { status: 500 }
    );
  }
}

// POST - Create new certificate(s)
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

    // Process certificates in batches
    for (const cert of certificates) {
      try {
        const certRef = db.collection('certificates').doc(cert.id);
        await certRef.set({
          ...cert,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
        results.push(cert.id);
      } catch (error) {
        console.error(`[API/certificates] Error saving certificate ${cert.id}:`, error);
        errors.push({ 
          id: cert.id, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        });
      }
    }

    return NextResponse.json({
      success: errors.length === 0,
      created: results.length,
      failed: errors.length,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error('[API/certificates] POST Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create certificates' },
      { status: 500 }
    );
  }
}
