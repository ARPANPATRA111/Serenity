import { NextRequest, NextResponse } from 'next/server';
import { put, del } from '@vercel/blob';
import { getAdminFirestore } from '@/lib/firebase/admin';
import { nanoid } from 'nanoid';
import { forbiddenResponse, unauthorizedResponse, verifyAuth } from '@/lib/firebase/verifyAuth';

// Maximum file size: 5MB
const MAX_FILE_SIZE = 5 * 1024 * 1024;

const EXTENSION_BY_TYPE: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

const ALLOWED_TYPES = Object.keys(EXTENSION_BY_TYPE);
const BLOCKED_EXTENSIONS = new Set(['.svg', '.svgz', '.gif']);

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

function rejectMismatchedUserId(clientUserId: unknown, uid: string) {
  if (clientUserId && typeof clientUserId === 'string' && clientUserId !== uid) {
    return forbiddenResponse('Authenticated user does not match requested user ID');
  }

  return null;
}

function getFileExtension(fileName: string): string {
  const normalized = fileName.toLowerCase().trim();
  const dotIndex = normalized.lastIndexOf('.');
  return dotIndex >= 0 ? normalized.slice(dotIndex) : '';
}

function hasBlockedExtension(fileName: string): boolean {
  return BLOCKED_EXTENSIONS.has(getFileExtension(fileName));
}

function hasBlockedImageSignature(buffer: Buffer): boolean {
  if (buffer.subarray(0, 6).toString('ascii') === 'GIF87a') return true;
  if (buffer.subarray(0, 6).toString('ascii') === 'GIF89a') return true;

  const head = buffer
    .subarray(0, 1024)
    .toString('utf8')
    .replace(/\u0000/g, '')
    .trimStart()
    .toLowerCase();

  return head.startsWith('<svg') || (head.startsWith('<?xml') && head.includes('<svg'));
}

export async function POST(request: NextRequest) {
  try {
    const authUser = await verifyAuth(request);
    if (!authUser) {
      return unauthorizedResponse();
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const clientUserId = formData.get('userId');
    const mismatch = rejectMismatchedUserId(clientUserId, authUser.uid);
    if (mismatch) return mismatch;

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No file provided' },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { success: false, error: `File exceeds 5MB limit (${(file.size / 1024 / 1024).toFixed(2)}MB)` },
        { status: 400 }
      );
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { success: false, error: 'File type not supported. Use PNG, JPEG, JPG, or WebP images.' },
        { status: 400 }
      );
    }

    const originalName = formData.get('originalName') as string;
    const displayName = originalName || file.name;

    if (hasBlockedExtension(file.name) || hasBlockedExtension(displayName)) {
      return NextResponse.json(
        { success: false, error: 'SVG and GIF uploads are not supported.' },
        { status: 400 }
      );
    }

    const assetId = `asset_${nanoid(10)}`;
    const fileExtension = EXTENSION_BY_TYPE[file.type];
    const blobPath = `media/${authUser.uid}/${assetId}.${fileExtension}`;

    const buffer = Buffer.from(await file.arrayBuffer());
    if (hasBlockedImageSignature(buffer)) {
      return NextResponse.json(
        { success: false, error: 'SVG and GIF uploads are not supported.' },
        { status: 400 }
      );
    }

    const blob = await put(blobPath, buffer, {
      contentType: file.type,
      access: 'public',
    });

    const asset: MediaAsset = {
      id: assetId,
      userId: authUser.uid,
      name: displayName,
      url: blob.url,
      type: file.type,
      size: file.size,
      uploadedAt: new Date().toISOString(),
      blobPath: blob.pathname,
    };

    const db = getAdminFirestore();
    await db.collection('user-media').doc(assetId).set(asset);

    console.log(`[Media API] Uploaded: ${asset.name} for user ${authUser.uid}`);

    return NextResponse.json({ success: true, asset });
  } catch (error) {
    console.error('[Media API] Upload error:', error);

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
    const authUser = await verifyAuth(request);
    if (!authUser) {
      return unauthorizedResponse();
    }

    const { searchParams } = new URL(request.url);
    const mismatch = rejectMismatchedUserId(searchParams.get('userId'), authUser.uid);
    if (mismatch) return mismatch;

    const db = getAdminFirestore();
    const snapshot = await db
      .collection('user-media')
      .where('userId', '==', authUser.uid)
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
    const authUser = await verifyAuth(request);
    if (!authUser) {
      return unauthorizedResponse();
    }

    const { searchParams } = new URL(request.url);
    const assetId = searchParams.get('assetId');
    const mismatch = rejectMismatchedUserId(searchParams.get('userId'), authUser.uid);
    if (mismatch) return mismatch;

    if (!assetId) {
      return NextResponse.json(
        { success: false, error: 'Asset ID required' },
        { status: 400 }
      );
    }

    const db = getAdminFirestore();
    const assetDoc = await db.collection('user-media').doc(assetId).get();

    if (!assetDoc.exists) {
      return NextResponse.json(
        { success: false, error: 'Asset not found' },
        { status: 404 }
      );
    }

    const asset = assetDoc.data() as MediaAsset;

    if (asset.userId !== authUser.uid) {
      return forbiddenResponse('Forbidden');
    }

    try {
      await del(asset.url);
    } catch {
      console.warn('[Media API] Blob file not found or already deleted, continuing with Firestore delete');
    }

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
