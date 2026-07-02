import { NextRequest, NextResponse } from 'next/server';
import { toggleTemplateStar, hasUserStarredTemplate } from '@/lib/firebase/templates';
import { forbiddenResponse, unauthorizedResponse, verifyAuth } from '@/lib/firebase/verifyAuth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ id: string }>;
}

function rejectMismatchedUserId(clientUserId: unknown, uid: string) {
  if (clientUserId && typeof clientUserId === 'string' && clientUserId !== uid) {
    return forbiddenResponse('Authenticated user does not match requested user ID');
  }

  return null;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const authUser = await verifyAuth(request);
    if (!authUser) {
      return unauthorizedResponse();
    }

    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const mismatch = rejectMismatchedUserId(searchParams.get('userId'), authUser.uid);
    if (mismatch) return mismatch;

    const starred = await hasUserStarredTemplate(id, authUser.uid);

    return NextResponse.json({
      success: true,
      starred,
    });
  } catch (error) {
    console.error('[Star API] Error checking star status:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to check star status' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const authUser = await verifyAuth(request);
    if (!authUser) {
      return unauthorizedResponse();
    }

    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const mismatch = rejectMismatchedUserId(body.userId, authUser.uid);
    if (mismatch) return mismatch;

    const result = await toggleTemplateStar(id, authUser.uid);

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error('[Star API] Error toggling star:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to toggle star' },
      { status: 500 }
    );
  }
}
