/**
 * Firebase Storage Module
 * 
 * Handles media uploads to Firebase Storage for user assets.
 * Supports images, SVGs, and GIFs with 5MB size limit.
 * Each user has their own media library stored in Firestore.
 */

import { ref, uploadBytes, getDownloadURL, deleteObject, listAll } from 'firebase/storage';
import { storage, db } from './client';
import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  deleteDoc, 
  query, 
  where, 
  orderBy 
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
  storagePath: string;
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
      error: `File size exceeds 5MB limit. Your file is ${(file.size / 1024 / 1024).toFixed(2)}MB` 
    };
  }

  // Check MIME type
  if (!ALLOWED_TYPES.includes(file.type)) {
    return { 
      valid: false, 
      error: `File type "${file.type}" is not supported. Allowed: Images, SVGs, GIFs` 
    };
  }

  // Check extension
  const fileName = file.name.toLowerCase();
  const hasValidExtension = ALLOWED_EXTENSIONS.some(ext => fileName.endsWith(ext));
  if (!hasValidExtension) {
    return { 
      valid: false, 
      error: `File extension not supported. Allowed: ${ALLOWED_EXTENSIONS.join(', ')}` 
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
 * Upload a media file to Firebase Storage
 */
export async function uploadMedia(
  file: File, 
  userId: string
): Promise<UploadResult> {
  try {
    // Validate the file
    const validation = validateMediaFile(file);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    // Generate unique ID and storage path
    const assetId = generateAssetId();
    const fileExtension = file.name.split('.').pop() || 'png';
    const storagePath = `user-media/${userId}/${assetId}.${fileExtension}`;

    // Upload to Firebase Storage
    const storageRef = ref(storage, storagePath);
    await uploadBytes(storageRef, file);
    
    // Get the download URL
    const url = await getDownloadURL(storageRef);

    // Create asset record
    const asset: MediaAsset = {
      id: assetId,
      userId,
      name: file.name,
      url,
      type: file.type,
      size: file.size,
      uploadedAt: new Date().toISOString(),
      storagePath,
    };

    // Save to Firestore
    await setDoc(doc(db, 'user-media', assetId), asset);

    console.log(`[Storage] Uploaded media: ${asset.name} (${assetId})`);
    
    return { success: true, asset };
  } catch (error) {
    console.error('[Storage] Upload failed:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Upload failed' 
    };
  }
}

/**
 * Get all media assets for a user
 */
export async function getUserMedia(userId: string): Promise<MediaAsset[]> {
  try {
    const q = query(
      collection(db, 'user-media'),
      where('userId', '==', userId)
    );
    
    const snapshot = await getDocs(q);
    const assets = snapshot.docs.map(doc => doc.data() as MediaAsset);
    
    // Sort by upload date (newest first)
    return assets.sort((a, b) => 
      new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
    );
  } catch (error) {
    console.error('[Storage] Failed to get user media:', error);
    return [];
  }
}

/**
 * Delete a media asset
 */
export async function deleteMedia(assetId: string, userId: string): Promise<boolean> {
  try {
    // Get the asset to verify ownership and get storage path
    const assetDoc = await getDoc(doc(db, 'user-media', assetId));
    
    if (!assetDoc.exists()) {
      console.warn(`[Storage] Asset not found: ${assetId}`);
      return false;
    }
    
    const asset = assetDoc.data() as MediaAsset;
    
    // Verify ownership
    if (asset.userId !== userId) {
      console.warn(`[Storage] Unauthorized delete attempt for asset: ${assetId}`);
      return false;
    }

    // Delete from Firebase Storage
    const storageRef = ref(storage, asset.storagePath);
    await deleteObject(storageRef);

    // Delete from Firestore
    await deleteDoc(doc(db, 'user-media', assetId));

    console.log(`[Storage] Deleted media: ${asset.name} (${assetId})`);
    return true;
  } catch (error) {
    console.error('[Storage] Delete failed:', error);
    return false;
  }
}

/**
 * Get a single media asset by ID
 */
export async function getMediaById(assetId: string): Promise<MediaAsset | null> {
  try {
    const assetDoc = await getDoc(doc(db, 'user-media', assetId));
    
    if (!assetDoc.exists()) {
      return null;
    }
    
    return assetDoc.data() as MediaAsset;
  } catch (error) {
    console.error('[Storage] Failed to get asset:', error);
    return null;
  }
}

/**
 * Calculate total storage used by a user (in bytes)
 */
export async function getUserStorageUsage(userId: string): Promise<number> {
  try {
    const assets = await getUserMedia(userId);
    return assets.reduce((total, asset) => total + asset.size, 0);
  } catch (error) {
    console.error('[Storage] Failed to calculate storage usage:', error);
    return 0;
  }
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}
