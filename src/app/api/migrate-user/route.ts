/**
 * User Migration API Route
 * 
 * POST /api/migrate-user - Migrate templates and certificates from old user ID to new user ID
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { oldUserId, newUserId } = body;

    if (!oldUserId || !newUserId) {
      return NextResponse.json(
        { success: false, error: 'Both oldUserId and newUserId are required' },
        { status: 400 }
      );
    }

    if (oldUserId === newUserId) {
      return NextResponse.json({ success: true, migrated: 0, message: 'User IDs are the same' });
    }

    console.log(`[Migrate] Migrating user data from ${oldUserId} to ${newUserId}`);

    const db = getAdminFirestore();
    let migratedTemplates = 0;
    let migratedCertificates = 0;

    // Migrate templates
    const templatesSnapshot = await db
      .collection('templates')
      .where('userId', '==', oldUserId)
      .get();

    for (const doc of templatesSnapshot.docs) {
      await doc.ref.update({ userId: newUserId });
      migratedTemplates++;
    }

    // Migrate certificates (if they have userId field)
    const certificatesSnapshot = await db
      .collection('certificates')
      .where('userId', '==', oldUserId)
      .get();

    for (const doc of certificatesSnapshot.docs) {
      await doc.ref.update({ userId: newUserId });
      migratedCertificates++;
    }

    console.log(`[Migrate] Migrated ${migratedTemplates} templates, ${migratedCertificates} certificates`);

    return NextResponse.json({
      success: true,
      migratedTemplates,
      migratedCertificates,
      message: `Successfully migrated ${migratedTemplates} templates and ${migratedCertificates} certificates`,
    });
  } catch (error) {
    console.error('[Migrate] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to migrate user data' },
      { status: 500 }
    );
  }
}
