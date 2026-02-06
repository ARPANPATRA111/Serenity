'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { X, Type, Palette } from 'lucide-react';
import { useFabricContext } from './FabricContext';
import { useEditorStore } from '@/store/editorStore';
import { getAllFonts, loadGoogleFont, isGoogleFont, loadAllGoogleFonts } from '@/lib/fonts/googleFonts';
import { ColorPicker } from '@/components/ui/ColorPicker';

type SidebarMode = 'font' | 'color' | null;

interface StyleSidebarProps {
  mode: SidebarMode;
  onClose: () => void;
  colorProperty?: 'fill' | 'stroke';
}

type FabricObject = Record<string, unknown> & {
  fontFamily?: string;
  fill?: string;
  stroke?: string;
  set: (key: string, value: unknown) => void;
};

export function StyleSidebar({ mode, onClose, colorProperty = 'fill' }: StyleSidebarProps) {
  const { fabricInstance } = useFabricContext();
  const { selectedObject } = useEditorStore();
  const [availableFonts, setAvailableFonts] = useState<string[]>([]);
  const [fontsLoaded, setFontsLoaded] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [originalFont, setOriginalFont] = useState<string | null>(null);
  const [originalColor, setOriginalColor] = useState<string | null>(null);
  const sidebarRef = useRef<HTMLDivElement>(null);
  
  const object = selectedObject as unknown as FabricObject | null;

  // Load fonts on mount
  useEffect(() => {
    const loadFonts = async () => {
      await loadAllGoogleFonts();
      setAvailableFonts(getAllFonts());
      setFontsLoaded(true);
    };
    loadFonts();
  }, []);

  // Store original value when sidebar opens
  useEffect(() => {
    if (mode === 'font' && object) {
      setOriginalFont(object.fontFamily || 'Arial');
    } else if (mode === 'color' && object) {
      setOriginalColor((object[colorProperty] as string) || '#000000');
    }
    
    return () => {
      // Restore original on unmount if not selected
      if (mode === 'font' && originalFont && object) {
        object.set('fontFamily', originalFont);
        fabricInstance?.getCanvas()?.requestRenderAll();
      } else if (mode === 'color' && originalColor && object) {
        object.set(colorProperty, originalColor);
        fabricInstance?.getCanvas()?.requestRenderAll();
      }
    };
  }, [mode]);

  // Handle click outside to close
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (sidebarRef.current && !sidebarRef.current.contains(event.target as Node)) {
        // Restore original value before closing
        if (mode === 'font' && originalFont && object) {
          object.set('fontFamily', originalFont);
          fabricInstance?.getCanvas()?.requestRenderAll();
        } else if (mode === 'color' && originalColor && object) {
          object.set(colorProperty, originalColor);
          fabricInstance?.getCanvas()?.requestRenderAll();
        }
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose, mode, originalFont, originalColor, object, fabricInstance, colorProperty]);

  const handleFontHover = useCallback(async (font: string) => {
    if (!object) return;
    
    if (isGoogleFont(font)) {
      await loadGoogleFont(font);
    }
    object.set('fontFamily', font);
    fabricInstance?.getCanvas()?.requestRenderAll();
  }, [object, fabricInstance]);

  const handleFontLeave = useCallback(() => {
    if (!object || !originalFont) return;
    object.set('fontFamily', originalFont);
    fabricInstance?.getCanvas()?.requestRenderAll();
  }, [object, originalFont, fabricInstance]);

  const handleFontSelect = useCallback(async (font: string) => {
    if (!object) return;
    
    setOriginalFont(null); // Clear original so it doesn't restore on close
    if (isGoogleFont(font)) {
      await loadGoogleFont(font);
    }
    object.set('fontFamily', font);
    fabricInstance?.getCanvas()?.requestRenderAll();
    onClose();
  }, [object, fabricInstance, onClose]);

  const handleColorChange = useCallback((color: string) => {
    if (!object) return;
    object.set(colorProperty, color);
    fabricInstance?.getCanvas()?.requestRenderAll();
  }, [object, fabricInstance, colorProperty]);

  const handleColorSelect = useCallback((color: string) => {
    if (!object) return;
    setOriginalColor(null); // Clear original so it doesn't restore on close
    object.set(colorProperty, color);
    fabricInstance?.getCanvas()?.requestRenderAll();
    onClose();
  }, [object, fabricInstance, colorProperty, onClose]);

  // Filter fonts based on search
  const filteredFonts = availableFonts.filter(font => 
    font.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (!mode) return null;

  return (
    <div 
      ref={sidebarRef}
      className="fixed left-0 top-0 h-full w-72 bg-card border-r border-border shadow-xl z-50 flex flex-col animate-in slide-in-from-left duration-200"
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div className="flex items-center gap-2">
          {mode === 'font' ? (
            <>
              <Type className="h-5 w-5 text-primary" />
              <span className="font-semibold">Select Font</span>
            </>
          ) : (
            <>
              <Palette className="h-5 w-5 text-primary" />
              <span className="font-semibold">Select Color</span>
            </>
          )}
        </div>
        <button
          onClick={onClose}
          className="p-1 hover:bg-muted rounded transition-colors"
          title="Close"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {mode === 'font' && (
        <>
          {/* Search */}
          <div className="p-3 border-b border-border">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search fonts..."
              className="w-full h-9 px-3 rounded-md border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          {/* Font List */}
          <div className="flex-1 overflow-y-auto">
            {fontsLoaded ? (
              <div className="p-2">
                {/* Default Arial */}
                <button
                  onClick={() => handleFontSelect('Arial')}
                  onMouseEnter={() => handleFontHover('Arial')}
                  onMouseLeave={handleFontLeave}
                  className={`w-full text-left px-3 py-2.5 rounded-md hover:bg-primary/10 transition-colors ${
                    (object?.fontFamily || 'Arial') === 'Arial' ? 'bg-primary/20 font-medium' : ''
                  }`}
                  style={{ fontFamily: 'Arial' }}
                >
                  Arial
                </button>

                {filteredFonts.map((font) => (
                  <button
                    key={font}
                    onClick={() => handleFontSelect(font)}
                    onMouseEnter={() => handleFontHover(font)}
                    onMouseLeave={handleFontLeave}
                    className={`w-full text-left px-3 py-2.5 rounded-md hover:bg-primary/10 transition-colors ${
                      object?.fontFamily === font ? 'bg-primary/20 font-medium' : ''
                    }`}
                    style={{ fontFamily: font }}
                  >
                    {font}
                  </button>
                ))}
              </div>
            ) : (
              <div className="flex items-center justify-center h-32 text-muted-foreground">
                Loading fonts...
              </div>
            )}
          </div>

          {/* Current Selection */}
          <div className="p-3 border-t border-border bg-muted/30">
            <p className="text-xs text-muted-foreground">Current font:</p>
            <p className="font-medium" style={{ fontFamily: object?.fontFamily || 'Arial' }}>
              {object?.fontFamily || 'Arial'}
            </p>
          </div>
        </>
      )}

      {mode === 'color' && (
        <div className="flex-1 p-4 space-y-6">
          {/* Color Picker */}
          <div>
            <label className="block text-sm font-medium mb-3">
              {colorProperty === 'fill' ? 'Fill Color' : 'Stroke Color'}
            </label>
            <div className="flex justify-center">
              <ColorPicker
                value={(object?.[colorProperty] as string) || '#000000'}
                onChange={handleColorChange}
                showLabel={false}
                size="lg"
              />
            </div>
          </div>

          {/* Preset Colors */}
          <div>
            <label className="block text-sm font-medium mb-3">Quick Colors</label>
            <div className="grid grid-cols-6 gap-2">
              {[
                '#000000', '#ffffff', '#ef4444', '#f97316', '#eab308', '#22c55e',
                '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899', '#6b7280', '#d4af37',
                '#1e3a5f', '#0f172a', '#fef3c7', '#f1f5f9', '#4ade80', '#38bdf8',
              ].map((color) => (
                <button
                  key={color}
                  onClick={() => handleColorSelect(color)}
                  className={`w-8 h-8 rounded-md border-2 transition-transform hover:scale-110 ${
                    (object?.[colorProperty] as string) === color 
                      ? 'border-primary ring-2 ring-primary ring-offset-2' 
                      : 'border-border'
                  }`}
                  style={{ backgroundColor: color }}
                  title={color}
                />
              ))}
            </div>
          </div>

          {/* Apply Button */}
          <button
            onClick={() => {
              setOriginalColor(null);
              onClose();
            }}
            className="w-full py-2 bg-primary text-primary-foreground rounded-md font-medium hover:bg-primary/90 transition-colors"
          >
            Apply Color
          </button>

          {/* Cancel Button */}
          <button
            onClick={onClose}
            className="w-full py-2 border border-border rounded-md font-medium hover:bg-muted transition-colors"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
