'use client';

import { useCallback, useState, useEffect, useRef } from 'react';
import { useFabricContext } from './FabricContext';
import { useEditorStore, MediaAsset, LeftSidebarTab } from '@/store/editorStore';
import { useAuth } from '@/contexts/AuthContext';
import imageCompression from 'browser-image-compression';
import { ColorPicker } from '@/components/ui/ColorPicker';
import { fabric } from 'fabric';
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
  Palette,
  Sparkles,
  FlipHorizontal,
  FlipVertical,
  RotateCcw,
  RotateCw,
  Sun,
  Contrast,
  CircleOff,
  Droplets,
  Waves,
  Grid3X3,
  SlidersHorizontal,
} from 'lucide-react';
import Image from 'next/image';

// Maximum file size: 5MB (before compression)
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/svg+xml', 'image/webp'];

// Compression options
const COMPRESSION_OPTIONS = {
  maxSizeMB: 1,
  maxWidthOrHeight: 2048,
  useWebWorker: true,
  preserveExif: false,
  fileType: 'image/webp',
};

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

// Image filter presets
const IMAGE_FILTERS = [
  { name: 'None', filter: null },
  { name: 'Grayscale', filter: new fabric.Image.filters.Grayscale() },
  { name: 'Sepia', filter: new fabric.Image.filters.Sepia() },
  { name: 'Invert', filter: new fabric.Image.filters.Invert() },
  { name: 'Blur', filter: new fabric.Image.filters.Blur({ blur: 0.2 }) },
  { name: 'Sharpen', filter: new fabric.Image.filters.Convolute({ matrix: [0, -1, 0, -1, 5, -1, 0, -1, 0] }) },
  { name: 'Emboss', filter: new fabric.Image.filters.Convolute({ matrix: [1, 1, 1, 1, 0.7, -1, -1, -1, -1] }) },
];

export function LeftSidebarTabs() {
  const { fabricInstance } = useFabricContext();
  const { user } = useAuth();
  const isPremium = user?.isPremium === true;
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
    leftSidebarTab,
    setLeftSidebarTab,
    selectedObject,
    selectedObjectType,
  } = useEditorStore();
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [compressionStatus, setCompressionStatus] = useState<string | null>(null);

  // Image editing state
  const [brightness, setBrightness] = useState(0);
  const [contrast, setContrast] = useState(0);
  const [saturation, setSaturation] = useState(0);

  const isImage = selectedObjectType === 'image';
  const hasQRCode = isImage && !!(selectedObject as any)?.verificationId;

  // Reset image editing state when selection changes
  useEffect(() => {
    if (selectedObject && isImage) {
      setBrightness(0);
      setContrast(0);
      setSaturation(0);
    }
  }, [selectedObject, isImage]);

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

  // Compress image
  const compressImage = async (file: File): Promise<File> => {
    if (file.type === 'image/svg+xml' || file.type === 'image/gif') {
      return file;
    }
    try {
      const compressedFile = await imageCompression(file, COMPRESSION_OPTIONS);
      return compressedFile;
    } catch (e) {
      return file;
    }
  };

  // Handle upload
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
        setCompressionStatus(`Optimizing ${i + 1}/${fileArray.length}...`);
        const compressedFile = await compressImage(file);
        setCompressionStatus(`Uploading ${i + 1}/${fileArray.length}...`);
        
        const formData = new FormData();
        formData.append('file', compressedFile);
        formData.append('userId', user.id);
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

  // Drag handlers
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

  // Image editing functions
  const handleFlipHorizontal = useCallback(() => {
    if (!selectedObject || !fabricInstance) return;
    (selectedObject as fabric.Image).set('flipX', !(selectedObject as fabric.Image).flipX);
    fabricInstance.getCanvas()?.requestRenderAll();
  }, [selectedObject, fabricInstance]);

  const handleFlipVertical = useCallback(() => {
    if (!selectedObject || !fabricInstance) return;
    (selectedObject as fabric.Image).set('flipY', !(selectedObject as fabric.Image).flipY);
    fabricInstance.getCanvas()?.requestRenderAll();
  }, [selectedObject, fabricInstance]);

  const handleRotate = useCallback((degrees: number) => {
    if (!selectedObject || !fabricInstance) return;
    const currentAngle = selectedObject.angle || 0;
    selectedObject.rotate(currentAngle + degrees);
    fabricInstance.getCanvas()?.requestRenderAll();
  }, [selectedObject, fabricInstance]);

  const applyImageFilter = useCallback((filterIndex: number) => {
    if (!selectedObject || !fabricInstance || !isImage || hasQRCode) return;
    
    const img = selectedObject as fabric.Image;
    img.filters = [];
    
    if (filterIndex > 0 && IMAGE_FILTERS[filterIndex].filter) {
      img.filters.push(IMAGE_FILTERS[filterIndex].filter!);
    }
    
    img.applyFilters();
    fabricInstance.getCanvas()?.requestRenderAll();
  }, [selectedObject, fabricInstance, isImage, hasQRCode]);

  const applyBrightnessContrast = useCallback(() => {
    if (!selectedObject || !fabricInstance || !isImage || hasQRCode) return;
    
    const img = selectedObject as fabric.Image;
    img.filters = img.filters?.filter(f => 
      !(f instanceof fabric.Image.filters.Brightness) && 
      !(f instanceof fabric.Image.filters.Contrast) &&
      !(f instanceof fabric.Image.filters.Saturation)
    ) || [];
    
    if (brightness !== 0) {
      img.filters.push(new fabric.Image.filters.Brightness({ brightness: brightness / 100 }));
    }
    if (contrast !== 0) {
      img.filters.push(new fabric.Image.filters.Contrast({ contrast: contrast / 100 }));
    }
    if (saturation !== 0) {
      img.filters.push(new fabric.Image.filters.Saturation({ saturation: saturation / 100 }));
    }
    
    img.applyFilters();
    fabricInstance.getCanvas()?.requestRenderAll();
  }, [selectedObject, fabricInstance, isImage, hasQRCode, brightness, contrast, saturation]);

  // Apply brightness/contrast when sliders change
  useEffect(() => {
    applyBrightnessContrast();
  }, [brightness, contrast, saturation, applyBrightnessContrast]);

  const totalStorage = mediaAssets.reduce((acc, asset) => acc + asset.size, 0);

  const tabs: { id: LeftSidebarTab; label: string; icon: React.ElementType }[] = [
    { id: 'media', label: 'Media', icon: FolderOpen },
    { id: 'colors', label: 'Colors', icon: Palette },
    { id: 'effects', label: 'Effects', icon: Sparkles },
  ];

  return (
    <div className={`flex h-full flex-col overflow-hidden ${isPremium ? 'premium-sidebar' : ''}`}>
      {/* Tab Navigation */}
      <div className="flex border-b border-border bg-muted/30">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setLeftSidebarTab(tab.id)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-colors ${
              leftSidebarTab === tab.id
                ? 'text-primary border-b-2 border-primary bg-background'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
            }`}
          >
            <tab.icon className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {/* Media Tab */}
        {leftSidebarTab === 'media' && (
          <MediaTabContent
            mediaAssets={mediaAssets}
            isLoadingMedia={isLoadingMedia}
            isUploadingMedia={isUploadingMedia}
            isPreviewMode={isPreviewMode}
            dragOver={dragOver}
            uploadError={uploadError}
            compressionStatus={compressionStatus}
            totalStorage={totalStorage}
            deleteConfirm={deleteConfirm}
            fileInputRef={fileInputRef}
            onUpload={handleUpload}
            onAddToCanvas={handleAddToCanvas}
            onDelete={handleDelete}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            setDeleteConfirm={setDeleteConfirm}
            setUploadError={setUploadError}
          />
        )}

        {/* Colors Tab */}
        {leftSidebarTab === 'colors' && (
          <ColorsTabContent isPremium={isPremium} />
        )}

        {/* Effects Tab */}
        {leftSidebarTab === 'effects' && (
          <EffectsTabContent
            isImage={isImage}
            hasQRCode={hasQRCode}
            selectedObject={selectedObject}
            brightness={brightness}
            contrast={contrast}
            saturation={saturation}
            setBrightness={setBrightness}
            setContrast={setContrast}
            setSaturation={setSaturation}
            onFlipHorizontal={handleFlipHorizontal}
            onFlipVertical={handleFlipVertical}
            onRotate={handleRotate}
            onApplyFilter={applyImageFilter}
            isPreviewMode={isPreviewMode}
          />
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

// Media Tab Content Component
interface MediaTabContentProps {
  mediaAssets: MediaAsset[];
  isLoadingMedia: boolean;
  isUploadingMedia: boolean;
  isPreviewMode: boolean;
  dragOver: boolean;
  uploadError: string | null;
  compressionStatus: string | null;
  totalStorage: number;
  deleteConfirm: string | null;
  fileInputRef: React.RefObject<HTMLInputElement>;
  onUpload: (files: FileList | File[]) => void;
  onAddToCanvas: (asset: MediaAsset) => void;
  onDelete: (assetId: string) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  setDeleteConfirm: (id: string | null) => void;
  setUploadError: (error: string | null) => void;
}

function MediaTabContent({
  mediaAssets,
  isLoadingMedia,
  isUploadingMedia,
  isPreviewMode,
  dragOver,
  uploadError,
  compressionStatus,
  totalStorage,
  deleteConfirm,
  fileInputRef,
  onUpload,
  onAddToCanvas,
  onDelete,
  onDragOver,
  onDragLeave,
  onDrop,
  setDeleteConfirm,
  setUploadError,
}: MediaTabContentProps) {
  return (
    <div className="p-3 space-y-3">
      {/* Upload Section */}
      <div
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        className={`relative rounded-lg border-2 border-dashed transition-all ${
          dragOver 
            ? 'border-primary bg-primary/10' 
            : 'border-border hover:border-primary/50'
        } ${isPreviewMode ? 'opacity-50 pointer-events-none' : ''}`}
      >
        <label htmlFor="media-upload" className="sr-only">Upload media files</label>
        <input
          id="media-upload"
          ref={fileInputRef}
          type="file"
          accept="image/*,.svg"
          multiple
          onChange={(e) => e.target.files && onUpload(e.target.files)}
          className="hidden"
          disabled={isPreviewMode}
        />
        
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploadingMedia || isPreviewMode}
          className="flex w-full flex-col items-center gap-2 p-3 text-center"
        >
          {isUploadingMedia ? (
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          ) : (
            <Upload className="h-6 w-6 text-muted-foreground" />
          )}
          <div>
            <p className="text-xs font-medium">
              {isUploadingMedia ? (compressionStatus || 'Processing...') : 'Upload Media'}
            </p>
            <p className="text-[10px] text-muted-foreground">
              {isUploadingMedia ? 'Auto-optimizing' : 'Images, SVGs • Max 5MB'}
            </p>
          </div>
        </button>
      </div>

      {/* Upload Error */}
      {uploadError && (
        <div className="flex items-center gap-2 rounded-md bg-destructive/10 p-2 text-xs text-destructive">
          <AlertCircle className="h-3 w-3 shrink-0" />
          <span className="flex-1">{uploadError}</span>
          <button onClick={() => setUploadError(null)} title="Dismiss error" aria-label="Dismiss error">
            <X className="h-3 w-3" />
          </button>
        </div>
      )}

      {/* Storage Usage */}
      <div className="flex items-center gap-2 text-[10px] text-muted-foreground px-1">
        <HardDrive className="h-3 w-3" />
        <span>{formatFileSize(totalStorage)} used</span>
        <span className="ml-auto flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
          <Zap className="h-3 w-3" />
          Optimized
        </span>
      </div>

      {/* Media Grid */}
      {isLoadingMedia ? (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : mediaAssets.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-6 text-center">
          <ImageIcon className="h-10 w-10 text-muted-foreground/30 mb-2" />
          <p className="text-xs text-muted-foreground">No media uploaded</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {mediaAssets.map((asset) => (
            <MediaItem
              key={asset.id}
              asset={asset}
              onAdd={() => onAddToCanvas(asset)}
              onDelete={() => setDeleteConfirm(asset.id)}
              isDeleting={deleteConfirm === asset.id}
              onConfirmDelete={() => onDelete(asset.id)}
              onCancelDelete={() => setDeleteConfirm(null)}
              disabled={isPreviewMode}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// Colors Tab Content Component
interface ColorsTabContentProps {
  isPremium: boolean;
}

function ColorsTabContent({ isPremium }: ColorsTabContentProps) {
  const { fabricInstance } = useFabricContext();
  const { selectedObject, selectedObjectType } = useEditorStore();

  const object = selectedObject as any;
  const isText = selectedObjectType === 'textbox' || selectedObjectType === 'i-text';
  const isShape = selectedObjectType === 'rect' || selectedObjectType === 'circle' || selectedObjectType === 'triangle' || selectedObjectType === 'polygon' || selectedObjectType === 'path';
  const isLine = selectedObjectType === 'line';
  const hasObject = !!selectedObject;

  // Helper to safely get color as string (handles gradient objects)
  const getColorString = (value: any, fallback: string = '#000000'): string => {
    if (!value) return fallback;
    if (typeof value === 'string') return value;
    // If it's a gradient, try to get the first color stop
    if (value.colorStops && value.colorStops.length > 0) {
      return value.colorStops[0].color || fallback;
    }
    return fallback;
  };

  // Check if fill is a gradient
  const isGradientFill = object?.fill && typeof object.fill !== 'string';

  const handleColorChange = (property: string, color: string) => {
    if (!object || !fabricInstance) return;
    object.set(property, color);
    fabricInstance.getCanvas()?.requestRenderAll();
  };

  if (!hasObject) {
    return (
      <div className="p-4 text-center">
        <Palette className="h-10 w-10 text-muted-foreground/30 mx-auto mb-2" />
        <p className="text-xs text-muted-foreground">Select an element to edit colors</p>
      </div>
    );
  }

  const fillColor = getColorString(object.fill);
  const strokeColor = getColorString(object.stroke);

  return (
    <div className="p-4 space-y-4">
      <h3 className="text-xs font-semibold text-muted-foreground uppercase">Color Properties</h3>
      
      {/* Fill Color */}
      {(isText || isShape) && (
        <div className="space-y-2">
          <label className="text-xs font-medium flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-current" style={{ color: fillColor }} />
            Fill Color {isGradientFill && <span className="text-muted-foreground">(Gradient)</span>}
          </label>
          <ColorPicker
            value={fillColor}
            onChange={(color) => handleColorChange('fill', color)}
            showLabel={false}
          />
          {isGradientFill && (
            <p className="text-[10px] text-muted-foreground">Selecting a color will replace the gradient</p>
          )}
        </div>
      )}

      {/* Stroke Color */}
      {(isShape || isLine) && (
        <div className="space-y-2">
          <label className="text-xs font-medium flex items-center gap-2">
            <span className="w-3 h-3 rounded-full border-2 border-current" style={{ color: strokeColor }} />
            Stroke Color
          </label>
          <ColorPicker
            value={strokeColor}
            onChange={(color) => handleColorChange('stroke', color)}
            showLabel={false}
          />
          <div className="flex items-center gap-2">
            <label htmlFor="strokeWidth" className="text-xs text-muted-foreground">Width:</label>
            <input
              id="strokeWidth"
              type="number"
              value={object.strokeWidth || 1}
              onChange={(e) => {
                if (!object || !fabricInstance) return;
                object.set('strokeWidth', parseInt(e.target.value));
                fabricInstance.getCanvas()?.requestRenderAll();
              }}
              className="h-7 w-16 rounded border border-border px-2 text-xs"
              min="0"
              max="50"
            />
          </div>
        </div>
      )}

      {/* Text Background */}
      {isText && (
        <div className="space-y-2">
          <label className="text-xs font-medium">Text Background</label>
          <ColorPicker
            value={getColorString(object.backgroundColor, 'transparent')}
            onChange={(color) => handleColorChange('backgroundColor', color)}
            showLabel={false}
          />
        </div>
      )}

      {/* Premium gradient picker */}
      {isPremium && isShape && (
        <div className="pt-3 border-t border-border">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="h-3 w-3 text-amber-500" />
            <span className="text-xs font-medium text-amber-600 dark:text-amber-400">Premium Gradients</span>
          </div>
          <div className="grid grid-cols-4 gap-1">
            {[
              { gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', name: 'Purple', start: '#667eea', end: '#764ba2' },
              { gradient: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)', name: 'Pink', start: '#f093fb', end: '#f5576c' },
              { gradient: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)', name: 'Cyan', start: '#4facfe', end: '#00f2fe' },
              { gradient: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)', name: 'Green', start: '#43e97b', end: '#38f9d7' },
              { gradient: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)', name: 'Sunset', start: '#fa709a', end: '#fee140' },
              { gradient: 'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)', name: 'Pastel', start: '#a8edea', end: '#fed6e3' },
              { gradient: 'linear-gradient(135deg, #d299c2 0%, #fef9d7 100%)', name: 'Warm', start: '#d299c2', end: '#fef9d7' },
              { gradient: 'linear-gradient(135deg, #89f7fe 0%, #66a6ff 100%)', name: 'Sky', start: '#89f7fe', end: '#66a6ff' },
            ].map((item, i) => (
              <button
                key={i}
                title={`Apply ${item.name} gradient`}
                aria-label={`Apply ${item.name} gradient`}
                onClick={() => {
                  const gradientObj = new fabric.Gradient({
                    type: 'linear',
                    coords: { x1: 0, y1: 0, x2: object.width || 100, y2: object.height || 100 },
                    colorStops: [
                      { offset: 0, color: item.start },
                      { offset: 1, color: item.end }
                    ]
                  });
                  object.set('fill', gradientObj);
                  fabricInstance?.getCanvas()?.requestRenderAll();
                }}
                className="w-full aspect-square rounded border border-border hover:border-primary transition-colors"
                style={{ background: item.gradient }}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Effects Tab Content Component
interface EffectsTabContentProps {
  isImage: boolean;
  hasQRCode: boolean;
  selectedObject: fabric.Object | null;
  brightness: number;
  contrast: number;
  saturation: number;
  setBrightness: (v: number) => void;
  setContrast: (v: number) => void;
  setSaturation: (v: number) => void;
  onFlipHorizontal: () => void;
  onFlipVertical: () => void;
  onRotate: (degrees: number) => void;
  onApplyFilter: (filterIndex: number) => void;
  isPreviewMode: boolean;
}

function EffectsTabContent({
  isImage,
  hasQRCode,
  selectedObject,
  brightness,
  contrast,
  saturation,
  setBrightness,
  setContrast,
  setSaturation,
  onFlipHorizontal,
  onFlipVertical,
  onRotate,
  onApplyFilter,
  isPreviewMode,
}: EffectsTabContentProps) {
  if (!selectedObject) {
    return (
      <div className="p-4 text-center">
        <Sparkles className="h-10 w-10 text-muted-foreground/30 mx-auto mb-2" />
        <p className="text-xs text-muted-foreground">Select an element to apply effects</p>
      </div>
    );
  }

  if (!isImage) {
    return (
      <div className="p-4 text-center">
        <ImageIcon className="h-10 w-10 text-muted-foreground/30 mx-auto mb-2" />
        <p className="text-xs text-muted-foreground">Effects are only available for images</p>
      </div>
    );
  }

  if (hasQRCode) {
    return (
      <div className="p-4 text-center">
        <CircleOff className="h-10 w-10 text-muted-foreground/30 mx-auto mb-2" />
        <p className="text-xs text-muted-foreground">Effects cannot be applied to QR codes</p>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      {/* Transform Section */}
      <div>
        <h3 className="text-xs font-semibold text-muted-foreground uppercase mb-2">Transform</h3>
        <div className="flex gap-2">
          <button
            onClick={onFlipHorizontal}
            disabled={isPreviewMode}
            className="flex-1 flex items-center justify-center gap-1 py-2 rounded-lg border border-border hover:bg-muted transition-colors text-xs"
          >
            <FlipHorizontal className="h-3.5 w-3.5" />
            Flip H
          </button>
          <button
            onClick={onFlipVertical}
            disabled={isPreviewMode}
            className="flex-1 flex items-center justify-center gap-1 py-2 rounded-lg border border-border hover:bg-muted transition-colors text-xs"
          >
            <FlipVertical className="h-3.5 w-3.5" />
            Flip V
          </button>
        </div>
        <div className="flex gap-2 mt-2">
          <button
            onClick={() => onRotate(-90)}
            disabled={isPreviewMode}
            className="flex-1 flex items-center justify-center gap-1 py-2 rounded-lg border border-border hover:bg-muted transition-colors text-xs"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            -90°
          </button>
          <button
            onClick={() => onRotate(90)}
            disabled={isPreviewMode}
            className="flex-1 flex items-center justify-center gap-1 py-2 rounded-lg border border-border hover:bg-muted transition-colors text-xs"
          >
            <RotateCw className="h-3.5 w-3.5" />
            +90°
          </button>
        </div>
      </div>

      {/* Adjustments Section */}
      <div>
        <h3 className="text-xs font-semibold text-muted-foreground uppercase mb-2">Adjustments</h3>
        <div className="space-y-3">
          <div>
            <div className="flex items-center justify-between mb-1">
              <label htmlFor="brightness-slider" className="text-xs flex items-center gap-1">
                <Sun className="h-3 w-3" />
                Brightness
              </label>
              <span className="text-xs text-muted-foreground">{brightness}</span>
            </div>
            <input
              id="brightness-slider"
              type="range"
              min="-100"
              max="100"
              value={brightness}
              onChange={(e) => setBrightness(parseInt(e.target.value))}
              disabled={isPreviewMode}
              className="w-full h-1.5 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
            />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <label htmlFor="contrast-slider" className="text-xs flex items-center gap-1">
                <Contrast className="h-3 w-3" />
                Contrast
              </label>
              <span className="text-xs text-muted-foreground">{contrast}</span>
            </div>
            <input
              id="contrast-slider"
              type="range"
              min="-100"
              max="100"
              value={contrast}
              onChange={(e) => setContrast(parseInt(e.target.value))}
              disabled={isPreviewMode}
              className="w-full h-1.5 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
            />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <label htmlFor="saturation-slider" className="text-xs flex items-center gap-1">
                <Droplets className="h-3 w-3" />
                Saturation
              </label>
              <span className="text-xs text-muted-foreground">{saturation}</span>
            </div>
            <input
              id="saturation-slider"
              type="range"
              min="-100"
              max="100"
              value={saturation}
              onChange={(e) => setSaturation(parseInt(e.target.value))}
              disabled={isPreviewMode}
              className="w-full h-1.5 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
            />
          </div>
        </div>
      </div>

      {/* Filters Section */}
      <div>
        <h3 className="text-xs font-semibold text-muted-foreground uppercase mb-2">Filters</h3>
        <div className="grid grid-cols-2 gap-2">
          {IMAGE_FILTERS.map((filter, index) => (
            <button
              key={filter.name}
              onClick={() => onApplyFilter(index)}
              disabled={isPreviewMode}
              className="py-2 px-3 rounded-lg border border-border hover:bg-muted hover:border-primary/50 transition-colors text-xs"
            >
              {filter.name}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// Media Item Component
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
      <button
        onClick={onAdd}
        disabled={disabled}
        className="w-full aspect-square relative"
        title={`Add ${asset.name} to canvas`}
        aria-label={`Add ${asset.name} to canvas`}
      >
        <Image
          src={asset.url}
          alt={asset.name}
          fill
          className="object-cover"
          sizes="80px"
        />
      </button>

      {!isDeleting && (
        <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={onAdd}
            disabled={disabled}
            className="rounded-full bg-primary p-1.5 text-white hover:bg-primary/90"
            title={`Add ${asset.name} to canvas`}
            aria-label={`Add ${asset.name} to canvas`}
          >
            <Check className="h-3 w-3" />
          </button>
          <button
            onClick={onDelete}
            disabled={disabled}
            className="rounded-full bg-destructive p-1.5 text-white hover:bg-destructive/90"
            title={`Delete ${asset.name}`}
            aria-label={`Delete ${asset.name}`}
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      )}

      {isDeleting && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-black/80 p-2">
          <p className="text-[10px] text-white">Delete?</p>
          <div className="flex gap-1">
            <button onClick={onConfirmDelete} className="rounded bg-destructive px-2 py-0.5 text-[10px] text-white" title="Confirm delete">Yes</button>
            <button onClick={onCancelDelete} className="rounded bg-muted px-2 py-0.5 text-[10px]" title="Cancel delete">No</button>
          </div>
        </div>
      )}

      <div className="p-1 bg-background/80">
        <p className="text-[10px] truncate" title={asset.name}>{asset.name}</p>
      </div>
    </div>
  );
}
