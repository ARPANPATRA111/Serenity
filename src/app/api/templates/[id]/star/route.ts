import { NextRequest, NextResponse } from 'next/server';
import { toggleTemplateStar, hasUserStarredTemplate } from '@/lib/firebase/templates';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'userId is required' },
        { status: 400 }
      );
    }

    const starred = await hasUserStarredTemplate(id, userId);

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
    const { id } = await params;
    const body = await request.json();
    const { userId } = body;

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'userId is required' },
        { status: 400 }
      );
    }

    console.log('[Star API] Toggling star:', { templateId: id, userId });

    const result = await toggleTemplateStar(id, userId);

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
