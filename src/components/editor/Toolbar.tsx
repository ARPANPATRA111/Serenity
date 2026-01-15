'use client';

/**
 * Editor Toolbar - Professional Certificate Editor
 * 
 * Provides comprehensive editing tools for certificate design:
 * - Element creation (text, images, shapes, links)
 * - Object manipulation (copy, delete, order)
 * - Alignment and distribution tools
 * - History (undo/redo)
 * - Zoom controls
 * - Grid toggle
 * - Preview mode
 * - Export/Import
 * - SAVE & GENERATE Actions
 */

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
  ZoomIn,
  ZoomOut,
  Download,
  Upload,
  AlignHorizontalJustifyCenter,
  AlignLeft,
  AlignRight,
  AlignCenterHorizontal,
  AlignStartVertical,
  AlignEndVertical,
  AlignCenterVertical,
  Grid3X3,
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
  ChevronDown,
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
} from 'lucide-react';
import Link from 'next/link';
import { ColorPicker } from '@/components/ui/ColorPicker';

interface ToolbarDropdownProps {
  trigger: React.ReactNode;
  children: React.ReactNode;
  isOpen: boolean;
  onToggle: () => void;
}

function ToolbarDropdown({ trigger, children, isOpen, onToggle }: ToolbarDropdownProps) {
  return (
    <div className="relative">
      <button onClick={onToggle} className="toolbar-button flex items-center gap-1">
        {trigger}
        <ChevronDown className="h-3 w-3" />
      </button>
      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={onToggle} />
          <div 
            className="absolute right-0 top-full mt-1 z-50 min-w-[180px] rounded-lg border border-border bg-card shadow-lg p-1"
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
          >
            {children}
          </div>
        </>
      )}
    </div>
  );
}

interface DropdownItemProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
  shortcut?: string;
  disabled?: boolean;
}

function DropdownItem({ icon: Icon, label, onClick, shortcut, disabled }: DropdownItemProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex items-center justify-between w-full gap-2 px-3 py-2 text-sm rounded hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
    >
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <span>{label}</span>
      </div>
      {shortcut && (
        <span className="text-xs text-muted-foreground">{shortcut}</span>
      )}
    </button>
  );
}

interface ToolbarProps {
  onSave?: () => Promise<void>;
  saveStatus?: 'idle' | 'saving' | 'saved' | 'error';
  onGenerate?: () => void;
  onPreview?: () => void;
}

export function Toolbar({ onSave, saveStatus = 'idle', onGenerate, onPreview }: ToolbarProps) {
  const { fabricInstance } = useFabricContext();
  const { 
    zoomLevel, setZoomLevel, 
    canUndo, canRedo, 
    selectedObject,
    templateName, setTemplateName,
    pushHistory,
    isPreviewMode,
    setPreviewMode,
  } = useEditorStore();
  
  const [showGrid, setShowGrid] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [previewOriginalTexts, setPreviewOriginalTexts] = useState<Map<string, string>>(new Map());
  const [canvasBackgroundColor, setCanvasBackgroundColor] = useState('#ffffff');
  const [borderColor, setBorderColor] = useState('#d4af37');
  const { rows, getPreviewRow } = useDataSourceStore();

  // Sync canvas background color with fabric instance
  useEffect(() => {
    if (fabricInstance) {
      const currentBg = fabricInstance.getBackgroundColor?.() || '#ffffff';
      setCanvasBackgroundColor(currentBg);
    }
  }, [fabricInstance]);

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

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+S for Save
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        onSave?.();
      }
      
      // Ctrl+Z for Undo
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        if (canUndo) handleUndoRef.current?.();
      }

      // Ctrl+Y for Redo
      if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        e.preventDefault();
        if (canRedo) handleRedoRef.current?.();
      }

      if ((e.ctrlKey || e.metaKey) && e.key === 'q') {
        e.preventDefault();
        handleTogglePreviewRef.current?.();
      }

      // Del/Backspace for Delete
      if (e.key === 'Delete' || e.key === 'Backspace') {
        // Only if canvas is active and not editing text
        if (fabricInstance && selectedObject && !useEditorStore.getState().isEditingText) {
          handleDeleteRef.current?.();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onSave, canUndo, canRedo, selectedObject, fabricInstance]);

  const toggleDropdown = (name: string) => {
    setOpenDropdown(openDropdown === name ? null : name);
  };

  const closeDropdowns = () => setOpenDropdown(null);

  // Text variations
  const handleAddText = useCallback(() => {
    if (isPreviewMode) return;
    fabricInstance?.addText('Double-click to edit');
    closeDropdowns();
  }, [fabricInstance, isPreviewMode]);

  const handleAddHeading = useCallback(() => {
    if (isPreviewMode) return;
    fabricInstance?.addText('Heading', {
      fontSize: 48,
      fontWeight: 'bold',
    });
    closeDropdowns();
  }, [fabricInstance, isPreviewMode]);

  const handleAddSubheading = useCallback(() => {
    if (isPreviewMode) return;
    fabricInstance?.addText('Subheading', {
      fontSize: 32,
      fontWeight: '600',
    });
    closeDropdowns();
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
    closeDropdowns();
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

  const handleAddShape = useCallback((type: 'rect' | 'circle' | 'triangle' | 'line' | 'star' | 'pentagon' | 'hexagon' | 'arrow' | 'dashedLine' | 'arrowLine' | 'roundedRect' | 'diamond') => {
    if (isPreviewMode) return;
    fabricInstance?.addShape(type);
    closeDropdowns();
  }, [fabricInstance, isPreviewMode]);

  const handleAddBorder = useCallback((style: 'simple' | 'double' | 'ornate' | 'gold' | 'corner') => {
    if (isPreviewMode) return;
    fabricInstance?.addBorder?.(style, borderColor);
    closeDropdowns();
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
        
        // Restore original texts for variable textboxes
        if (isTextObj && originalText !== undefined) {
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
        
        // Restore verification URL placeholder
        if (obj.isVerificationUrl) {
          const originalVerifyText = previewOriginalTexts.get(`verify_${index}`);
          if (originalVerifyText !== undefined) {
            obj.set('text', originalVerifyText);
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
    closeDropdowns();
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

  const handleToggleGrid = useCallback(() => {
    setShowGrid(!showGrid);
    // TODO: Implement grid rendering in fabricInstance
  }, [showGrid]);

  const handleZoomIn = () => setZoomLevel(zoomLevel * 1.1);
  const handleZoomOut = () => setZoomLevel(zoomLevel / 1.1);
  const handleZoomReset = () => setZoomLevel(1);

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
    closeDropdowns();
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
    closeDropdowns();
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
    closeDropdowns();
  }, [fabricInstance, templateName]);

  const isObjectSelected = !!selectedObject;
  const isLocked = selectedObject?.lockMovementX;
  const isVerificationSelected = selectedObject && (selectedObject as any).isVerificationUrl;

  return (
    <div className={`toolbar ${isPreviewMode ? 'bg-amber-500/10 border-amber-500/30' : ''}`}>
      {/* Preview Mode Indicator */}
      {isPreviewMode && (
        <div className="flex items-center gap-2 mr-4 px-3 py-1 bg-amber-500/20 rounded-full">
          <Eye className="h-4 w-4 text-amber-600" />
          <span className="text-xs font-semibold text-amber-600">Preview Mode</span>
        </div>
      )}
      
      {/* Home Button */}
      <Link href="/dashboard" className="toolbar-button text-muted-foreground mr-2" title="Back to Dashboard">
        <ChevronLeft className="h-5 w-5" />
      </Link>
      
      {/* Template Name Input */}
      <div className="mr-4 flex flex-col justify-center">
         <input 
           type="text" 
           value={templateName} 
           onChange={(e) => setTemplateName(e.target.value)}
           disabled={isPreviewMode}
           className="h-6 w-48 rounded border-transparent bg-transparent px-1 text-sm font-semibold hover:border-border hover:bg-muted focus:border-primary focus:bg-background focus:outline-none disabled:opacity-50"
           placeholder="Untitled Template"
         />
      </div>

      <div className="h-6 w-px bg-border mx-2" />

      {/* Text Tools */}
      <ToolbarDropdown
        trigger={<Type className="h-5 w-5" />}
        isOpen={openDropdown === 'text'}
        onToggle={() => toggleDropdown('text')}
      >
        <DropdownItem icon={Type} label="Body Text" onClick={handleAddText} disabled={isPreviewMode} />
        <DropdownItem icon={Type} label="Heading" onClick={handleAddHeading} disabled={isPreviewMode} />
        <DropdownItem icon={Type} label="Subheading" onClick={handleAddSubheading} disabled={isPreviewMode} />
      </ToolbarDropdown>

      <button onClick={handleAddImage} className="toolbar-button" title="Add Image" disabled={isPreviewMode}>
        <ImageIcon className="h-5 w-5" />
      </button>

      {/* Add Link Button */}
      <button onClick={handleAddLink} className="toolbar-button" title="Add Clickable Link" disabled={isPreviewMode}>
        <Link2 className="h-5 w-5" />
      </button>

      <div className="toolbar-divider" />

      {/* Shapes */}
      <ToolbarDropdown
        trigger={<Square className="h-5 w-5" />}
        isOpen={openDropdown === 'shapes'}
        onToggle={() => toggleDropdown('shapes')}
      >
        <div className="px-2 py-1 text-xs font-semibold text-muted-foreground">Basic Shapes</div>
        <DropdownItem icon={Square} label="Rectangle" onClick={() => handleAddShape('rect')} disabled={isPreviewMode} />
        <DropdownItem icon={RectangleHorizontal} label="Rounded Rectangle" onClick={() => handleAddShape('roundedRect')} disabled={isPreviewMode} />
        <DropdownItem icon={Circle} label="Circle" onClick={() => handleAddShape('circle')} disabled={isPreviewMode} />
        <DropdownItem icon={Triangle} label="Triangle" onClick={() => handleAddShape('triangle')} disabled={isPreviewMode} />
        <DropdownItem icon={Diamond} label="Diamond" onClick={() => handleAddShape('diamond')} disabled={isPreviewMode} />
        <div className="my-1 border-t border-border" />
        <div className="px-2 py-1 text-xs font-semibold text-muted-foreground">Polygons</div>
        <DropdownItem icon={Pentagon} label="Pentagon" onClick={() => handleAddShape('pentagon')} disabled={isPreviewMode} />
        <DropdownItem icon={Hexagon} label="Hexagon" onClick={() => handleAddShape('hexagon')} disabled={isPreviewMode} />
        <DropdownItem icon={Star} label="Star" onClick={() => handleAddShape('star')} disabled={isPreviewMode} />
        <DropdownItem icon={ArrowRight} label="Arrow Shape" onClick={() => handleAddShape('arrow')} disabled={isPreviewMode} />
        <div className="my-1 border-t border-border" />
        <div className="px-2 py-1 text-xs font-semibold text-muted-foreground">Lines</div>
        <DropdownItem icon={Minus} label="Solid Line" onClick={() => handleAddShape('line')} disabled={isPreviewMode} />
        <DropdownItem icon={MoreHorizontal} label="Dashed Line" onClick={() => handleAddShape('dashedLine')} disabled={isPreviewMode} />
        <DropdownItem icon={ArrowRight} label="Arrow Line" onClick={() => handleAddShape('arrowLine')} disabled={isPreviewMode} />
      </ToolbarDropdown>

      {/* Borders */}
      <ToolbarDropdown
        trigger={<Frame className="h-5 w-5" />}
        isOpen={openDropdown === 'borders'}
        onToggle={() => toggleDropdown('borders')}
      >
        <div className="px-2 py-1 text-xs font-semibold text-muted-foreground">Certificate Borders</div>
        <div className="px-2 py-2 flex items-center gap-2 border-b border-border mb-1">
          <span className="text-xs text-muted-foreground">Color:</span>
          <ColorPicker
            value={borderColor}
            onChange={setBorderColor}
            showLabel={false}
            size="sm"
          />
          <span className="text-xs text-muted-foreground flex-1 truncate">{borderColor}</span>
        </div>
        <DropdownItem icon={Square} label="Simple Border" onClick={() => handleAddBorder('simple')} disabled={isPreviewMode} />
        <DropdownItem icon={Square} label="Double Border" onClick={() => handleAddBorder('double')} disabled={isPreviewMode} />
        <DropdownItem icon={Square} label="Ornate Border" onClick={() => handleAddBorder('ornate')} disabled={isPreviewMode} />
        <DropdownItem icon={Square} label="Gold Frame" onClick={() => handleAddBorder('gold')} disabled={isPreviewMode} />
        <DropdownItem icon={Square} label="Corner Only" onClick={() => handleAddBorder('corner')} disabled={isPreviewMode} />
      </ToolbarDropdown>

      {/* Background Color */}
      <div className="flex items-center gap-1 mx-1" title="Canvas Background Color">
        <ColorPicker
          value={canvasBackgroundColor}
          onChange={handleBackgroundColorChange}
          label="Background"
          showLabel={false}
          size="sm"
        />
      </div>

      <div className="toolbar-divider" />

      {/* History */}
      <div className="flex items-center gap-1">
        <button
          onClick={handleUndo}
          className="toolbar-button"
          title="Undo (Ctrl+Z)"
          disabled={!canUndo || isPreviewMode}
        >
          <Undo2 className="h-5 w-5" />
        </button>
        <button
          onClick={handleRedo}
          className="toolbar-button"
          title="Redo (Ctrl+Y)"
          disabled={!canRedo || isPreviewMode}
        >
          <Redo2 className="h-5 w-5" />
        </button>
      </div>

      <div className="toolbar-divider" />

      {/* Object Operations */}
      <div className="flex items-center gap-1">
        <button
          onClick={handleClone}
          className="toolbar-button"
          title="Duplicate (Ctrl+D)"
          disabled={!isObjectSelected || isPreviewMode}
        >
          <Copy className="h-5 w-5" />
        </button>
        <button
          onClick={handleDelete}
          className={`toolbar-button ${isVerificationSelected ? 'opacity-30 cursor-not-allowed' : ''}`}
          title={isVerificationSelected ? "Cannot delete Verification URL" : "Delete (Del)"}
          disabled={!isObjectSelected || isPreviewMode}
        >
          <Trash2 className="h-5 w-5" />
        </button>
      </div>

      <div className="toolbar-divider" />

      {/* Alignment */}
      <ToolbarDropdown
        trigger={<AlignHorizontalJustifyCenter className="h-5 w-5" />}
        isOpen={openDropdown === 'align'}
        onToggle={() => toggleDropdown('align')}
      >
        <div className="px-2 py-1 text-xs font-semibold text-muted-foreground">Horizontal</div>
        <DropdownItem icon={AlignLeft} label="Align Left" onClick={() => handleAlign('left')} disabled={!isObjectSelected || isPreviewMode} />
        <DropdownItem icon={AlignCenterHorizontal} label="Center Horizontal" onClick={() => handleAlign('center')} disabled={!isObjectSelected || isPreviewMode} />
        <DropdownItem icon={AlignRight} label="Align Right" onClick={() => handleAlign('right')} disabled={!isObjectSelected || isPreviewMode} />
        <div className="my-1 border-t border-border" />
        <div className="px-2 py-1 text-xs font-semibold text-muted-foreground">Vertical</div>
        <DropdownItem icon={AlignStartVertical} label="Align Top" onClick={() => handleAlign('top')} disabled={!isObjectSelected || isPreviewMode} />
        <DropdownItem icon={AlignCenterVertical} label="Center Vertical" onClick={() => handleAlign('middle')} disabled={!isObjectSelected || isPreviewMode} />
        <DropdownItem icon={AlignEndVertical} label="Align Bottom" onClick={() => handleAlign('bottom')} disabled={!isObjectSelected || isPreviewMode} />
      </ToolbarDropdown>

      {/* Layer Operations */}
      <div className="flex items-center gap-1">
        <button
          onClick={handleBringToFront}
          className="toolbar-button"
          title="Bring to Front"
          disabled={!isObjectSelected || isPreviewMode}
        >
          <ArrowUpToLine className="h-5 w-5" />
        </button>
        <button
          onClick={handleSendToBack}
          className="toolbar-button"
          title="Send to Back"
          disabled={!isObjectSelected}
        >
          <ArrowDownToLine className="h-5 w-5" />
        </button>
      </div>

      <div className="toolbar-divider" />

      {/* Transform */}
      <ToolbarDropdown
        trigger={<FlipHorizontal className="h-5 w-5" />}
        isOpen={openDropdown === 'transform'}
        onToggle={() => toggleDropdown('transform')}
      >
        <DropdownItem icon={FlipHorizontal} label="Flip Horizontal" onClick={handleFlipHorizontal} disabled={!isObjectSelected} />
        <DropdownItem icon={FlipVertical} label="Flip Vertical" onClick={handleFlipVertical} disabled={!isObjectSelected} />
        <div className="my-1 border-t border-border" />
        <DropdownItem icon={RotateCcw} label="Rotate Left 90°" onClick={() => handleRotate(-90)} disabled={!isObjectSelected} />
        <DropdownItem icon={RotateCw} label="Rotate Right 90°" onClick={() => handleRotate(90)} disabled={!isObjectSelected} />
        <div className="my-1 border-t border-border" />
        <DropdownItem 
          icon={isLocked ? Unlock : Lock} 
          label={isLocked ? "Unlock Object" : "Lock Object"} 
          onClick={handleToggleLock} 
          disabled={!isObjectSelected}
        />
      </ToolbarDropdown>

      <div className="toolbar-divider" />

      {/* View Options */}
      <button
        onClick={handleToggleGrid}
        className={`toolbar-button ${showGrid ? 'bg-primary/20 text-primary' : ''}`}
        title="Toggle Grid"
      >
        <Grid3X3 className="h-5 w-5" />
      </button>

      {/* Zoom */}
      <div className="flex items-center gap-1">
        <button onClick={handleZoomOut} className="toolbar-button" title="Zoom Out">
          <ZoomOut className="h-5 w-5" />
        </button>
        <button 
          onClick={handleZoomReset}
          className="w-14 text-center text-sm text-muted-foreground hover:text-foreground transition-colors"
          title="Reset Zoom"
        >
          {Math.round(zoomLevel * 100)}%
        </button>
        <button onClick={handleZoomIn} className="toolbar-button" title="Zoom In">
          <ZoomIn className="h-5 w-5" />
        </button>
      </div>

      <div className="flex-1" />

      {/* PREVIEW, SAVE & GENERATE Actions */}
      <div className="flex items-center gap-2 mr-2">
         {saveStatus === 'error' && (
           <span className="text-xs text-destructive mr-2">Save failed</span>
         )}
         {saveStatus === 'saved' && (
           <span className="text-xs text-green-600 mr-2">Saved</span>
         )}
         
         {/* Preview Toggle Button */}
         <button
           onClick={handleTogglePreview}
           title={isPreviewMode ? "Exit Preview Mode" : "Preview Certificate"}
           className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
             isPreviewMode 
               ? 'bg-amber-500 text-white hover:bg-amber-600' 
               : 'bg-white border border-border text-muted-foreground hover:bg-muted hover:text-foreground'
           }`}
         >
            {isPreviewMode ? (
              <>
                <EyeOff className="h-4 w-4" />
                <span className="hidden xl:inline">Exit Preview</span>
              </>
            ) : (
              <>
                <Eye className="h-4 w-4" />
                <span className="hidden xl:inline">Preview</span>
              </>
            )}
         </button>
         
         <button
           onClick={toggleRightSidebar}
           title="Toggle Data Source"
           className="flex items-center gap-2 rounded-md bg-white border border-border px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
         >
            <Database className="h-4 w-4" />
            <span className="hidden xl:inline">Data</span>
         </button>

         <button
           onClick={() => onSave?.()}
           disabled={saveStatus === 'saving' || isPreviewMode}
           className="flex items-center gap-2 rounded-md bg-secondary px-3 py-1.5 text-sm font-medium text-secondary-foreground transition-colors hover:bg-secondary/80 disabled:opacity-50"
         >
           {saveStatus === 'saving' ? (
             <Loader2 className="h-4 w-4 animate-spin" />
           ) : (
             <Save className="h-4 w-4" />
           )}
           Save
         </button>

         <button
           onClick={onGenerate}
           disabled={rows.length === 0 || isPreviewMode}
           title={rows.length === 0 ? "Connect a data source first" : "Generate Certificates"}
           className="flex items-center gap-2 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
         >
           <Wand2 className="h-4 w-4" />
           Generate
         </button>
      </div>

      <div className="h-6 w-px bg-border mx-2" />

      {/* Import/Export */}
      <ToolbarDropdown
        trigger={<Download className="h-5 w-5" />}
        isOpen={openDropdown === 'export'}
        onToggle={() => toggleDropdown('export')}
      >
        <DropdownItem icon={Download} label="Export Template (JSON)" onClick={handleExport} />
        <DropdownItem icon={ImageIcon} label="Export as Image (PNG)" onClick={handleExportImage} />
        <div className="my-1 border-t border-border" />
        <DropdownItem icon={Upload} label="Import Template" onClick={handleImport} disabled={isPreviewMode} />
      </ToolbarDropdown>
    </div>
  );
}
