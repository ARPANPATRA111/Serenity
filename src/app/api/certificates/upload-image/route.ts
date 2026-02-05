import { NextRequest, NextResponse } from 'next/server';
import { put } from '@vercel/blob';

export const runtime = 'nodejs';

/**
 * Upload certificate thumbnail image to Vercel Blob storage
 * This avoids Firestore's 1MB document field limit
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { certificateId, imageBase64, userId } = body;

    if (!certificateId || !imageBase64) {
      return NextResponse.json(
        { success: false, error: 'Missing certificateId or imageBase64' },
        { status: 400 }
      );
    }

    // Extract base64 data (remove data:image/xxx;base64, prefix if present)
    const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');
    
    // Determine content type from base64 header
    const isJpeg = imageBase64.startsWith('data:image/jpeg');
    const contentType = isJpeg ? 'image/jpeg' : 'image/png';
    const extension = isJpeg ? 'jpg' : 'png';
    
    // Convert base64 to buffer
    const imageBuffer = Buffer.from(base64Data, 'base64');
    
    // Check size - limit to 2MB for thumbnails
    if (imageBuffer.length > 2 * 1024 * 1024) {
      return NextResponse.json(
        { success: false, error: 'Image too large (max 2MB)' },
        { status: 400 }
      );
    }

    // Generate blob path
    const blobPath = `certificates/${userId || 'anonymous'}/${certificateId}.${extension}`;

    // Upload to Vercel Blob
    const blob = await put(blobPath, imageBuffer, {
      contentType,
      access: 'public',
    });

    return NextResponse.json({
      success: true,
      url: blob.url,
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
