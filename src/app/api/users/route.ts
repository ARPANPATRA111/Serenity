import { NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase/admin';
import { forbiddenResponse, unauthorizedResponse, verifyAuth } from '@/lib/firebase/verifyAuth';

function rejectMismatchedUserId(clientUserId: unknown, uid: string) {
  if (clientUserId && typeof clientUserId === 'string' && clientUserId !== uid) {
    return forbiddenResponse('Authenticated user does not match requested user ID');
  }

  return null;
}

// GET - Fetch the authenticated user's own profile
export async function GET(request: NextRequest) {
  try {
    const authUser = await verifyAuth(request);
    if (!authUser) {
      return unauthorizedResponse();
    }

    const { searchParams } = new URL(request.url);
    const mismatch = rejectMismatchedUserId(searchParams.get('id'), authUser.uid);
    if (mismatch) return mismatch;

    const db = getAdminFirestore();
    const userDoc = await db.collection('users').doc(authUser.uid).get();

    if (!userDoc.exists) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    const userData = userDoc.data();

    if (userData?.isDeleted) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      user: {
        id: authUser.uid,
        name: userData?.name,
        email: userData?.email || authUser.email,
        avatar: userData?.avatar,
        isPremium: userData?.isPremium || false,
        certificatesGenerated: userData?.certificatesGenerated || 0,
      },
    });
  } catch (error) {
    console.error('[API Users] Error fetching user:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch user' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const authUser = await verifyAuth(request);
    if (!authUser) {
      return unauthorizedResponse();
    }

    const body = await request.json();
    const { id, email, name, avatar } = body;
    const mismatch = rejectMismatchedUserId(id, authUser.uid);
    if (mismatch) return mismatch;

    const trustedEmail = authUser.email || email;
    if (!trustedEmail) {
      return NextResponse.json({ success: false, error: 'Missing authenticated email' }, { status: 400 });
    }

    const db = getAdminFirestore();
    const userRef = db.collection('users').doc(authUser.uid);
    const userDoc = await userRef.get();

    if (userDoc.exists) {
      const userData = userDoc.data();

      if (userData?.isDeleted) {
        return NextResponse.json({
          success: false,
          error: 'This account has been deleted. Please contact support if you wish to restore it.',
        }, { status: 403 });
      }

      await userRef.update({
        email: trustedEmail,
        emailVerified: authUser.emailVerified,
        lastLoginAt: new Date(),
      });
    } else {
      await userRef.set({
        id: authUser.uid,
        email: trustedEmail,
        name: name || trustedEmail.split('@')[0],
        avatar: avatar || null,
        emailVerified: authUser.emailVerified,
        isPremium: false,
        certificatesGenerated: 0,
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
    const authUser = await verifyAuth(request);
    if (!authUser) {
      return unauthorizedResponse();
    }

    const body = await request.json();
    const mismatch = rejectMismatchedUserId(body.id, authUser.uid);
    if (mismatch) return mismatch;

    const db = getAdminFirestore();
    const userRef = db.collection('users').doc(authUser.uid);

    await userRef.update({
      emailVerified: authUser.emailVerified,
      lastLoginAt: new Date(),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[API Users] Error updating:', error);
    return NextResponse.json({ success: false, error: 'Failed to update user' }, { status: 500 });
  }
}

// PUT - Update the authenticated user's profile
export async function PUT(request: NextRequest) {
  try {
    const authUser = await verifyAuth(request);
    if (!authUser) {
      return unauthorizedResponse();
    }

    const body = await request.json();
    const mismatch = rejectMismatchedUserId(body.id, authUser.uid);
    if (mismatch) return mismatch;

    const db = getAdminFirestore();
    const userRef = db.collection('users').doc(authUser.uid);

    const updateData: Record<string, any> = {
      updatedAt: new Date(),
    };

    if (typeof body.name === 'string') {
      updateData.name = body.name;
    }

    await userRef.update(updateData);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[API Users] Error updating profile:', error);
    return NextResponse.json({ success: false, error: 'Failed to update profile' }, { status: 500 });
  }
}

// DELETE - Soft delete authenticated user account (marks as deleted, does not remove data)
export async function DELETE(request: NextRequest) {
  try {
    const authUser = await verifyAuth(request);
    if (!authUser) {
      return unauthorizedResponse();
    }

    const { searchParams } = new URL(request.url);
    const mismatch = rejectMismatchedUserId(searchParams.get('id'), authUser.uid);
    if (mismatch) return mismatch;

    const db = getAdminFirestore();
    const userRef = db.collection('users').doc(authUser.uid);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    await userRef.update({
      isDeleted: true,
      deletedAt: new Date(),
    });

    return NextResponse.json({
      success: true,
      message: 'Account marked as deleted',
    });
  } catch (error) {
    console.error('[API Users] Error deleting account:', error);
    return NextResponse.json({ success: false, error: 'Failed to delete account' }, { status: 500 });
  }
}
