import { NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id');
    
    if (!userId) {
      return NextResponse.json({ success: false, error: 'User ID required' }, { status: 401 });
    }

    const db = getAdminFirestore();
    const autosaveRef = db.collection('autosave').doc(userId);
    const doc = await autosaveRef.get();

    if (!doc.exists) {
      return NextResponse.json({ success: true, autosave: null });
    }

    return NextResponse.json({ 
      success: true, 
      autosave: doc.data() 
    });
  } catch (error) {
    console.error('[API/autosave] GET error:', error);
    return NextResponse.json({ success: false, error: 'Failed to get autosave' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id');
    
    if (!userId) {
      return NextResponse.json({ success: false, error: 'User ID required' }, { status: 401 });
    }

    const body = await request.json();
    const { canvasJSON, templateId, templateName } = body;

    if (!canvasJSON) {
      return NextResponse.json({ success: false, error: 'Canvas JSON required' }, { status: 400 });
    }

    const db = getAdminFirestore();
    const autosaveRef = db.collection('autosave').doc(userId);
    
    await autosaveRef.set({
      canvasJSON,
      templateId: templateId || null,
      templateName: templateName || 'Untitled',
      savedAt: new Date().toISOString(),
      userId,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[API/autosave] POST error:', error);
    return NextResponse.json({ success: false, error: 'Failed to save' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id');
    
    if (!userId) {
      return NextResponse.json({ success: false, error: 'User ID required' }, { status: 401 });
    }

    const db = getAdminFirestore();
    const autosaveRef = db.collection('autosave').doc(userId);
    await autosaveRef.delete();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[API/autosave] DELETE error:', error);
    return NextResponse.json({ success: false, error: 'Failed to clear autosave' }, { status: 500 });
  }
}
