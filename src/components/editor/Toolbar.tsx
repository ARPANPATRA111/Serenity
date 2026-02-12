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
  ChevronLeft,
  Link2,
  Eye,
  EyeOff,
  Palette,
  Star,
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
  Check,
} from 'lucide-react';
import Link from 'next/link';
import { ColorPicker } from '@/components/ui/ColorPicker';
import { ToolPanel, ToolPanelItem, ToolPanelDivider, ToolPanelSection } from './ToolPanel';

interface ToolbarProps {
  onSave?: () => Promise<void>;
  saveStatus?: 'idle' | 'saving' | 'saved' | 'error';
  onGenerate?: () => void;
  onPreview?: () => void;
  onOpenCertificateInfo?: () => void;
}

export function Toolbar({ onSave, saveStatus = 'idle', onGenerate, onPreview, onOpenCertificateInfo }: ToolbarProps) {
  const { fabricInstance } = useFabricContext();
  const { 
    canUndo, canRedo, 
    selectedObject,
    templateName, setTemplateName,
    pushHistory,
    isPreviewMode,
    setPreviewMode,
    certificateMetadata,
  } = useEditorStore();
  
  // Only title and issuedBy are required - description is optional
  const isCertificateInfoComplete = certificateMetadata.title.trim() && 
    certificateMetadata.issuedBy.trim();
  
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [previewOriginalTexts, setPreviewOriginalTexts] = useState<Map<string, string>>(new Map());
  const [canvasBackgroundColor, setCanvasBackgroundColor] = useState('#ffffff');
  const [borderColor, setBorderColor] = useState('#d4af37');
  const { rows, getPreviewRow, previewRowIndex } = useDataSourceStore();

  // Sync canvas background color with fabric instance
  useEffect(() => {
    if (fabricInstance) {
      const currentBg = fabricInstance.getBackgroundColor?.() || '#ffffff';
      setCanvasBackgroundColor(currentBg);
    }
  }, [fabricInstance]);

  useEffect(() => {
    if (!isPreviewMode || !fabricInstance) return;
    
    const canvas = fabricInstance.getCanvas();
    if (!canvas) return;
    
    const previewRow = getPreviewRow();
    if (!previewRow) return;
    
    const objects = canvas.getObjects();
    
    objects.forEach((obj: any, index: number) => {
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
      // Ctrl+S for Save
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (!isPreviewMode) onSave?.();
      }
      
      // Ctrl+Z for Undo
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        if (!isPreviewMode && canUndo) handleUndoRef.current?.();
      }

      // Ctrl+Y for Redo
      if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        e.preventDefault();
        if (!isPreviewMode && canRedo) handleRedoRef.current?.();
      }

      if ((e.ctrlKey || e.metaKey) && e.key === 'q') {
        e.preventDefault();
        handleTogglePreviewRef.current?.();
      }

      // Ctrl+D for Duplicate
      if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
        e.preventDefault();
        if (!isPreviewMode && selectedObject) {
          handleCloneRef.current?.();
        }
      }

      // Del/Backspace for Delete
      if (e.key === 'Delete' || e.key === 'Backspace') {
        // Only if canvas is active and not editing text
        if (!isPreviewMode && fabricInstance && selectedObject && !useEditorStore.getState().isEditingText) {
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
    const canvas = fabricInstance?.getCanvas();
    const activeObject = canvas?.getActiveObject();
    
    if (activeObject) {
      activeObject.clone((cloned: any) => {
        canvas?.discardActiveObject();
        cloned.set({
          left: activeObject.left! + 20,
          top: activeObject.top! + 20,
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
        pushHistory(JSON.stringify(canvas?.toJSON()));
      });
    }
  }, [fabricInstance, pushHistory]);

  const handleDelete = useCallback(() => {
    if (isPreviewMode) return;
    
    const canvas = fabricInstance?.getCanvas();
    const activeObjects = canvas?.getActiveObjects();
    
    if (activeObjects && activeObjects.length > 0) {
      // Filter out verification URL objects - they cannot be deleted
      const deletableObjects = activeObjects.filter((obj: any) => !obj.isVerificationUrl);
      
      if (deletableObjects.length === 0) {
        // All selected objects are verification URLs
        alert('The Verification URL tag cannot be deleted. It is required for certificate validation.');
        return;
      }
      
      if (deletableObjects.length !== activeObjects.length) {
        // Some objects were filtered out
        alert('Note: The Verification URL tag cannot be deleted and was skipped.');
      }
      
      canvas?.discardActiveObject();
      deletableObjects.forEach((obj) => {
        canvas?.remove(obj);
      });
      // Push history manually as automatic tracking might miss deletion in some cases
      pushHistory(JSON.stringify(canvas?.toJSON()));
    }
  }, [fabricInstance, pushHistory, isPreviewMode]);

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
      
      objects.forEach((obj: any, index: number) => {
        const objId = `obj_${index}`;
        const objType = obj.type?.toLowerCase() || '';
        const isTextObj = objType === 'textbox' || objType === 'variabletextbox' || objType === 'i-text';
        
        // Store original texts for variable textboxes (with dynamicKey property)
        if (isTextObj && obj.dynamicKey) {
          originalTexts.set(objId, obj.text || '');
          
          // Replace with preview data if available
          if (previewRow && previewRow[obj.dynamicKey] !== undefined) {
            obj.set('text', String(previewRow[obj.dynamicKey]));
            // Remove placeholder styling for preview
            obj.set({
              strokeWidth: 0,
              stroke: undefined,
              strokeDashArray: undefined,
            });
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
      
      setPreviewOriginalTexts(originalTexts);
      canvas.discardActiveObject();
      canvas.selection = false;
    } else {
      // Exiting preview mode - restore original texts
      const objects = canvas.getObjects();
      
      objects.forEach((obj: any, index: number) => {
        const objId = `obj_${index}`;
        const originalText = previewOriginalTexts.get(objId);
        const objType = obj.type?.toLowerCase() || '';
        const isTextObj = objType === 'textbox' || objType === 'variabletextbox' || objType === 'i-text';
        
        // Restore verification URL placeholder first (before general text handling)
        if (obj.isVerificationUrl) {
          const originalVerifyText = previewOriginalTexts.get(`verify_${index}`);
          if (originalVerifyText !== undefined) {
            obj.set('text', originalVerifyText);
            // Restore verification URL original styling (red border, no stroke)
            obj.set({
              borderColor: '#dc2626',
              borderDashArray: [4, 2],
              strokeWidth: 0,
              stroke: undefined,
              strokeDashArray: undefined,
            });
          }
        }
        else if (isTextObj && originalText !== undefined) {
          obj.set('text', originalText);
          // Restore placeholder styling if it was a placeholder
          if (obj.dynamicKey || originalText.includes('{{')) {
            obj.set({
              strokeWidth: 1,
              stroke: '#3b82f6',
              strokeDashArray: [4, 2],
            });
          }
        }
        
        // Re-enable selection for non-boundary elements
        if (!obj.isBoundary && !obj.isOuterShade && !obj.isInnerClear) {
          obj.selectable = true;
          obj.evented = true;
          obj.hoverCursor = 'move'; // Reset cursor
        }
      });
      
      canvas.selection = true;
      setPreviewOriginalTexts(new Map());
    }
    
    canvas.requestRenderAll();
    setPreviewMode(newPreviewState);
  }, [isPreviewMode, setPreviewMode, fabricInstance, getPreviewRow, previewOriginalTexts]);

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
      pushHistory(JSON.stringify(canvas?.toJSON()));
    }
  }, [fabricInstance, pushHistory]);

  const handleSendToBack = useCallback(() => {
    const canvas = fabricInstance?.getCanvas();
    const activeObject = canvas?.getActiveObject();
    if (activeObject) {
      activeObject.sendToBack();
      canvas?.requestRenderAll();
      pushHistory(JSON.stringify(canvas?.toJSON()));
    }
  }, [fabricInstance, pushHistory]);

   const handleFlipHorizontal = useCallback(() => {
    const canvas = fabricInstance?.getCanvas();
    const activeObject = canvas?.getActiveObject();
    if (activeObject) {
      activeObject.set('flipX', !activeObject.flipX);
      canvas?.requestRenderAll();
      pushHistory(JSON.stringify(canvas?.toJSON()));
    }
  }, [fabricInstance, pushHistory]);

  const handleFlipVertical = useCallback(() => {
     const canvas = fabricInstance?.getCanvas();
    const activeObject = canvas?.getActiveObject();
    if (activeObject) {
      activeObject.set('flipY', !activeObject.flipY);
      canvas?.requestRenderAll();
      pushHistory(JSON.stringify(canvas?.toJSON()));
    }
  }, [fabricInstance, pushHistory]);

  const handleRotate = useCallback((angle: number) => {
     const canvas = fabricInstance?.getCanvas();
    const activeObject = canvas?.getActiveObject();
    if (activeObject) {
      activeObject.rotate((activeObject.angle || 0) + angle);
      canvas?.requestRenderAll();
      pushHistory(JSON.stringify(canvas?.toJSON()));
    }
  }, [fabricInstance, pushHistory]);

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
      });
      canvas?.discardActiveObject(); // Deselect to visually update handles
      canvas?.requestRenderAll();
    }
  }, [fabricInstance]);

  // Export as JSON
  const handleExport = useCallback(() => {
    const canvas = fabricInstance?.getCanvas();
    if (!canvas) return;
    
    const json = JSON.stringify(canvas.toJSON());
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${templateName || 'template'}.json`;
    a.click();
    closePanels();
  }, [fabricInstance, templateName]);

  // Import JSON
  const handleImport = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        const json = event.target?.result as string;
        fabricInstance?.loadFromJSON(JSON.parse(json));
      };
      reader.readAsText(file);
    };
    input.click();
    closePanels();
  }, [fabricInstance]);

  // Export as image
  const handleExportImage = useCallback(() => {
    const canvas = fabricInstance?.getCanvas();
    if (!canvas) return;

    const dataUrl = canvas.toDataURL({
      format: 'png',
      quality: 1,
      multiplier: 2,
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
    <div className={`flex flex-col ${isPreviewMode ? 'bg-amber-500/10' : ''}`}>
      {/* Primary Toolbar Row - Always visible */}
      <div className="toolbar border-b border-border">
        {/* Preview Mode Indicator */}
        {isPreviewMode && (
          <div className="flex items-center gap-1 mr-2 px-2 py-0.5 bg-amber-500/20 rounded-full flex-shrink-0">
            <Eye className="h-3 w-3 text-amber-600" />
            <span className="text-xs font-semibold text-amber-600 hidden sm:inline">Preview</span>
          </div>
        )}
        
        {/* Home Button */}
        <Link href="/dashboard" className="toolbar-button text-muted-foreground flex-shrink-0" title="Back to Dashboard">
          <ChevronLeft />
        </Link>
        
        {/* Template Name Input */}
        <div className="flex flex-col justify-center min-w-0 flex-shrink mx-1 sm:mx-2">
           <input 
             type="text" 
             value={templateName} 
             onChange={(e) => setTemplateName(e.target.value)}
             disabled={isPreviewMode}
             className="h-5 sm:h-6 min-w-12 sm:min-w-20 w-full max-w-24 sm:max-w-48 rounded border-transparent bg-transparent px-1 text-xs sm:text-sm font-semibold hover:border-border hover:bg-muted focus:border-primary focus:bg-background focus:outline-none disabled:opacity-50"
             placeholder="Untitled"
           />
        </div>

        <div className="toolbar-divider" />

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

        {/* Spacer */}
        <div className="flex-1 min-w-2" />

        {/* Action Buttons */}
        <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
           {saveStatus === 'saved' && (
             <span className="text-xs text-green-600 hidden sm:flex items-center gap-1">
               <Check className="h-3.5 w-3.5" />
               Saved
             </span>
           )}
           
           <button
             onClick={handleTogglePreview}
             title={isPreviewMode ? "Exit Preview" : "Preview"}
             className={`toolbar-button ${isPreviewMode ? 'bg-amber-500 text-white' : ''}`}
           >
              {isPreviewMode ? <EyeOff /> : <Eye />}
           </button>
           
           <button onClick={toggleRightSidebar} className="toolbar-button" title="Data Source">
              <Database />
           </button>

           <button
             onClick={onOpenCertificateInfo}
             className="toolbar-button relative"
             title="Certificate Info"
           >
              <Info />
              {!isCertificateInfoComplete && (
                <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-orange-500 border border-background" />
              )}
           </button>

           <button
             onClick={() => onSave?.()}
             disabled={saveStatus === 'saving' || isPreviewMode}
             className="flex items-center gap-1 rounded-md bg-secondary px-2 py-1 text-xs font-medium text-secondary-foreground hover:bg-secondary/80 disabled:opacity-50 flex-shrink-0"
           >
             {saveStatus === 'saving' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
             <span className="hidden sm:inline">Save</span>
           </button>

           <button
             onClick={onGenerate}
             disabled={rows.length === 0 || isPreviewMode}
             title={rows.length === 0 ? "Connect data source" : "Generate"}
             className="flex items-center gap-1 rounded-md bg-primary px-2 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 flex-shrink-0"
           >
             <Wand2 className="h-3.5 w-3.5" />
             <span className="hidden sm:inline">Generate</span>
           </button>

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
      <div className="toolbar border-b border-border bg-muted/30">
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
        <ToolPanelItem icon={Star} label="Star" onClick={() => handleAddShape('star')} disabled={isPreviewMode} />
        <ToolPanelItem icon={Pentagon} label="Pentagon" onClick={() => handleAddShape('pentagon')} disabled={isPreviewMode} />
        <ToolPanelItem icon={Hexagon} label="Hexagon" onClick={() => handleAddShape('hexagon')} disabled={isPreviewMode} />
        <ToolPanelItem icon={Diamond} label="Diamond" onClick={() => handleAddShape('diamond')} disabled={isPreviewMode} />
        <ToolPanelItem icon={Circle} label="Ellipse" onClick={() => handleAddShape('ellipse')} disabled={isPreviewMode} />
        <ToolPanelItem icon={Heart} label="Heart" onClick={() => handleAddShape('heart')} disabled={isPreviewMode} />
        <ToolPanelItem icon={Plus} label="Cross" onClick={() => handleAddShape('cross')} disabled={isPreviewMode} />
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
        <ToolPanelItem icon={Download} label="Export JSON" onClick={handleExport} />
        <ToolPanelItem icon={ImageIcon} label="Export PNG" onClick={handleExportImage} />
        <ToolPanelDivider />
        <ToolPanelItem icon={Upload} label="Import JSON" onClick={handleImport} disabled={isPreviewMode} />
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