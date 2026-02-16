import { NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase/admin';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ success: false, error: 'Missing userId' }, { status: 400 });
    }

    const db = getAdminFirestore();
    
    // Get user document
    const userDoc = await db.collection('users').doc(userId).get();
    const userData = userDoc.exists ? userDoc.data() : null;
    
    const isPremium = userData?.isPremium === true;
    const certificatesGenerated = userData?.certificatesGenerated || 0;

    // Also count from certificates collection for accuracy
    let actualCertCount = certificatesGenerated;
    try {
      const certsSnapshot = await db.collection('certificates')
        .where('userId', '==', userId)
        .count()
        .get();
      actualCertCount = certsSnapshot.data().count;
    } catch {
      // Fallback to stored count if count query fails
    }

    return NextResponse.json({
      success: true,
      isPremium,
      certificatesGenerated: actualCertCount,
      freeLimit: 5,
      canGenerate: isPremium || actualCertCount < 5,
      remainingFree: isPremium ? Infinity : Math.max(0, 5 - actualCertCount),
    });
  } catch (error) {
    console.error('[Premium API] Error:', error);
    return NextResponse.json({ success: false, error: 'Failed to check premium status' }, { status: 500 });
  }
}

// POST - Upgrade to premium or increment generation count
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, isPremium, action, count } = body;

    if (!userId) {
      return NextResponse.json({ success: false, error: 'Missing userId' }, { status: 400 });
    }

    const db = getAdminFirestore();
    const userRef = db.collection('users').doc(userId);

    // Handle incrementCount action
    if (action === 'incrementCount') {
      const increment = typeof count === 'number' && count > 0 ? count : 1;
      const userDoc = await userRef.get();
      const currentCount = userDoc.exists ? (userDoc.data()?.certificatesGenerated || 0) : 0;
      
      await userRef.update({
        certificatesGenerated: currentCount + increment,
        lastGeneratedAt: new Date(),
      });

      return NextResponse.json({ 
        success: true, 
        certificatesGenerated: currentCount + increment,
      });
    }
    
    // Handle premium upgrade
    await userRef.update({
      isPremium: isPremium !== false,
      premiumUpdatedAt: new Date(),
    });

    return NextResponse.json({ success: true, isPremium: isPremium !== false });
  } catch (error) {
    console.error('[Premium API] Error:', error);
    return NextResponse.json({ success: false, error: 'Failed to update premium status' }, { status: 500 });
  }
}
