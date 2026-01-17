import { NextRequest, NextResponse } from 'next/server';
import { put, del } from '@vercel/blob';
import { getAdminFirestore } from '@/lib/firebase/admin';
import { nanoid } from 'nanoid';

// Maximum file size: 5MB
const MAX_FILE_SIZE = 5 * 1024 * 1024;

const ALLOWED_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/svg+xml',
  'image/webp',
];

interface MediaAsset {
  id: string;
  userId: string;
  name: string;
  url: string;
  type: string;
  size: number;
  uploadedAt: string;
  blobPath: string;
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const userId = formData.get('userId') as string;

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No file provided' },
        { status: 400 }
      );
    }

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'User ID required' },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { success: false, error: `File exceeds 5MB limit (${(file.size / 1024 / 1024).toFixed(2)}MB)` },
        { status: 400 }
      );
    }

    // Validate file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { success: false, error: `File type "${file.type}" not supported. Use: Images, SVGs, GIFs` },
        { status: 400 }
      );
    }

    // Generate unique ID and path
    const assetId = `asset_${nanoid(10)}`;
    const fileExtension = file.name.split('.').pop() || 'png';
    const blobPath = `media/${userId}/${assetId}.${fileExtension}`;

    // Convert file to buffer
    const buffer = Buffer.from(await file.arrayBuffer());

    // Upload to Vercel Blob
    const blob = await put(blobPath, buffer, {
      contentType: file.type,
      access: 'public',
    });

    // Create asset record
    const asset: MediaAsset = {
      id: assetId,
      userId,
      name: file.name,
      url: blob.url,
      type: file.type,
      size: file.size,
      uploadedAt: new Date().toISOString(),
      blobPath: blob.pathname,
    };

    // Save metadata to Firestore
    const db = getAdminFirestore();
    await db.collection('user-media').doc(assetId).set(asset);

    console.log(`[Media API] Uploaded: ${asset.name} for user ${userId}`);

    return NextResponse.json({ success: true, asset });
  } catch (error) {
    console.error('[Media API] Upload error:', error);
    
    // Check for specific Vercel Blob errors
    const errorMessage = error instanceof Error ? error.message : 'Upload failed';
    
    if (errorMessage.includes('BLOB_STORE')) {
      return NextResponse.json(
        { success: false, error: 'Blob storage not configured. Please add BLOB_READ_WRITE_TOKEN to environment variables.' },
        { status: 500 }
      );
    }
    
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'User ID required' },
        { status: 400 }
      );
    }

    const db = getAdminFirestore();
    const snapshot = await db
      .collection('user-media')
      .where('userId', '==', userId)
      .get();

    const assets = snapshot.docs
      .map((doc) => doc.data() as MediaAsset)
      .sort((a, b) => 
        new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
      );

    return NextResponse.json({ success: true, assets });
  } catch (error) {
    console.error('[Media API] Get error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to get media' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const assetId = searchParams.get('assetId');
    const userId = searchParams.get('userId');

    if (!assetId || !userId) {
      return NextResponse.json(
        { success: false, error: 'Asset ID and User ID required' },
        { status: 400 }
      );
    }

    const db = getAdminFirestore();

    // Get asset to verify ownership
    const assetDoc = await db.collection('user-media').doc(assetId).get();
    
    if (!assetDoc.exists) {
      return NextResponse.json(
        { success: false, error: 'Asset not found' },
        { status: 404 }
      );
    }

    const asset = assetDoc.data() as MediaAsset;

    if (asset.userId !== userId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 403 }
      );
    }

    // Delete from Vercel Blob
    try {
      await del(asset.url);
    } catch (e) {
      console.warn('[Media API] Blob file not found or already deleted, continuing with Firestore delete');
    }

    // Delete from Firestore
    await db.collection('user-media').doc(assetId).delete();

    console.log(`[Media API] Deleted: ${asset.name} (${assetId})`);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Media API] Delete error:', error);
    return NextResponse.json(
      { success: false, error: 'Delete failed' },
      { status: 500 }
    );
  }
}
