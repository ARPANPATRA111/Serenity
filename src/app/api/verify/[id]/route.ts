import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { getAdminFirestore } from '@/lib/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';

function getDailySalt(): string {
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  const baseSalt = process.env.DAILY_IP_SALT || 'serenity-default-salt';
  return `${baseSalt}-${today}`;
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
    
    // Check if this IP has already viewed today
    const visitorRef = certificateRef.collection('visitors').doc(ipHash);
    const visitorDoc = await visitorRef.get();
    
    let isNewView = false;
    
    if (!visitorDoc.exists) {
      // New visitor - create document and increment view count
      isNewView = true;
      
      // Use transaction to ensure atomicity
      await db.runTransaction(async (transaction) => {
        // Create visitor record
        transaction.set(visitorRef, {
          firstViewAt: FieldValue.serverTimestamp(),
          viewCount: 1,
        });
        
        // Increment certificate view count
        transaction.update(certificateRef, {
          viewCount: FieldValue.increment(1),
        });
      });
    } else {
      // Returning visitor - just update their view count (optional)
      await visitorRef.update({
        lastViewAt: FieldValue.serverTimestamp(),
        viewCount: FieldValue.increment(1),
      });
    }

    // Get updated view count
    const updatedDoc = await certificateRef.get();
    const viewCount = updatedDoc.data()?.viewCount || 0;

    // Return certificate verification data (privacy-preserving)
    return NextResponse.json({
      success: true,
      isValid: true,
      isNewView,
      certificate: {
        id: certificateId,
        recipientName: certificateData.recipientName,
        recipientEmail: certificateData.recipientEmail,
        title: certificateData.title,
        description: certificateData.description || null,
        issuedAt: certificateData.issuedAt,
        issuerName: certificateData.issuerName,
        viewCount,
        certificateImage: certificateData.certificateImage || null,
        templateId: certificateData.templateId || null,
      },
    });

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
