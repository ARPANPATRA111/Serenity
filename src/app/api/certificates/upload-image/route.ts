import { NextRequest, NextResponse } from 'next/server';
import { forbiddenResponse, unauthorizedResponse, verifyAuth } from '@/lib/firebase/verifyAuth';
import { isLocalObjectStore, putPublicObject, requestOrigin } from '@/lib/storage/objectStore';
import {
  MAX_FIRESTORE_PREVIEW_BYTES,
  PreviewOwnershipError,
  previewStore,
  previewUrl,
  savePreview,
} from '@/lib/storage/certificatePreviews';
import { getAdminFirestore } from '@/lib/firebase/admin';
import { isValidCertificateId } from '@/lib/verification/certificateId';

export const runtime = 'nodejs';

const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

function hasImageSignature(buffer: Buffer, kind: 'png' | 'jpeg'): boolean {
  if (kind === 'png') {
    return buffer.length > 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  }
  return buffer.length > 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
}

/**
 * Upload certificate thumbnail image to public object storage.
 * This avoids Firestore's 1MB document field limit.
 */
export async function POST(request: NextRequest) {
  try {
    const authUser = await verifyAuth(request);
    if (!authUser) {
      return unauthorizedResponse();
    }

    const body = await request.json();
    const { certificateId, imageBase64, userId } = body;

    if (!certificateId || !imageBase64 || typeof imageBase64 !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Missing certificateId or imageBase64' },
        { status: 400 }
      );
    }

    if (!isValidCertificateId(certificateId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid certificate ID' },
        { status: 400 }
      );
    }

    if (userId && userId !== authUser.uid) {
      return forbiddenResponse('Authenticated user does not match requested user ID');
    }

    const isPng = imageBase64.startsWith('data:image/png');
    const isJpeg = imageBase64.startsWith('data:image/jpeg') || imageBase64.startsWith('data:image/jpg');
    if (!isPng && !isJpeg) {
      return NextResponse.json(
        { success: false, error: 'Only PNG and JPEG certificate images are supported' },
        { status: 400 }
      );
    }

    const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');
    const contentType = isJpeg ? 'image/jpeg' : 'image/png';
    const extension = isJpeg ? 'jpg' : 'png';
    const imageBuffer = Buffer.from(base64Data, 'base64');

    if (imageBuffer.length > MAX_IMAGE_BYTES) {
      return NextResponse.json(
        { success: false, error: 'Image too large (max 2MB)' },
        { status: 400 }
      );
    }

    if (!hasImageSignature(imageBuffer, isJpeg ? 'jpeg' : 'png')) {
      return NextResponse.json(
        { success: false, error: 'Image data does not match its declared type' },
        { status: 400 }
      );
    }

    // Previews go to Firestore unless the deployment opts into Blob, or the
    // image is too large for a document (generator budgets keep it far below).
    if (previewStore() === 'firestore' && imageBuffer.length <= MAX_FIRESTORE_PREVIEW_BYTES) {
      try {
        const preview = await savePreview(getAdminFirestore(), {
          certificateId,
          userId: authUser.uid,
          contentType,
          data: imageBuffer,
        });
        // Links use the canonical site address so they outlive preview deployments.
        const baseUrl = isLocalObjectStore() ? requestOrigin(request) : (process.env.NEXT_PUBLIC_SITE_URL || requestOrigin(request));
        return NextResponse.json({
          success: true,
          url: previewUrl(baseUrl, certificateId, preview.sha256),
          certificateId,
        });
      } catch (error) {
        if (error instanceof PreviewOwnershipError) {
          return forbiddenResponse(error.message);
        }
        // e.g. the daily write quota is used up: Blob below is an independent quota.
        console.warn('[API/certificates/upload-image] Firestore preview store unavailable; using object storage:', error);
      }
    }

    // The path is deterministic per certificate, so a retried upload for the
    // same certificate replaces the identical image instead of failing.
    const stored = await putPublicObject(
      `certificates/${authUser.uid}/${certificateId}.${extension}`,
      imageBuffer,
      { contentType, origin: requestOrigin(request), allowOverwrite: true },
    );

    return NextResponse.json({
      success: true,
      url: stored.url,
      certificateId,
    });
  } catch (error) {
    console.error('[API/certificates/upload-image] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to upload image' },
      { status: 500 }
    );
  }
}
