'use client';

/**
 * Left Sidebar - Media Library
 * 
 * Provides media upload and management functionality.
 * All media must be uploaded before use in the editor.
 * Images are automatically compressed before upload for optimal performance.
 */

import { useCallback, useState, useEffect, useRef } from 'react';
import { useFabricContext } from './FabricContext';
import { useEditorStore, MediaAsset } from '@/store/editorStore';
import { useAuth } from '@/contexts/AuthContext';
import imageCompression from 'browser-image-compression';
import {
  Upload,
  Image as ImageIcon,
  Trash2,
  Loader2,
  FolderOpen,
  AlertCircle,
  X,
  Check,
  HardDrive,
  Zap,
} from 'lucide-react';
import Image from 'next/image';

// Maximum file size: 5MB (before compression)
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/svg+xml', 'image/webp'];

// Compression options - maintains quality while reducing size
const COMPRESSION_OPTIONS = {
  maxSizeMB: 1, // Target 1MB max after compression
  maxWidthOrHeight: 2048, // Max dimension
  useWebWorker: true,
  preserveExif: false,
  fileType: 'image/webp', // Convert to WebP for better compression
};

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

export function LeftSidebar() {
  const { fabricInstance } = useFabricContext();
  const { user } = useAuth();
  const { 
    mediaAssets, 
    isLoadingMedia, 
    isUploadingMedia,
    setMediaAssets,
    addMediaAsset,
    removeMediaAsset,
    setIsLoadingMedia,
    setIsUploadingMedia,
    isPreviewMode,
  } = useEditorStore();
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [compressionStatus, setCompressionStatus] = useState<string | null>(null);

  // Fetch user media on mount
  useEffect(() => {
    const fetchMedia = async () => {
      if (!user?.id) return;
      
      setIsLoadingMedia(true);
      try {
        const res = await fetch(`/api/media?userId=${user.id}`);
        if (res.ok) {
          const data = await res.json();
          if (data.success) {
            setMediaAssets(data.assets || []);
          }
        }
      } catch (e) {
        console.error('Failed to fetch media:', e);
      } finally {
        setIsLoadingMedia(false);
      }
    };

    fetchMedia();
  }, [user?.id, setMediaAssets, setIsLoadingMedia]);

  // Validate file
  const validateFile = (file: File): string | null => {
    if (file.size > MAX_FILE_SIZE) {
      return `File too large (${formatFileSize(file.size)}). Maximum size is 5MB.`;
    }
    if (!ALLOWED_TYPES.includes(file.type)) {
      return `Invalid file type. Allowed: Images, SVGs, GIFs`;
    }
    return null;
  };

  // Compress image before upload
  const compressImage = async (file: File): Promise<File> => {
    // Skip compression for SVGs and GIFs (they don't benefit from this type of compression)
    if (file.type === 'image/svg+xml' || file.type === 'image/gif') {
      return file;
    }

    try {
      console.log(`[Media] Compressing ${file.name}: ${formatFileSize(file.size)}`);
      const compressedFile = await imageCompression(file, COMPRESSION_OPTIONS);
      console.log(`[Media] Compressed to: ${formatFileSize(compressedFile.size)} (${((1 - compressedFile.size / file.size) * 100).toFixed(1)}% reduction)`);
      return compressedFile;
    } catch (e) {
      console.warn('[Media] Compression failed, using original:', e);
      return file;
    }
  };

  // Handle file upload with compression
  const handleUpload = useCallback(async (files: FileList | File[]) => {
    if (!user?.id) return;
    
    const fileArray = Array.from(files);
    
    for (const file of fileArray) {
      const error = validateFile(file);
      if (error) {
        setUploadError(error);
        return;
      }
    }

    setUploadError(null);
    setIsUploadingMedia(true);
    setCompressionStatus('Preparing...');

    try {
      for (let i = 0; i < fileArray.length; i++) {
        const file = fileArray[i];
        
        // Show compression status
        setCompressionStatus(`Optimizing ${i + 1}/${fileArray.length}...`);
        
        // Compress the image
        const compressedFile = await compressImage(file);
        
        setCompressionStatus(`Uploading ${i + 1}/${fileArray.length}...`);
        
        const formData = new FormData();
        formData.append('file', compressedFile);
        formData.append('userId', user.id);
        // Keep original filename but note the original size
        formData.append('originalName', file.name);
        formData.append('originalSize', file.size.toString());

        const res = await fetch('/api/media', {
          method: 'POST',
          body: formData,
        });

        if (res.ok) {
          const data = await res.json();
          if (data.success && data.asset) {
            addMediaAsset(data.asset);
          }
        } else {
          const data = await res.json();
          setUploadError(data.error || 'Upload failed');
        }
      }
    } catch (e) {
      console.error('Upload failed:', e);
      setUploadError('Upload failed. Please try again.');
    } finally {
      setIsUploadingMedia(false);
      setCompressionStatus(null);
    }
  }, [user?.id, addMediaAsset, setIsUploadingMedia]);

  // Handle delete
  const handleDelete = useCallback(async (assetId: string) => {
    if (!user?.id) return;

    try {
      const res = await fetch(`/api/media?assetId=${assetId}&userId=${user.id}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        removeMediaAsset(assetId);
      }
    } catch (e) {
      console.error('Delete failed:', e);
    } finally {
      setDeleteConfirm(null);
    }
  }, [user?.id, removeMediaAsset]);

  // Add image to canvas
  const handleAddToCanvas = useCallback((asset: MediaAsset) => {
    if (!fabricInstance || isPreviewMode) return;
    fabricInstance.addImage(asset.url);
  }, [fabricInstance, isPreviewMode]);

  // Drag and drop handlers
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    
    if (e.dataTransfer.files.length > 0) {
      handleUpload(e.dataTransfer.files);
    }
  }, [handleUpload]);

  // Calculate total storage used
  const totalStorage = mediaAssets.reduce((acc, asset) => acc + asset.size, 0);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border p-4">
        <div className="flex items-center gap-2">
          <FolderOpen className="h-5 w-5 text-primary" />
          <h2 className="font-semibold text-foreground">Media Library</h2>
        </div>
        <div className="text-xs text-muted-foreground">
          {mediaAssets.length} files
        </div>
      </div>

      {/* Upload Section */}
      <div className="border-b border-border p-4">
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`relative rounded-lg border-2 border-dashed transition-all ${
            dragOver 
              ? 'border-primary bg-primary/10' 
              : 'border-border hover:border-primary/50'
          } ${isPreviewMode ? 'opacity-50 pointer-events-none' : ''}`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,.svg"
            multiple
            onChange={(e) => e.target.files && handleUpload(e.target.files)}
            className="hidden"
            disabled={isPreviewMode}
          />
          
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploadingMedia || isPreviewMode}
            className="flex w-full flex-col items-center gap-2 p-4 text-center"
          >
            {isUploadingMedia ? (
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            ) : (
              <Upload className="h-8 w-8 text-muted-foreground" />
            )}
            <div>
              <p className="text-sm font-medium">
                {isUploadingMedia 
                  ? (compressionStatus || 'Processing...') 
                  : 'Upload Media'}
              </p>
              <p className="text-xs text-muted-foreground">
                {isUploadingMedia ? (
                  <span className="flex items-center gap-1">
                    <Zap className="h-3 w-3" />
                    Auto-optimizing for best quality
                  </span>
                ) : (
                  'Images, SVGs, GIFs • Max 5MB'
                )}
              </p>
            </div>
          </button>
        </div>

        {/* Upload Error */}
        {uploadError && (
          <div className="mt-2 flex items-center gap-2 rounded-md bg-destructive/10 p-2 text-xs text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{uploadError}</span>
            <button onClick={() => setUploadError(null)} className="ml-auto">
              <X className="h-3 w-3" />
            </button>
          </div>
        )}

        {/* Storage Usage */}
        <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
          <HardDrive className="h-3 w-3" />
          <span>Storage: {formatFileSize(totalStorage)}</span>
          <span className="ml-auto flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
            <Zap className="h-3 w-3" />
            <span>Optimized</span>
          </span>
        </div>
      </div>

      {/* Media Grid */}
      <div className="flex-1 overflow-y-auto p-4 scrollbar-thin">
        {isLoadingMedia ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : mediaAssets.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <ImageIcon className="h-12 w-12 text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground">No media uploaded yet</p>
            <p className="text-xs text-muted-foreground mt-1">
              Upload images to use in your certificates
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {mediaAssets.map((asset) => (
              <MediaItem
                key={asset.id}
                asset={asset}
                onAdd={() => handleAddToCanvas(asset)}
                onDelete={() => setDeleteConfirm(asset.id)}
                isDeleting={deleteConfirm === asset.id}
                onConfirmDelete={() => handleDelete(asset.id)}
                onCancelDelete={() => setDeleteConfirm(null)}
                disabled={isPreviewMode}
              />
            ))}
          </div>
        )}
      </div>

      {/* Preview Mode Notice */}
      {isPreviewMode && (
        <div className="border-t border-border bg-amber-500/10 p-3 text-center">
          <p className="text-xs font-medium text-amber-600 dark:text-amber-400">
            Preview Mode Active - Editing Disabled
          </p>
        </div>
      )}
    </div>
  );
}

interface MediaItemProps {
  asset: MediaAsset;
  onAdd: () => void;
  onDelete: () => void;
  isDeleting: boolean;
  onConfirmDelete: () => void;
  onCancelDelete: () => void;
  disabled?: boolean;
}

function MediaItem({ 
  asset, 
  onAdd, 
  onDelete, 
  isDeleting, 
  onConfirmDelete, 
  onCancelDelete,
  disabled 
}: MediaItemProps) {
  return (
    <div className={`group relative rounded-lg border border-border bg-muted/30 overflow-hidden transition-all hover:border-primary/50 ${disabled ? 'opacity-50' : ''}`}>
      {/* Image Preview */}
      <button
        onClick={onAdd}
        disabled={disabled}
        className="w-full aspect-square relative"
      >
        <Image
          src={asset.url}
          alt={asset.name}
          fill
          className="object-cover"
          sizes="100px"
        />
      </button>

      {/* Overlay Actions */}
      {!isDeleting && (
        <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={onAdd}
            disabled={disabled}
            className="rounded-full bg-primary p-2 text-white hover:bg-primary/90"
            title="Add to canvas"
          >
            <Check className="h-4 w-4" />
          </button>
          <button
            onClick={onDelete}
            disabled={disabled}
            className="rounded-full bg-destructive p-2 text-white hover:bg-destructive/90"
            title="Delete"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Delete Confirmation */}
      {isDeleting && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/80 p-2">
          <p className="text-xs text-white text-center">Delete?</p>
          <div className="flex gap-1">
            <button
              onClick={onConfirmDelete}
              className="rounded bg-destructive px-2 py-1 text-xs text-white"
            >
              Yes
            </button>
            <button
              onClick={onCancelDelete}
              className="rounded bg-muted px-2 py-1 text-xs"
            >
              No
            </button>
          </div>
        </div>
      )}

      {/* File Info */}
      <div className="p-1.5 bg-background/80">
        <p className="text-xs truncate" title={asset.name}>
          {asset.name}
        </p>
        <p className="text-[10px] text-muted-foreground">
          {formatFileSize(asset.size)}
        </p>
      </div>
    </div>
  );
}
