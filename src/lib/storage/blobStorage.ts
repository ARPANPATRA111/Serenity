/**
 * Vercel Blob Storage Module
 * 
 * Handles media uploads using Vercel Blob Storage.
 * Free tier includes 1GB storage which is perfect for user media.
 * Each user has their own media library stored in Firestore with Blob URLs.
 */

import { put, del, list } from '@vercel/blob';
import { db } from '../firebase/client';
import {
  collection,
  doc,
  setDoc,
  getDocs,
  deleteDoc,
  query,
  where,
  orderBy,
} from 'firebase/firestore';

// Maximum file size: 5MB
const MAX_FILE_SIZE = 5 * 1024 * 1024;

// Allowed MIME types
const ALLOWED_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/svg+xml',
  'image/webp',
];

// Allowed extensions
const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.svg', '.webp'];

export interface MediaAsset {
  id: string;
  userId: string;
  name: string;
  url: string;
  type: string;
  size: number;
  uploadedAt: string;
  blobPath: string;
}

export interface UploadResult {
  success: boolean;
  asset?: MediaAsset;
  error?: string;
}

/**
 * Validate file before upload
 */
export function validateMediaFile(file: File): { valid: boolean; error?: string } {
  // Check file size
  if (file.size > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `File size exceeds 5MB limit. Your file is ${(file.size / 1024 / 1024).toFixed(2)}MB`,
    };
  }

  // Check MIME type
  if (!ALLOWED_TYPES.includes(file.type)) {
    return {
      valid: false,
      error: `File type "${file.type}" is not supported. Allowed: Images, SVGs, GIFs`,
    };
  }

  // Check extension
  const fileName = file.name.toLowerCase();
  const hasValidExtension = ALLOWED_EXTENSIONS.some((ext) => fileName.endsWith(ext));
  if (!hasValidExtension) {
    return {
      valid: false,
      error: `File extension not supported. Allowed: ${ALLOWED_EXTENSIONS.join(', ')}`,
    };
  }

  return { valid: true };
}

/**
 * Generate a unique asset ID
 */
function generateAssetId(): string {
  return `asset_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
}

/**
 * Upload a media file to Vercel Blob Storage
 * This function should be called from an API route, not directly from client
 */
export async function uploadMediaToBlob(
  fileBuffer: Buffer,
  fileName: string,
  contentType: string,
  userId: string
): Promise<UploadResult> {
  try {
    const assetId = generateAssetId();
    const blobPath = `media/${userId}/${assetId}_${fileName}`;

    // Upload to Vercel Blob
    const blob = await put(blobPath, fileBuffer, {
      contentType,
      access: 'public',
    });

    // Create asset object
    const asset: MediaAsset = {
      id: assetId,
      userId,
      name: fileName,
      url: blob.url,
      type: contentType,
      size: fileBuffer.length,
      uploadedAt: new Date().toISOString(),
      blobPath: blob.pathname,
    };

    // Store metadata in Firestore
    const assetRef = doc(db, 'media', assetId);
    await setDoc(assetRef, asset);

    return { success: true, asset };
  } catch (error) {
    console.error('Upload error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to upload media',
    };
  }
}

/**
 * Get all media for a user
 */
export async function getUserMedia(userId: string): Promise<MediaAsset[]> {
  try {
    const mediaRef = collection(db, 'media');
    const q = query(
      mediaRef,
      where('userId', '==', userId),
      orderBy('uploadedAt', 'desc')
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => doc.data() as MediaAsset);
  } catch (error) {
    console.error('Error fetching media:', error);
    return [];
  }
}

/**
 * Delete a media asset
 */
export async function deleteMedia(assetId: string, userId: string): Promise<boolean> {
  try {
    // Get the asset first
    const mediaRef = collection(db, 'media');
    const q = query(
      mediaRef,
      where('userId', '==', userId)
    );
    const snapshot = await getDocs(q);
    const assetDoc = snapshot.docs.find((doc) => doc.id === assetId);

    if (!assetDoc) {
      return false;
    }

    const asset = assetDoc.data() as MediaAsset;

    // Delete from Vercel Blob
    try {
      await del(asset.url);
    } catch (e) {
      console.error('Failed to delete from blob:', e);
    }

    // Delete from Firestore
    await deleteDoc(doc(db, 'media', assetId));

    return true;
  } catch (error) {
    console.error('Error deleting media:', error);
    return false;
  }
}

/**
 * Get storage usage for a user
 */
export async function getStorageUsage(userId: string): Promise<{ used: number; count: number }> {
  try {
    const assets = await getUserMedia(userId);
    const totalSize = assets.reduce((sum, asset) => sum + asset.size, 0);
    return { used: totalSize, count: assets.length };
  } catch {
    return { used: 0, count: 0 };
  }
}
