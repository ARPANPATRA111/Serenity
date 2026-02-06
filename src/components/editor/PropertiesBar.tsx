'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useEditorStore } from '@/store/editorStore';
import { useFabricContext } from './FabricContext';
import { loadGoogleFont, isGoogleFont, loadAllGoogleFonts } from '@/lib/fonts/googleFonts';
import { ColorPicker } from '@/components/ui/ColorPicker';
import { StyleSidebar } from './StyleSidebar';
import {
  AlignLeft,
  AlignCenter,
  AlignRight,
  Bold,
  Italic,
  Underline,
  Type as TypeIcon,
} from 'lucide-react';

// Generic Fabric object type
type FabricObject = Record<string, unknown> & {
  left?: number;
  top?: number;
  width?: number;
  height?: number;
  scaleX?: number;
  scaleY?: number;
  angle?: number;
  opacity?: number;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  fontSize?: number;
  fontFamily?: string;
  fontWeight?: string | number;
  fontStyle?: string;
  underline?: boolean;
  textAlign?: string;
  text?: string;
  backgroundColor?: string;
  verificationId?: string; // For QR codes
  set: (key: string, value: unknown) => void;
  dynamicKey?: string;
};

export function PropertiesBar() {
  const { selectedObject, selectedObjectType } = useEditorStore();
  const { fabricInstance } = useFabricContext();
  const [fontsLoaded, setFontsLoaded] = useState(false);
  const [, setForceUpdate] = useState(0);
  
  // Style sidebar state (replaces font dropdown)
  const [styleSidebarMode, setStyleSidebarMode] = useState<'font' | 'color' | null>(null);
  const [colorProperty, setColorProperty] = useState<'fill' | 'stroke'>('fill');
  
  // Preview state for hover effects
  const originalColorsRef = useRef<Record<string, string>>({});

  // Force re-render helper
  const forceRender = useCallback(() => setForceUpdate(c => c + 1), []);

  // Subscribe to Fabric events to update UI when object changes (drag, resize, external edit)
  useEffect(() => {
    const canvas = fabricInstance?.getCanvas();
    if (!canvas) return;

    const handleObjectModified = () => forceRender();
    const handleSelectionUpdated = () => forceRender();
    
    canvas.on('object:modified', handleObjectModified);
    canvas.on('selection:updated', handleSelectionUpdated);
    
    // Also listen for property changes if possible, or just standard events
    
    return () => {
      canvas.off('object:modified', handleObjectModified);
      canvas.off('selection:updated', handleSelectionUpdated);
    };
  }, [fabricInstance, forceRender]);


  // Load fonts on mount
  useEffect(() => {
    const loadFonts = async () => {
      await loadAllGoogleFonts();
      setFontsLoaded(true);
    };
    loadFonts();
  }, []);
  
  // Close sidebar when clicking the main canvas area
  useEffect(() => {
    const handleCanvasClick = () => {
      if (styleSidebarMode) {
        setStyleSidebarMode(null);
      }
    };
    
    const canvas = fabricInstance?.getCanvas();
    if (canvas) {
      canvas.on('mouse:down', handleCanvasClick);
      return () => {
        canvas.off('mouse:down', handleCanvasClick);
      };
    }
  }, [styleSidebarMode, fabricInstance]);

  if (!selectedObject) {
    return (
      <div className="flex h-12 w-full items-center border-b border-border bg-card px-4 text-sm text-muted-foreground">
        Select an element to edit its properties
      </div>
    );
  }

  const object = selectedObject as unknown as FabricObject;
  const isText = selectedObjectType === 'textbox' || selectedObjectType === 'variableTextbox' || selectedObjectType === 'i-text';
  const isImage = selectedObjectType === 'image';
  const isQRCode = isImage && !!object.verificationId;
  const isLine = selectedObjectType === 'line';
  const isShape = selectedObjectType === 'rect' || selectedObjectType === 'circle' || selectedObjectType === 'triangle' || selectedObjectType === 'polygon' || selectedObjectType === 'path' || selectedObjectType === 'group';
  const hasStroke = isLine || isShape || (object.stroke && object.stroke !== 'transparent');
  
  const handleUpdate = () => {
    fabricInstance?.getCanvas()?.requestRenderAll();
    forceRender();
  };

  const handleChange = async (property: string, value: unknown) => {
    if (property === 'fontFamily' && typeof value === 'string' && isGoogleFont(value)) {
      await loadGoogleFont(value);
    }
    object.set(property, value);
    handleUpdate();
  };
  
  // Color preview handlers
  const handleColorPreview = (property: string) => (color: string | null) => {
    if (color === null) {
      // Restore original
      const original = originalColorsRef.current[property];
      if (original !== undefined) {
        object.set(property, original);
        handleUpdate();
        delete originalColorsRef.current[property];
      }
    } else {
      // Preview new color
      if (originalColorsRef.current[property] === undefined) {
        originalColorsRef.current[property] = (object[property as keyof FabricObject] as string) || '#000000';
      }
      object.set(property, color);
      handleUpdate();
    }
  };

  // Helper to check if property is active (e.g. bold)
  const isBold = object.fontWeight === 'bold' || object.fontWeight === 700 || object.fontWeight === '700';
  const isItalic = object.fontStyle === 'italic';
  const isUnderline = !!object.underline;
  const textAlign = object.textAlign || 'left';

  return (
    <div className="flex h-12 w-full items-center gap-4 border-b border-border bg-card px-4 overflow-x-auto no-scrollbar">
      <div className="flex items-center gap-2 border-r border-border pr-4 shrink-0">
        <span className="text-xs font-semibold text-muted-foreground uppercase">
          {isQRCode ? 'QR Code' : selectedObjectType || 'Object'}
        </span>
      </div>

      {/* Common Properties: Position & Opacity are less critical for top bar, usually style is first */}
      
      {/* Fill Color - Not for images or pure lines */}
      {!isImage && !isLine && (
        <div className="flex items-center gap-2 shrink-0">
          <ColorPicker
            value={(object.fill as string) || '#000000'}
            onChange={(color) => handleChange('fill', color)}
            label="Fill"
            showLabel={false}
            size="sm"
            onPreviewColor={handleColorPreview('fill')}
          />
        </div>
      )}

      {/* Stroke Color - For shapes and lines */}
      {hasStroke && (
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs text-muted-foreground">Stroke:</span>
          <ColorPicker
            value={(object.stroke as string) || '#000000'}
            onChange={(color) => handleChange('stroke', color)}
            label="Stroke"
            showLabel={false}
            size="sm"
            onPreviewColor={handleColorPreview('stroke')}
          />
          <input
            type="number"
            value={object.strokeWidth || 1}
            onChange={(e) => handleChange('strokeWidth', parseInt(e.target.value))}
            className="h-6 w-14 rounded border border-border px-1 text-xs"
            min="1"
            max="50"
            title="Stroke Width"
          />
        </div>
      )}

      {/* QR Code Special Properties */}
      {isQRCode && (
        <div className="flex items-center gap-2 shrink-0">
           <span className="text-xs text-muted-foreground">QR Color:</span>
           {/* Note: Standard QR generation via API usually returns black/white. 
               We can tint it using filters in Fabric.js, but properly regenerating is better.
               For now, we'll suggest resizing or use filters if implemented. 
           */}
           <p className="text-xs italic text-muted-foreground">Editing colors requires regeneration</p>
           
           {/* Scale Control */}
           <div className="flex items-center gap-1">
             <span className="text-xs text-muted-foreground">Scale:</span>
             <input
              type="number"
              step="0.1"
              value={object.scaleX ? object.scaleX.toFixed(2) : 1}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                object.set('scaleX', val);
                object.set('scaleY', val);
                handleUpdate();
              }}
              className="h-6 w-16 rounded border border-border px-1 text-xs"
             />
           </div>
        </div>
      )}

      {/* Text Properties */}
      {isText && (
        <>
          <div className="h-6 w-px bg-border mx-1 shrink-0" />
          
          {/* Font Family - Opens sidebar for selection */}
          {fontsLoaded ? (
            <button
              onClick={() => setStyleSidebarMode(styleSidebarMode === 'font' ? null : 'font')}
              className={`flex items-center justify-between h-8 w-36 rounded border px-2 text-xs transition-colors ${
                styleSidebarMode === 'font' 
                  ? 'border-primary bg-primary/10' 
                  : 'border-border bg-background hover:border-primary/50'
              }`}
              title="Font Family (opens sidebar)"
            >
              <span 
                className="truncate" 
                style={{ fontFamily: object.fontFamily || 'Arial' }}
              >
                {object.fontFamily || 'Arial'}
              </span>
              <TypeIcon className="h-3 w-3 ml-1 text-muted-foreground" />
            </button>
          ) : (
             <div className="h-8 w-36 animate-pulse rounded bg-muted" />
          )}

          {/* Font Size */}
          <input
            type="number"
            value={object.fontSize || 24}
            onChange={(e) => handleChange('fontSize', parseInt(e.target.value))}
            className="h-8 w-16 rounded border border-border px-2 text-xs"
            min="1"
            title="Font Size"
          />

          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => handleChange('fontWeight', isBold ? 'normal' : 'bold')}
              className={`rounded p-1.5 transition-colors ${
                isBold 
                  ? 'bg-primary text-primary-foreground shadow-sm' 
                  : 'hover:bg-muted text-muted-foreground'
              }`}
              title="Bold"
            >
              <Bold className="h-4 w-4" />
            </button>
            
            <button
              onClick={() => handleChange('fontStyle', isItalic ? 'normal' : 'italic')}
              className={`rounded p-1.5 transition-colors ${
                 isItalic
                  ? 'bg-primary text-primary-foreground shadow-sm' 
                  : 'hover:bg-muted text-muted-foreground'
              }`}
              title="Italic"
            >
              <Italic className="h-4 w-4" />
            </button>
            
            <button
              onClick={() => handleChange('underline', !isUnderline)}
              className={`rounded p-1.5 transition-colors ${
                isUnderline
                  ? 'bg-primary text-primary-foreground shadow-sm' 
                  : 'hover:bg-muted text-muted-foreground'
              }`}
              title="Underline"
            >
              <Underline className="h-4 w-4" />
            </button>
          </div>

          <div className="h-6 w-px bg-border mx-1 shrink-0" />

          {/* Alignment */}
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => handleChange('textAlign', 'left')}
              className={`rounded p-1.5 transition-colors ${
                textAlign === 'left'
                  ? 'bg-primary text-primary-foreground shadow-sm' 
                  : 'hover:bg-muted text-muted-foreground'
              }`}
              title="Align Left"
            >
              <AlignLeft className="h-4 w-4" />
            </button>
            <button
              onClick={() => handleChange('textAlign', 'center')}
              className={`rounded p-1.5 transition-colors ${
                textAlign === 'center'
                  ? 'bg-primary text-primary-foreground shadow-sm' 
                  : 'hover:bg-muted text-muted-foreground'
              }`}
              title="Align Center"
            >
              <AlignCenter className="h-4 w-4" />
            </button>
            <button
              onClick={() => handleChange('textAlign', 'right')}
              className={`rounded p-1.5 transition-colors ${
                textAlign === 'right'
                  ? 'bg-primary text-primary-foreground shadow-sm' 
                  : 'hover:bg-muted text-muted-foreground'
              }`}
              title="Align Right"
            >
              <AlignRight className="h-4 w-4" />
            </button>
          </div>
        </>
      )}

      {/* Opacity (Global) */}
       <div className="h-6 w-px bg-border mx-1 shrink-0" />
       <div className="flex items-center gap-2 shrink-0">
         <span className="text-xs text-muted-foreground">Opacity:</span>
         <input
          type="range"
          min="0"
          max="1"
          step="0.1"
          value={object.opacity ?? 1}
          onChange={(e) => handleChange('opacity', parseFloat(e.target.value))}
          className="w-20"
         />
       </div>
       
       {/* Style Sidebar for font/color selection */}
       {styleSidebarMode && (
         <StyleSidebar
           mode={styleSidebarMode}
           onClose={() => setStyleSidebarMode(null)}
           colorProperty={colorProperty}
         />
       )}
    </div>
  );
}
