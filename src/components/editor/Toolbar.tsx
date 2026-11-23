'use client';

import { useCallback, useState, useEffect, useRef } from 'react';
import { useFabricContext } from './FabricContext';
import { useEditorStore } from '@/store/editorStore';
import { useDataSourceStore } from '@/store/dataSourceStore';
import {
  Type,
  Image as ImageIcon,
  Square,
  Circle,
  Triangle,
  Minus,
  Trash2,
  Copy,
  Undo2,
  Redo2,
  ArrowUpToLine,
  ArrowDownToLine,
  Download,
  Upload,
  AlignHorizontalJustifyCenter,
  AlignLeft,
  AlignRight,
  AlignCenterHorizontal,
  AlignStartVertical,
  AlignEndVertical,
  AlignCenterVertical,
  FlipHorizontal,
  FlipVertical,
  RotateCcw,
  RotateCw,
  Lock,
  Unlock,
  Save,
  Wand2,
  Loader2,
  Database,
  Link2,
  Eye,
  EyeOff,
  Palette,
  BadgeCheck,
  Pentagon,
  Hexagon,
  ArrowRight,
  Diamond,
  Frame,
  MoreHorizontal,
  RectangleHorizontal,
  Info,
  Heart,
  Plus,
  Pencil,
  QrCode,
} from 'lucide-react';
import Link from 'next/link';
import { ColorPicker } from '@/components/ui/ColorPicker';
import { SerenityMark } from '@/components/brand/SerenityBrand';
import { ToolPanel, ToolPanelItem, ToolPanelDivider, ToolPanelSection } from './ToolPanel';
import { useAuth } from '@/contexts/AuthContext';
import { createQRCodeImage, findQRCodeImage, A4_LANDSCAPE } from '@/lib/fabric';
import { exportCanvasImage, QR_LOGICAL_SIZE, type EditorChromeCanvas } from '@/lib/fabric/exportQuality';
import {
  MAX_TEMPLATE_FILE_BYTES,
  TEMPLATE_OBJECT_PROPS,
  isProtectedTemplateObject,
  parseTemplateFile,
} from '@/lib/fabric/templateSerialization';
import { fabric } from 'fabric';
import { X } from 'lucide-react';

/** Everything Preview may change on an object, so Exit Preview restores it exactly. */
const PREVIEW_SNAPSHOT_KEYS = ['text', 'width', 'stroke', 'strokeWidth', 'strokeDashArray', 'selectable', 'evented', 'hoverCursor'] as const;
type PreviewSnapshot = Partial<Record<(typeof PREVIEW_SNAPSHOT_KEYS)[number], unknown>>;

type GenerateBlocker = 'loading' | 'preview' | 'no-data';
const GENERATE_HINTS: Record<GenerateBlocker, { message: string }> = {
  loading: { message: 'The template is still loading. Generate becomes available when it is on the canvas.' },
  preview: { message: 'Preview is on. Exit Preview to generate certificates.' },
  'no-data': { message: 'Import a spreadsheet (CSV, Excel or ODS) with one row per recipient to generate certificates.' },
};

interface ToolbarProps {
  onSave?: () => Promise<{ success: boolean; error?: string } | void>;
  saveStatus?: 'idle' | 'saving' | 'saved' | 'error';
  /** True until a requested template is fully on the canvas. */
  isTemplateLoading?: boolean;
  onGenerate?: () => void;
  /** Opens the panel where a spreadsheet is imported and fields are mapped. */
  onOpenData?: () => void;
  /** When the design on the canvas was last saved (ISO), if it has been. */
  lastSavedAt?: string | null;
  /** True after changes that have not been saved yet. */
  isDirty?: boolean;
  onPreview?: () => void;
  onOpenCertificateInfo?: () => void;
}

export function Toolbar({ onSave, saveStatus = 'idle', isTemplateLoading = false, onGenerate, onOpenData, lastSavedAt = null, isDirty = false, onPreview, onOpenCertificateInfo }: ToolbarProps) {
  const { fabricInstance } = useFabricContext();
  const { user } = useAuth();
  const isPremiumUser = user?.isPremium === true;
  const { 
    canUndo, canRedo, 
    selectedObject,
    templateName, setTemplateName,
    isPreviewMode,
    setPreviewMode,
    certificateMetadata,
  } = useEditorStore();
  
  // Only title and issuedBy are required - description is optional
  const isCertificateInfoComplete = certificateMetadata.title.trim() && 
    certificateMetadata.issuedBy.trim();
  
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [previewOriginalTexts, setPreviewOriginalTexts] = useState<Map<string, string>>(new Map());
  const previewSnapshotsRef = useRef<Map<object, PreviewSnapshot>>(new Map());
  const [canvasBackgroundColor, setCanvasBackgroundColor] = useState('#ffffff');
  const [borderColor, setBorderColor] = useState('#d4af37');
  const { rows, getPreviewRow, previewRowIndex } = useDataSourceStore();
  const generateBlocker: GenerateBlocker | null = isTemplateLoading ? 'loading' : isPreviewMode ? 'preview' : rows.length === 0 ? 'no-data' : null;
  const [generateHint, setGenerateHint] = useState<GenerateBlocker | null>(null);
  // The hint goes away once its reason does.
  useEffect(() => {
    if (generateHint && generateHint !== generateBlocker) setGenerateHint(null);
  }, [generateHint, generateBlocker]);

  // Sync canvas background color with fabric instance (including after undo/redo)
  useEffect(() => {
    if (fabricInstance) {
      const currentBg = fabricInstance.getBackgroundColor?.() || '#ffffff';
      setCanvasBackgroundColor(currentBg);
    }
  }, [fabricInstance, canUndo, canRedo]); // Re-sync when undo/redo state changes

  useEffect(() => {
    if (!isPreviewMode || !fabricInstance) return;
    
    const canvas = fabricInstance.getCanvas();
    if (!canvas) return;
    
    const previewRow = getPreviewRow();
    if (!previewRow) return;
    
    const objects = canvas.getObjects();
    
    objects.forEach((obj: any, index: number) => {
      // Skip verification URL objects - they are handled separately and should keep their preview URL
      if (obj.isVerificationUrl) return;
      
      const objId = `obj_${index}`;
      const originalText = previewOriginalTexts.get(objId);
      const objType = obj.type?.toLowerCase() || '';
      const isTextObj = objType === 'textbox' || objType === 'variabletextbox' || objType === 'i-text';
      
      if (isTextObj && obj.dynamicKey && originalText !== undefined) {
        if (previewRow[obj.dynamicKey] !== undefined) {
          obj.set('text', String(previewRow[obj.dynamicKey]));
        }
      }
      else if (isTextObj && originalText !== undefined && originalText.includes('{{')) {
        let newText = originalText;
        Object.entries(previewRow).forEach(([dataKey, dataValue]) => {
          const regex = new RegExp(`\\{\\{${dataKey}\\}\\}`, 'gi');
          newText = newText.replace(regex, String(dataValue || ''));
        });
        obj.set('text', newText);
      }
    });
    
    canvas.requestRenderAll();
  }, [previewRowIndex, isPreviewMode, fabricInstance, getPreviewRow, previewOriginalTexts]);

  const handleBackgroundColorChange = useCallback((color: string) => {
    setCanvasBackgroundColor(color);
    fabricInstance?.setBackgroundColor?.(color);
  }, [fabricInstance]);

  const toggleRightSidebar = () => {
    if (window.matchMedia('(max-width: 1023px)').matches && onOpenData) {
      onOpenData();
      return;
    }
    const currentState = useEditorStore.getState().rightSidebarOpen;
    useEditorStore.getState().setRightSidebarOpen(!currentState);
  };

  // Refs to hold the latest handlers for keyboard shortcuts
  const handleUndoRef = useRef<() => void>();
  const handleRedoRef = useRef<() => void>();
  const handleDeleteRef = useRef<() => void>();
  const handleTogglePreviewRef = useRef<() => void>();
  const handleCloneRef = useRef<() => void>();

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const canvas = fabricInstance?.getCanvas();
      const activeObject = canvas?.getActiveObject() as { isEditing?: boolean } | undefined;
      const isNativeEditingTarget = !!target?.closest('input, textarea, select, [contenteditable="true"]');
      if (isNativeEditingTarget || activeObject?.isEditing) return;

      const key = e.key.toLowerCase();
      const hasCommandModifier = e.ctrlKey || e.metaKey;

      // Ctrl+S for Save
      if (hasCommandModifier && key === 's') {
        e.preventDefault();
        if (!isPreviewMode) onSave?.();
      }
      
      // Ctrl/Cmd+Z for undo; Shift+Z is redo on both platforms.
      if (hasCommandModifier && key === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          if (!isPreviewMode && canRedo) handleRedoRef.current?.();
        } else if (!isPreviewMode) {
          // Not gated on canUndo: a change made a moment ago is recorded
          // when undo runs (see useFabric's history flush).
          handleUndoRef.current?.();
        }
      }

      // Ctrl+Y for Redo
      if (hasCommandModifier && key === 'y') {
        e.preventDefault();
        if (!isPreviewMode && canRedo) handleRedoRef.current?.();
      }

      if (hasCommandModifier && key === 'q') {
        e.preventDefault();
        handleTogglePreviewRef.current?.();
      }

      // Ctrl+D for Duplicate
      if (hasCommandModifier && key === 'd') {
        e.preventDefault();
        if (!isPreviewMode && selectedObject) {
          handleCloneRef.current?.();
        }
      }

      // Arrow keys move the selection by 1 unit (Shift: 10), so placement
      // never depends on dragging. Locked objects stay put.
      if (!hasCommandModifier && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
        const selection = canvas?.getActiveObject();
        if (!isPreviewMode && canvas && selection && !selection.lockMovementX && !selection.lockMovementY
          && !useEditorStore.getState().isEditingText) {
          e.preventDefault();
          const step = e.shiftKey ? 10 : 1;
          const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0;
          const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0;
          selection.set({ left: (selection.left || 0) + dx, top: (selection.top || 0) + dy });
          selection.setCoords();
          canvas.requestRenderAll();
          canvas.fire('object:modified', { target: selection } as any);
        }
        return;
      }

      // Escape releases the selection.
      if (e.key === 'Escape' && canvas?.getActiveObject() && !useEditorStore.getState().isEditingText) {
        canvas.discardActiveObject();
        canvas.requestRenderAll();
        return;
      }

      // Del/Backspace for Delete
      if (e.key === 'Delete' || e.key === 'Backspace') {
        // Only if canvas is active and not editing text
        if (!isPreviewMode && fabricInstance && selectedObject && !useEditorStore.getState().isEditingText) {
          e.preventDefault();
          handleDeleteRef.current?.();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onSave, canUndo, canRedo, selectedObject, fabricInstance, isPreviewMode]);

  const togglePanel = (name: string) => {
    setOpenDropdown(openDropdown === name ? null : name);
  };

  const closePanels = () => setOpenDropdown(null);

  // Text variations
  const handleAddText = useCallback(() => {
    if (isPreviewMode) return;
    fabricInstance?.addText('Double-click to edit');
    closePanels();
  }, [fabricInstance, isPreviewMode]);

  const handleAddHeading = useCallback(() => {
    if (isPreviewMode) return;
    fabricInstance?.addText('Heading', {
      fontSize: 48,
      fontWeight: 'bold',
    });
    closePanels();
  }, [fabricInstance, isPreviewMode]);

  const handleAddSubheading = useCallback(() => {
    if (isPreviewMode) return;
    fabricInstance?.addText('Subheading', {
      fontSize: 32,
      fontWeight: '600',
    });
    closePanels();
  }, [fabricInstance, isPreviewMode]);

  // Add clickable link element
  const handleAddLink = useCallback(() => {
    if (isPreviewMode) return;
    const canvas = fabricInstance?.getCanvas();
    if (!canvas) return;

    const linkText = new (window as any).fabric.Textbox('https://example.com', {
      left: canvas.width! / 2,
      top: canvas.height! / 2,
      originX: 'center',
      originY: 'center',
      width: 200,
      fontSize: 12,
      fontFamily: 'Arial',
      fill: '#0066cc',
      textAlign: 'center',
      underline: true,
    });
    // Mark as clickable link
    (linkText as any).isClickableLink = true;
    
    canvas.add(linkText);
    canvas.setActiveObject(linkText);
    canvas.requestRenderAll();
    closePanels();
  }, [fabricInstance, isPreviewMode]);

  const handleAddImage = useCallback(() => {
    if (isPreviewMode) return;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        const dataUrl = event.target?.result as string;
        fabricInstance?.addImage(dataUrl);
      };
      reader.readAsDataURL(file);
    };
    input.click();
  }, [fabricInstance, isPreviewMode]);

  const handleAddShape = useCallback((type: 'rect' | 'circle' | 'triangle' | 'line' | 'star' | 'pentagon' | 'hexagon' | 'arrow' | 'dashedLine' | 'arrowLine' | 'roundedRect' | 'diamond' | 'ellipse' | 'heart' | 'cross') => {
    if (isPreviewMode) return;
    fabricInstance?.addShape(type);
    closePanels();
  }, [fabricInstance, isPreviewMode]);

  // Add QR Code
  const handleAddQRCode = useCallback(async () => {
    if (isPreviewMode) return;
    const canvas = fabricInstance?.getCanvas();
    if (!canvas) return;

    // Check if a QR code already exists
    const existingQR = findQRCodeImage(canvas);
    if (existingQR) {
      alert('A QR code already exists on the canvas. Only one QR code is allowed per certificate.');
      canvas.setActiveObject(existingQR);
      canvas.requestRenderAll();
      return;
    }

    // Create a placeholder QR code with a sample verification ID
    const placeholderVerificationId = 'sample-verification-id';
    try {
      // Created at the logical size the generator prints, so the editor shows
      // the QR at exactly the size it will appear on certificates.
      const qrImage = await createQRCodeImage(placeholderVerificationId, {
        size: QR_LOGICAL_SIZE,
      });
      
      // Position it in the bottom-right area of the canvas
      const canvasWidth = canvas.getWidth();
      const canvasHeight = canvas.getHeight();
      qrImage.set({
        left: canvasWidth - 80,
        top: canvasHeight - 80,
        scaleX: 0.5,
        scaleY: 0.5,
      });

      canvas.add(qrImage);
      canvas.setActiveObject(qrImage);
      canvas.requestRenderAll();
      fabricInstance?.recordHistory();
    } catch (error) {
      console.error('Failed to add QR code:', error);
      alert('Failed to add QR code. Please try again.');
    }
  }, [fabricInstance, isPreviewMode]);

  // Drawing mode
  const [isDrawingMode, setIsDrawingMode] = useState(false);
  const [brushColor, setBrushColor] = useState('#000000');
  const [brushWidth, setBrushWidth] = useState(3);

  const handleToggleDrawing = useCallback(() => {
    if (isPreviewMode) return;
    const newMode = !isDrawingMode;
    setIsDrawingMode(newMode);
    fabricInstance?.setDrawingMode(newMode);
    if (newMode) {
      fabricInstance?.setDrawingBrush({ color: brushColor, width: brushWidth });
    }
  }, [isPreviewMode, isDrawingMode, fabricInstance, brushColor, brushWidth]);

  useEffect(() => {
    if (isDrawingMode && fabricInstance) {
      fabricInstance.setDrawingBrush({ color: brushColor, width: brushWidth });
    }
  }, [brushColor, brushWidth, isDrawingMode, fabricInstance]);

  const handleAddBorder = useCallback((style: 'simple' | 'double' | 'ornate' | 'gold' | 'corner') => {
    if (isPreviewMode) return;
    fabricInstance?.addBorder?.(style, borderColor);
    closePanels();
  }, [fabricInstance, isPreviewMode, borderColor]);

  const handleUndo = useCallback(() => {
    fabricInstance?.undo();
  }, [fabricInstance]);

  handleUndoRef.current = handleUndo;

  const handleRedo = useCallback(() => {
    fabricInstance?.redo();
  }, [fabricInstance]);

  handleRedoRef.current = handleRedo;

  const handleClone = useCallback(() => {
    if (isPreviewMode) return;
    const canvas = fabricInstance?.getCanvas();
    const activeObject = canvas?.getActiveObject();

    if (activeObject) {
      // A certificate has exactly one verification link and at most one QR
      // code; copies of either would break saving and printing.
      const members = activeObject.type === 'activeSelection'
        ? (activeObject as fabric.ActiveSelection).getObjects()
        : [activeObject];
      if (members.every(isProtectedTemplateObject)) {
        alert('The verification link and QR code cannot be duplicated. A certificate has only one of each.');
        return;
      }

      // The full property list keeps links clickable, locks, and variable fields.
      activeObject.clone((cloned: any) => {
        if (cloned.type === 'activeSelection') {
          cloned.getObjects()
            .filter(isProtectedTemplateObject)
            .forEach((member: fabric.Object) => cloned.removeWithUpdate(member));
        }
        canvas?.discardActiveObject();
        cloned.set({
          left: (cloned.left ?? 0) + 20,
          top: (cloned.top ?? 0) + 20,
          evented: true,
        });
        
        if (cloned.type === 'activeSelection') {
          // active selection needs a reference to the canvas.
          cloned.canvas = canvas;
          cloned.forEachObject((obj: any) => {
            canvas?.add(obj);
          });
          cloned.setCoords();
        } else {
          canvas?.add(cloned);
        }
        
        canvas?.setActiveObject(cloned);
        canvas?.requestRenderAll();
        fabricInstance?.recordHistory();
      }, [...TEMPLATE_OBJECT_PROPS]);
    }
  }, [fabricInstance, isPreviewMode]);

  const handleDelete = useCallback(() => {
    if (isPreviewMode) return;
    
    const canvas = fabricInstance?.getCanvas();
    const activeObjects = canvas?.getActiveObjects();
    
    if (activeObjects && activeObjects.length > 0) {
      // Filter out verification URL objects and locked objects - they cannot be deleted
      const deletableObjects = activeObjects.filter((obj: any) => !obj.isVerificationUrl && !obj.isLocked);
      
      if (deletableObjects.length === 0) {
        // All selected objects are verification URLs or locked
        alert('Cannot delete: the selected element(s) are locked or required (Verification URL).');
        return;
      }
      
      if (deletableObjects.length !== activeObjects.length) {
        // Some objects were filtered out
        alert('Note: Locked elements and the Verification URL tag were skipped.');
      }
      
      canvas?.discardActiveObject();
      deletableObjects.forEach((obj) => {
        canvas?.remove(obj);
      });
      fabricInstance?.recordHistory();
    }
  }, [fabricInstance, isPreviewMode]);

  handleDeleteRef.current = handleDelete;
  handleCloneRef.current = handleClone;

  // Toggle preview mode
  const handleTogglePreview = useCallback(() => {
    const newPreviewState = !isPreviewMode;
    const canvas = fabricInstance?.getCanvas();
    
    if (!canvas) {
      setPreviewMode(newPreviewState);
      return;
    }
    
    if (newPreviewState) {
      // Entering preview mode - store original texts and replace with preview data
      const previewRow = getPreviewRow();
      const originalTexts = new Map<string, string>();
      const objects = canvas.getObjects();
      const snapshots = new Map<object, PreviewSnapshot>();
      
      objects.forEach((obj: any, index: number) => {
        snapshots.set(obj, Object.fromEntries(PREVIEW_SNAPSHOT_KEYS.filter((key) => obj[key] !== undefined).map((key) => [key, obj[key]])));
        const objId = `obj_${index}`;
        const objType = obj.type?.toLowerCase() || '';
        const isTextObj = objType === 'textbox' || objType === 'variabletextbox' || objType === 'i-text';
        
        // Store original texts for variable textboxes (with dynamicKey property)
        if (isTextObj && obj.dynamicKey) {
          originalTexts.set(objId, obj.text || '');
          
          // Replace with preview data if available
          if (previewRow && previewRow[obj.dynamicKey] !== undefined) {
            obj.set('text', String(previewRow[obj.dynamicKey]));
          }
        }
        // Also check for textboxes with {{placeholder}} pattern but no dynamicKey (manually typed)
        else if (isTextObj && typeof obj.text === 'string' && obj.text.includes('{{')) {
          originalTexts.set(objId, obj.text || '');
          
          // Replace all {{key}} patterns with preview data
          if (previewRow) {
            let newText = obj.text;
            Object.entries(previewRow).forEach(([dataKey, dataValue]) => {
              const regex = new RegExp(`\\{\\{${dataKey}\\}\\}`, 'gi');
              newText = newText.replace(regex, String(dataValue || ''));
            });
            if (newText !== obj.text) {
              obj.set('text', newText);
            }
          }
        }
        
        // Handle verification URL placeholder
        if (obj.isVerificationUrl) {
          originalTexts.set(`verify_${index}`, obj.text || '');
          obj.set('text', `${window.location.origin}/verify/preview-id`);
        }
        
        // Disable selection for all non-boundary elements in preview mode
        if (!obj.isBoundary && !obj.isOuterShade && !obj.isInnerClear) {
          obj.selectable = false;
          obj.evented = false;
        }
      });
      
      previewSnapshotsRef.current = snapshots;
      setPreviewOriginalTexts(originalTexts);
      canvas.discardActiveObject();
      canvas.selection = false;
    } else {
      // Exiting preview mode - put every object back exactly as it was,
      // so previewing never changes what is saved or printed.
      const snapshots = previewSnapshotsRef.current;
      canvas.getObjects().forEach((obj: any) => {
        const snapshot = snapshots.get(obj);
        if (!snapshot) return;
        obj.set(snapshot);
        obj.initDimensions?.();
        obj.setCoords();
        obj.dirty = true;
      });
      
      previewSnapshotsRef.current = new Map();
      canvas.selection = true;
      setPreviewOriginalTexts(new Map());
    }
    
    // Placeholder frames and badges are editing aids; Preview shows the print.
    (canvas as typeof canvas & EditorChromeCanvas).hideEditorChrome = newPreviewState;
    canvas.requestRenderAll();
    setPreviewMode(newPreviewState);
  }, [isPreviewMode, setPreviewMode, fabricInstance, getPreviewRow]);

  // Update ref for keyboard shortcut
  handleTogglePreviewRef.current = handleTogglePreview;

  const handleAlign = useCallback((align: string) => {
    if (isPreviewMode) return;
    const canvas = fabricInstance?.getCanvas();
    if (!canvas) return;

    const activeObject = canvas.getActiveObject();
    if (!activeObject) return;

    const width = canvas.width || 800;
    const height = canvas.height || 600;

    switch (align) {
      case 'left':
        activeObject.set({ left: 0 });
        break;
      case 'center':
        activeObject.centerH();
        break;
      case 'right':
        activeObject.set({ left: width - activeObject.getScaledWidth() });
        break;
      case 'top':
        activeObject.set({ top: 0 });
        break;
      case 'middle':
        activeObject.centerV();
        break;
      case 'bottom':
        activeObject.set({ top: height - activeObject.getScaledHeight() });
        break;
    }
    
    activeObject.setCoords();
    canvas.requestRenderAll();
    closePanels();
  }, [fabricInstance, isPreviewMode]);

  const handleBringToFront = useCallback(() => {
    const canvas = fabricInstance?.getCanvas();
    const activeObject = canvas?.getActiveObject();
    if (activeObject) {
      activeObject.bringToFront();
      canvas?.requestRenderAll();
      fabricInstance?.recordHistory();
    }
  }, [fabricInstance]);

  const handleSendToBack = useCallback(() => {
    const canvas = fabricInstance?.getCanvas();
    const activeObject = canvas?.getActiveObject();
    if (!canvas || !activeObject) return;

    // Get the index of the topmost helper element (innerClear, outerShade, boundary)
    const objects = canvas.getObjects();
    let minNonHelperIndex = 0;
    for (let i = 0; i < objects.length; i++) {
      const obj = objects[i] as any;
      if (obj.isInnerClear || obj.isOuterShade || obj.isBoundary) {
        minNonHelperIndex = i + 1;
      }
    }

    // Send to back but keep above helper elements
    activeObject.sendToBack();
    
    // Move back above helper elements
    const currentIndex = objects.indexOf(activeObject);
    if (currentIndex < minNonHelperIndex) {
      canvas.moveTo(activeObject, minNonHelperIndex);
    }
    
    canvas.requestRenderAll();
    fabricInstance?.recordHistory();
  }, [fabricInstance]);

   const handleFlipHorizontal = useCallback(() => {
    const canvas = fabricInstance?.getCanvas();
    const activeObject = canvas?.getActiveObject();
    if (activeObject) {
      activeObject.set('flipX', !activeObject.flipX);
      canvas?.requestRenderAll();
      fabricInstance?.recordHistory();
    }
  }, [fabricInstance]);

  const handleFlipVertical = useCallback(() => {
     const canvas = fabricInstance?.getCanvas();
    const activeObject = canvas?.getActiveObject();
    if (activeObject) {
      activeObject.set('flipY', !activeObject.flipY);
      canvas?.requestRenderAll();
      fabricInstance?.recordHistory();
    }
  }, [fabricInstance]);

  const handleRotate = useCallback((angle: number) => {
     const canvas = fabricInstance?.getCanvas();
    const activeObject = canvas?.getActiveObject();
    if (activeObject) {
      activeObject.rotate((activeObject.angle || 0) + angle);
      canvas?.requestRenderAll();
      fabricInstance?.recordHistory();
    }
  }, [fabricInstance]);

  const handleToggleLock = useCallback(() => {
    const canvas = fabricInstance?.getCanvas();
    const activeObject = canvas?.getActiveObject();
    if (activeObject) {
      const isLocked = activeObject.lockMovementX;
      activeObject.set({
        lockMovementX: !isLocked,
        lockMovementY: !isLocked,
        lockRotation: !isLocked,
        lockScalingX: !isLocked,
        lockScalingY: !isLocked,
        hasControls: isLocked, // Show controls when unlocking, hide when locking
        editable: isLocked, // Allow text editing when unlocking
        selectable: true, // Keep selectable so user can unlock later
        hoverCursor: !isLocked ? 'not-allowed' : 'move',
        isLocked: !isLocked, // Custom property for serialization
      } as any);

      // Visual lock indicator - outline style
      if (!isLocked) {
        // Locking - add visual indicator
        activeObject.set({
          borderColor: '#ef4444',
          borderDashArray: [6, 3],
          cornerColor: '#ef4444',
          transparentCorners: true,
        });
      } else {
        // Unlocking - restore normal style
        activeObject.set({
          borderColor: '#3b82f6',
          borderDashArray: undefined,
          cornerColor: '#3b82f6',
          transparentCorners: false,
          hasControls: true,
        });
      }

      canvas?.discardActiveObject(); // Deselect to visually update handles
      canvas?.requestRenderAll();
      // Trigger object:modified to save to history
      canvas?.fire('object:modified', { target: activeObject } as any);
    }
  }, [fabricInstance]);

  // Export as JSON. Uses the same serializer as Save, so the file keeps the
  // protected verification link, clickable links, locks, and variable fields.
  // Disabled in Preview, where the canvas shows a recipient's values.
  const handleExport = useCallback(() => {
    if (isPreviewMode) return;
    const json = fabricInstance?.toJSON();
    if (!json) return;

    const blob = new Blob([JSON.stringify(json)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${templateName || 'template'}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
    closePanels();
  }, [fabricInstance, templateName, isPreviewMode]);

  // Import JSON. The file is checked before the canvas changes, so a broken
  // or unsupported file never replaces the design on screen.
  const handleImport = useCallback(() => {
    if (isPreviewMode || isTemplateLoading || !fabricInstance) return;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      if (file.size > MAX_TEMPLATE_FILE_BYTES) {
        alert('This file is larger than 10 MB, so it cannot be imported as a template.');
        return;
      }

      let text: string;
      try {
        text = await file.text();
      } catch {
        alert('This file could not be read.');
        return;
      }

      const result = parseTemplateFile(text, {
        isKnownType: (type) => !!(fabric.util as unknown as { getKlass: (type: string) => unknown }).getKlass(type),
      });
      if (!result.ok) {
        alert(`${result.error} Your current design was not changed.`);
        return;
      }

      if (!window.confirm(`Replace the current design with "${file.name}"? Undo cannot bring back the current design.`)) {
        return;
      }

      try {
        await fabricInstance.loadFromJSON(result.template);
      } catch (error) {
        console.error('[Toolbar] Template import failed', error);
        alert('This template could not be opened.');
        return;
      }
      useEditorStore.getState().setIsDirty(true);
      if (result.repairs.length > 0) alert(`Template imported. ${result.repairs.join(' ')}`);
    };
    input.click();
    closePanels();
  }, [fabricInstance, isPreviewMode, isTemplateLoading]);

  // Export as image
  const handleExportImage = useCallback(() => {
    const canvas = fabricInstance?.getCanvas();
    if (!canvas) return;

    const dataUrl = exportCanvasImage(canvas, {
      format: 'png',
      multiplier: 2,
      width: A4_LANDSCAPE.width,
      height: A4_LANDSCAPE.height,
    });

    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `${templateName || 'certificate'}.png`;
    a.click();
    closePanels();
  }, [fabricInstance, templateName]);

  const isObjectSelected = !!selectedObject;
  const isLocked = selectedObject?.lockMovementX;
  const isVerificationSelected = selectedObject && (selectedObject as any).isVerificationUrl;

  return (
    <div className={`flex flex-col ${isPreviewMode ? 'bg-warning/10' : ''}`}>
      {/* Primary Toolbar Row - Always visible */}
      <div className="toolbar studio-documentbar border-b border-border" role="group" aria-label="Document actions">
        {/* Preview Mode Indicator */}
        {isPreviewMode && (
          <div className="flex items-center gap-1 mr-2 px-2 py-0.5 bg-warning/20 rounded-full flex-shrink-0">
            <Eye className="h-3 w-3 text-warning" />
            <span className="text-xs font-semibold text-warning hidden sm:inline">Preview</span>
          </div>
        )}
        
        {/* Home Button */}
        <Link href="/dashboard" className="toolbar-button flex-shrink-0" title="Back to Dashboard" aria-label="Back to Dashboard">
          <SerenityMark className="h-7 w-7 sm:h-8 sm:w-8" />
        </Link>
        
        {/* Template Name Input: fixed width so it never collapses under the
            tools on narrow screens; the toolbar row scrolls instead. */}
        <div className="flex flex-shrink-0 items-center gap-2 mx-1 sm:mx-2">
           <input 
             type="text" 
             value={templateName} 
             onChange={(e) => setTemplateName(e.target.value)}
             disabled={isPreviewMode}
             aria-label="Template name"
             className="h-5 sm:h-6 w-24 sm:w-48 rounded border-transparent bg-transparent px-1 text-xs sm:text-sm font-semibold hover:border-border hover:bg-muted focus:border-primary focus:bg-background focus:outline-none disabled:opacity-50"
             placeholder="Untitled"
           />
           {isPremiumUser && !isPreviewMode && (
             <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-warning/15 text-warning text-[10px] font-semibold whitespace-nowrap" title="Premium features enabled">
               <BadgeCheck className="h-3 w-3" />
               PRO
             </span>
           )}
        </div>

        <div className="toolbar-divider" />

        {/* Spacer */}
        <div className="flex-1 min-w-2" />

        {/* Action Buttons */}
        <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
           <button
             onClick={handleTogglePreview}
             title={isPreviewMode ? "Exit Preview" : "Preview"}
             aria-label={isPreviewMode ? "Exit Preview" : "Preview"}
             className={`toolbar-button studio-command ${isPreviewMode ? 'bg-muted text-primary' : ''}`}
           >
              {isPreviewMode ? <EyeOff /> : <Eye />}<span>{isPreviewMode ? "Exit Preview" : "Preview"}</span>
           </button>

           <button onClick={toggleRightSidebar} className="toolbar-button studio-command" aria-label="Data Source" title="Data Source">
              <Database /><span>Data</span>
           </button>

           <button
             onClick={onOpenCertificateInfo}
             className="toolbar-button studio-command relative"
             aria-label="Certificate Info" title="Certificate Info"
           >
              <Info /><span>Certificate Info</span>
              {!isCertificateInfoComplete && (
                <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-warning border border-background" />
              )}
           </button>

           <span className="hidden md:inline whitespace-nowrap text-[11px] text-muted-foreground" aria-live="polite">
             {isDirty ? 'Unsaved changes' : lastSavedAt ? `Saved ${new Date(lastSavedAt).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}` : ''}
           </span>
           <button
             onClick={() => onSave?.()}
             aria-label="Save"
             title={isPreviewMode ? 'Turn off Preview to save' : isTemplateLoading ? 'Waiting for the template to load' : 'Save (Ctrl+S)'}
             disabled={saveStatus === 'saving' || isPreviewMode || isTemplateLoading}
             className="flex items-center gap-1 rounded-md border border-border bg-card px-2.5 py-1.5 text-xs font-semibold text-foreground hover:bg-muted disabled:opacity-50 flex-shrink-0"
           >
             {saveStatus === 'saving' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
             <span className="hidden sm:inline">Save</span>
           </button>

           {/* Not natively disabled: a disabled button cannot be focused or
               pressed, so keyboard and touch users never learned why. Pressing
               it while blocked says why and offers the fix. */}
           <button
             onClick={() => {
               if (!generateBlocker) {
                 setGenerateHint(null);
                 onGenerate?.();
               } else {
                 setGenerateHint(generateBlocker);
               }
             }}
             aria-disabled={generateBlocker ? true : undefined}
             aria-label="Generate"
             aria-describedby={generateHint ? 'generate-hint' : undefined}
             title={isTemplateLoading ? "Loading template…" : rows.length === 0 ? "Connect data source" : isPreviewMode ? "Turn off Preview to generate" : "Generate"}
             className={`flex items-center gap-1 rounded-md bg-primary px-2 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90 flex-shrink-0 ${generateBlocker ? 'opacity-50' : ''}`}
           >
             <Wand2 className="h-3.5 w-3.5" />
             <span className="studio-generate-label">Generate</span>
           </button>
           {generateHint && (
             <div
               id="generate-hint"
               role="status"
               className="fixed right-3 top-14 z-50 flex max-w-xs items-start gap-3 rounded-lg border border-border bg-card p-3 text-xs shadow-lg"
             >
               <span className="flex-1">{GENERATE_HINTS[generateHint].message}</span>
               {generateHint === 'no-data' && onOpenData && (
                 <button type="button" onClick={() => { setGenerateHint(null); onOpenData(); }} className="shrink-0 font-semibold text-primary hover:underline">
                   Import spreadsheet
                 </button>
               )}
               {generateHint === 'preview' && (
                 <button type="button" onClick={() => { setGenerateHint(null); handleTogglePreviewRef.current?.(); }} className="shrink-0 font-semibold text-primary hover:underline">
                   Exit Preview
                 </button>
               )}
               <button type="button" aria-label="Dismiss" onClick={() => setGenerateHint(null)} className="shrink-0 text-muted-foreground hover:text-foreground">
                 <X className="h-3.5 w-3.5" />
               </button>
             </div>
           )}

           <button
             onClick={() => togglePanel('export')}
             className={`toolbar-button ${openDropdown === 'export' ? 'bg-primary/10 text-primary' : ''}`}
             title="Export / Import"
           >
             <Download />
           </button>
        </div>
      </div>

      {/* Secondary Toolbar Row - Additional tools */}
      <div className="toolbar studio-toolrail border-b border-border" role="group" aria-label="Design tools">
        {/* Core Tools - Always visible */}
        <button
          onClick={() => togglePanel('text')}
          className={`toolbar-button ${openDropdown === 'text' ? 'bg-primary/10 text-primary' : ''}`}
          title="Add Text"
          disabled={isPreviewMode}
        >
          <Type />
        </button>

        <button onClick={handleAddImage} className="toolbar-button" title="Add Image" disabled={isPreviewMode}>
          <ImageIcon />
        </button>

        <button onClick={handleAddQRCode} className="toolbar-button" title="Add QR Code (for verification)" disabled={isPreviewMode}>
          <QrCode />
        </button>

        <button
          onClick={() => togglePanel('shapes')}
          className={`toolbar-button ${openDropdown === 'shapes' ? 'bg-primary/10 text-primary' : ''}`}
          title="Add Shape"
          disabled={isPreviewMode}
        >
          <Square />
        </button>

        <button
          onClick={handleToggleDrawing}
          className={`toolbar-button ${isDrawingMode ? 'bg-primary/10 text-primary ring-2 ring-primary/40' : ''}`}
          title={isDrawingMode ? 'Exit Drawing Mode' : 'Freehand Draw'}
          disabled={isPreviewMode}
        >
          <Pencil />
        </button>

        <div className="toolbar-divider" />

        {/* History */}
        <button onClick={handleUndo} className="toolbar-button" title="Undo" disabled={!canUndo || isPreviewMode}>
          <Undo2 />
        </button>
        <button onClick={handleRedo} className="toolbar-button" title="Redo" disabled={!canRedo || isPreviewMode}>
          <Redo2 />
        </button>

        <div className="toolbar-divider" />

        {/* Object Operations */}
        <button onClick={handleClone} className="toolbar-button" title="Duplicate" disabled={!isObjectSelected || isPreviewMode}>
          <Copy />
        </button>
        <button
          onClick={handleDelete}
          className={`toolbar-button ${isVerificationSelected ? 'opacity-30' : ''}`}
          title="Delete"
          disabled={!isObjectSelected || isPreviewMode}
        >
          <Trash2 />
        </button>
        <button
          onClick={handleToggleLock}
          className={`toolbar-button ${isLocked ? 'bg-error/20 text-error' : ''}`}
          title={isLocked ? 'Unlock Element' : 'Lock Element'}
          disabled={!isObjectSelected || isPreviewMode}
        >
          {isLocked ? <Unlock /> : <Lock />}
        </button>

        <div className="toolbar-divider" />
        {/* Link */}
        <button onClick={handleAddLink} className="toolbar-button" title="Add Link" disabled={isPreviewMode}>
          <Link2 />
        </button>

        {/* Borders */}
        <button
          onClick={() => togglePanel('borders')}
          className={`toolbar-button ${openDropdown === 'borders' ? 'bg-primary/10 text-primary' : ''}`}
          title="Borders"
          disabled={isPreviewMode}
        >
          <Frame />
        </button>

        {/* Background Color */}
        <div className="flex items-center" title="Background Color">
          <ColorPicker
            value={canvasBackgroundColor}
            onChange={handleBackgroundColorChange}
            showLabel={false}
            size="sm"
          />
        </div>

        <div className="toolbar-divider" />

        {/* Alignment */}
        <button
          onClick={() => togglePanel('align')}
          className={`toolbar-button ${openDropdown === 'align' ? 'bg-primary/10 text-primary' : ''}`}
          title="Alignment"
          disabled={!isObjectSelected}
        >
          <AlignHorizontalJustifyCenter />
        </button>

        {/* Layer Operations */}
        <button onClick={handleBringToFront} className="toolbar-button" title="Bring to Front" disabled={!isObjectSelected}>
          <ArrowUpToLine />
        </button>
        <button onClick={handleSendToBack} className="toolbar-button" title="Send to Back" disabled={!isObjectSelected}>
          <ArrowDownToLine />
        </button>

        <div className="toolbar-divider" />

        {/* Transform */}
        <button
          onClick={() => togglePanel('transform')}
          className={`toolbar-button ${openDropdown === 'transform' ? 'bg-primary/10 text-primary' : ''}`}
          title="Transform"
          disabled={!isObjectSelected}
        >
          <FlipHorizontal />
        </button>
      </div>

      {/* Tool Panels (sidebar replacements for dropdown menus) */}
      <ToolPanel title="Text" isOpen={openDropdown === 'text'} onClose={closePanels}>
        <ToolPanelItem icon={Type} label="Heading" onClick={handleAddHeading} disabled={isPreviewMode} />
        <ToolPanelItem icon={Type} label="Subheading" onClick={handleAddSubheading} disabled={isPreviewMode} />
        <ToolPanelItem icon={Type} label="Body Text" onClick={handleAddText} disabled={isPreviewMode} />
      </ToolPanel>

      <ToolPanel title="Shapes" isOpen={openDropdown === 'shapes'} onClose={closePanels}>
        <ToolPanelSection title="Basic Shapes" />
        <ToolPanelItem icon={Square} label="Rectangle" onClick={() => handleAddShape('rect')} disabled={isPreviewMode} />
        <ToolPanelItem icon={RectangleHorizontal} label="Rounded Rect" onClick={() => handleAddShape('roundedRect')} disabled={isPreviewMode} />
        <ToolPanelItem icon={Circle} label="Circle" onClick={() => handleAddShape('circle')} disabled={isPreviewMode} />
        <ToolPanelItem icon={Triangle} label="Triangle" onClick={() => handleAddShape('triangle')} disabled={isPreviewMode} />
        <ToolPanelItem icon={Pentagon} label="Pentagon" onClick={() => handleAddShape('pentagon')} disabled={isPreviewMode} />
        <ToolPanelItem icon={Hexagon} label="Hexagon" onClick={() => handleAddShape('hexagon')} disabled={isPreviewMode} />
        <ToolPanelItem icon={Diamond} label="Diamond" onClick={() => handleAddShape('diamond')} disabled={isPreviewMode} />
        <ToolPanelItem icon={Circle} label="Ellipse" onClick={() => handleAddShape('ellipse')} disabled={isPreviewMode} />
        <ToolPanelItem icon={Heart} label="Heart" onClick={() => handleAddShape('heart')} disabled={isPreviewMode} />
        <ToolPanelItem icon={Plus} label="Cross" onClick={() => handleAddShape('cross')} disabled={isPreviewMode} />
        <ToolPanelDivider />
        <ToolPanelSection title="Premium Shapes" />
        <ToolPanelItem icon={Diamond} label="Gold Diamond" onClick={() => handleAddShape('diamond')} disabled={isPreviewMode} premium isPremiumUser={isPremiumUser} />
        <ToolPanelItem icon={Hexagon} label="Gold Hexagon" onClick={() => handleAddShape('hexagon')} disabled={isPreviewMode} premium isPremiumUser={isPremiumUser} />
        <ToolPanelDivider />
        <ToolPanelSection title="Lines" />
        <ToolPanelItem icon={Minus} label="Line" onClick={() => handleAddShape('line')} disabled={isPreviewMode} />
        <ToolPanelItem icon={Minus} label="Dashed Line" onClick={() => handleAddShape('dashedLine')} disabled={isPreviewMode} />
        <ToolPanelItem icon={ArrowRight} label="Arrow" onClick={() => handleAddShape('arrowLine')} disabled={isPreviewMode} />
      </ToolPanel>

      <ToolPanel title="Borders" isOpen={openDropdown === 'borders'} onClose={closePanels}>
        <div className="px-3 py-2 flex items-center gap-2 border-b border-border mb-1">
          <span className="text-xs text-muted-foreground">Color:</span>
          <ColorPicker value={borderColor} onChange={setBorderColor} showLabel={false} size="sm" />
        </div>
        <ToolPanelItem icon={Square} label="Simple" onClick={() => handleAddBorder('simple')} disabled={isPreviewMode} />
        <ToolPanelItem icon={Square} label="Double" onClick={() => handleAddBorder('double')} disabled={isPreviewMode} />
        <ToolPanelItem icon={Square} label="Ornate" onClick={() => handleAddBorder('ornate')} disabled={isPreviewMode} />
        <ToolPanelItem icon={Square} label="Gold Frame" onClick={() => handleAddBorder('gold')} disabled={isPreviewMode} />
        <ToolPanelDivider />
        <ToolPanelSection title="Premium Borders" />
        <ToolPanelItem icon={Square} label="Ornate Gold" onClick={() => handleAddBorder('ornate')} disabled={isPreviewMode} premium isPremiumUser={isPremiumUser} />
        <ToolPanelItem icon={Square} label="Corner Frame" onClick={() => handleAddBorder('corner')} disabled={isPreviewMode} premium isPremiumUser={isPremiumUser} />
      </ToolPanel>

      <ToolPanel title="Alignment" isOpen={openDropdown === 'align'} onClose={closePanels}>
        <ToolPanelSection title="Horizontal" />
        <ToolPanelItem icon={AlignLeft} label="Align Left" onClick={() => handleAlign('left')} disabled={!isObjectSelected} />
        <ToolPanelItem icon={AlignCenterHorizontal} label="Center Horizontal" onClick={() => handleAlign('center')} disabled={!isObjectSelected} />
        <ToolPanelItem icon={AlignRight} label="Align Right" onClick={() => handleAlign('right')} disabled={!isObjectSelected} />
        <ToolPanelDivider />
        <ToolPanelSection title="Vertical" />
        <ToolPanelItem icon={AlignStartVertical} label="Align Top" onClick={() => handleAlign('top')} disabled={!isObjectSelected} />
        <ToolPanelItem icon={AlignCenterVertical} label="Center Vertical" onClick={() => handleAlign('middle')} disabled={!isObjectSelected} />
        <ToolPanelItem icon={AlignEndVertical} label="Align Bottom" onClick={() => handleAlign('bottom')} disabled={!isObjectSelected} />
      </ToolPanel>

      <ToolPanel title="Transform" isOpen={openDropdown === 'transform'} onClose={closePanels}>
        <ToolPanelItem icon={FlipHorizontal} label="Flip Horizontal" onClick={handleFlipHorizontal} disabled={!isObjectSelected} />
        <ToolPanelItem icon={FlipVertical} label="Flip Vertical" onClick={handleFlipVertical} disabled={!isObjectSelected} />
        <ToolPanelDivider />
        <ToolPanelItem icon={RotateCcw} label="Rotate -90°" onClick={() => handleRotate(-90)} disabled={!isObjectSelected} />
        <ToolPanelItem icon={RotateCw} label="Rotate +90°" onClick={() => handleRotate(90)} disabled={!isObjectSelected} />
        <ToolPanelDivider />
        <ToolPanelItem 
          icon={isLocked ? Unlock : Lock} 
          label={isLocked ? "Unlock" : "Lock"} 
          onClick={handleToggleLock} 
          disabled={!isObjectSelected}
        />
      </ToolPanel>

      <ToolPanel title="Export / Import" isOpen={openDropdown === 'export'} onClose={closePanels}>
        <ToolPanelItem icon={Download} label="Export JSON" onClick={handleExport} disabled={isPreviewMode} />
        <ToolPanelItem icon={ImageIcon} label="Export PNG" onClick={handleExportImage} />
        <ToolPanelDivider />
        <ToolPanelItem icon={Upload} label="Import JSON" onClick={handleImport} disabled={isPreviewMode || isTemplateLoading} />
      </ToolPanel>

      {/* Drawing mode floating controls */}
      {isDrawingMode && (
        <div className="fixed left-4 top-40 z-50 w-48 rounded-xl border border-border bg-card p-3 shadow-xl space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-foreground">Drawing Mode</span>
            <button onClick={handleToggleDrawing} className="text-xs text-muted-foreground hover:text-foreground">✕</button>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Brush Color</label>
            <ColorPicker value={brushColor} onChange={setBrushColor} showLabel={false} size="sm" />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Brush Size: {brushWidth}px</label>
            <input
              type="range" min="1" max="30" value={brushWidth}
              onChange={(e) => setBrushWidth(parseInt(e.target.value))}
              className="w-full"
            />
          </div>
        </div>
      )}
    </div>
  );
}
