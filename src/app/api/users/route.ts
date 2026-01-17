import { NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase/admin';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, email, name, avatar, emailVerified } = body;

    if (!id || !email) {
      return NextResponse.json({ success: false, error: 'Missing required fields (id, email)' }, { status: 400 });
    }

    const db = getAdminFirestore();
    const userRef = db.collection('users').doc(id);
    const userDoc = await userRef.get();

    if (userDoc.exists) {
      const updateData: Record<string, any> = {
        lastLoginAt: new Date(),
      };
      if (emailVerified !== undefined) {
        updateData.emailVerified = emailVerified;
      }
      await userRef.update(updateData);
    } else {
      await userRef.set({
        id,
        email,
        name: name || email.split('@')[0],
        avatar: avatar || null,
        emailVerified: emailVerified || false,
        createdAt: new Date(),
        lastLoginAt: new Date(),
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[API Users] Error:', error);
    return NextResponse.json({ success: false, error: 'Failed to save user' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, emailVerified } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: 'Missing user ID' }, { status: 400 });
    }

    const db = getAdminFirestore();
    const userRef = db.collection('users').doc(id);
    
    await userRef.update({
      emailVerified: emailVerified ?? true,
      lastLoginAt: new Date(),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[API Users] Error updating:', error);
    return NextResponse.json({ success: false, error: 'Failed to update user' }, { status: 500 });
  }
}

// PUT - Update user profile (name, etc.)
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, name } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: 'Missing user ID' }, { status: 400 });
    }

    const db = getAdminFirestore();
    const userRef = db.collection('users').doc(id);
    
    const updateData: Record<string, any> = {
      updatedAt: new Date(),
    };
    
    if (name !== undefined) {
      updateData.name = name;
    }

    await userRef.update(updateData);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[API Users] Error updating profile:', error);
    return NextResponse.json({ success: false, error: 'Failed to update profile' }, { status: 500 });
  }
}

// DELETE - Delete user account and all associated data
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('id');

    if (!userId) {
      return NextResponse.json({ success: false, error: 'Missing user ID' }, { status: 400 });
    }

    const db = getAdminFirestore();
    const batch = db.batch();

    // Delete user document
    const userRef = db.collection('users').doc(userId);
    batch.delete(userRef);

    // Delete all user's templates
    const templatesSnapshot = await db.collection('templates').where('userId', '==', userId).get();
    templatesSnapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
    });

    // Delete all user's certificates
    const certificatesSnapshot = await db.collection('certificates').where('userId', '==', userId).get();
    certificatesSnapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
    });

    await batch.commit();

    return NextResponse.json({ 
      success: true, 
      deletedTemplates: templatesSnapshot.size,
      deletedCertificates: certificatesSnapshot.size
    });
  } catch (error) {
    console.error('[API Users] Error deleting account:', error);
    return NextResponse.json({ success: false, error: 'Failed to delete account' }, { status: 500 });
  }
}
