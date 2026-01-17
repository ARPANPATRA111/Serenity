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

// Database name and version
const DB_NAME = 'serenity-media-db';
const DB_VERSION = 1;
const STORE_NAME = 'media-assets';

export interface LocalMediaAsset {
  id: string;
  userId: string;
  name: string;
  dataUrl: string;
  type: string;
  size: number;
  uploadedAt: string;
  thumbnail?: string;
}

export interface UploadResult {
  success: boolean;
  asset?: LocalMediaAsset;
  error?: string;
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      reject(new Error('Failed to open IndexedDB'));
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('userId', 'userId', { unique: false });
        store.createIndex('uploadedAt', 'uploadedAt', { unique: false });
      }
    };
  });
}

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

function generateAssetId(): string {
  return `asset_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

function createThumbnail(dataUrl: string, maxSize: number = 150): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;

      if (width > height) {
        if (width > maxSize) {
          height *= maxSize / width;
          width = maxSize;
        }
      } else {
        if (height > maxSize) {
          width *= maxSize / height;
          height = maxSize;
        }
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', 0.7));
    };
    img.onerror = () => resolve(dataUrl); // Fallback to original if thumbnail fails
    img.src = dataUrl;
  });
}

export async function uploadLocalMedia(
  file: File,
  userId: string
): Promise<UploadResult> {
  try {
    // Validate file
    const validation = validateMediaFile(file);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    // Convert to data URL
    const dataUrl = await fileToDataUrl(file);
    const thumbnail = await createThumbnail(dataUrl);

    // Create asset object
    const asset: LocalMediaAsset = {
      id: generateAssetId(),
      userId,
      name: file.name,
      dataUrl,
      type: file.type,
      size: file.size,
      uploadedAt: new Date().toISOString(),
      thumbnail,
    };

    // Store in IndexedDB
    const db = await openDatabase();
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);

    return new Promise((resolve) => {
      const request = store.add(asset);

      request.onsuccess = () => {
        resolve({ success: true, asset });
      };

      request.onerror = () => {
        resolve({ success: false, error: 'Failed to save asset to local storage' });
      };
    });
  } catch (error) {
    console.error('Upload error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to upload media',
    };
  }
}

export async function getUserLocalMedia(userId: string): Promise<LocalMediaAsset[]> {
  try {
    const db = await openDatabase();
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const index = store.index('userId');

    return new Promise((resolve) => {
      const request = index.getAll(userId);

      request.onsuccess = () => {
        const assets = request.result || [];
        // Sort by uploadedAt descending
        assets.sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());
        resolve(assets);
      };

      request.onerror = () => {
        console.error('Failed to fetch local media');
        resolve([]);
      };
    });
  } catch (error) {
    console.error('Error fetching local media:', error);
    return [];
  }
}

export async function deleteLocalMedia(assetId: string, userId: string): Promise<boolean> {
  try {
    const db = await openDatabase();
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);

    // First, verify ownership
    const getRequest = store.get(assetId);
    
    return new Promise((resolve) => {
      getRequest.onsuccess = () => {
        const asset = getRequest.result;
        if (!asset || asset.userId !== userId) {
          resolve(false);
          return;
        }

        const deleteRequest = store.delete(assetId);
        deleteRequest.onsuccess = () => resolve(true);
        deleteRequest.onerror = () => resolve(false);
      };

      getRequest.onerror = () => resolve(false);
    });
  } catch (error) {
    console.error('Error deleting local media:', error);
    return false;
  }
}

export async function getStorageUsage(userId: string): Promise<{ used: number; count: number }> {
  try {
    const assets = await getUserLocalMedia(userId);
    const totalSize = assets.reduce((sum, asset) => sum + asset.size, 0);
    return { used: totalSize, count: assets.length };
  } catch {
    return { used: 0, count: 0 };
  }
}

export async function clearUserMedia(userId: string): Promise<boolean> {
  try {
    const assets = await getUserLocalMedia(userId);
    const db = await openDatabase();
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);

    for (const asset of assets) {
      store.delete(asset.id);
    }

    return true;
  } catch {
    return false;
  }
}
