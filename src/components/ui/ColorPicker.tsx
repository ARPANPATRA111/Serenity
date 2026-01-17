'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Palette, History, ChevronDown, Pipette, Check } from 'lucide-react';

// Recent colors storage key
const RECENT_COLORS_KEY = 'serenity_recent_colors';
const MAX_RECENT_COLORS = 12;

// Preset color palettes - professionally curated
const COLOR_PRESETS = {
  grayscale: [
    { color: '#ffffff', name: 'White' },
    { color: '#f9fafb', name: 'Gray 50' },
    { color: '#f3f4f6', name: 'Gray 100' },
    { color: '#e5e7eb', name: 'Gray 200' },
    { color: '#d1d5db', name: 'Gray 300' },
    { color: '#9ca3af', name: 'Gray 400' },
    { color: '#6b7280', name: 'Gray 500' },
    { color: '#4b5563', name: 'Gray 600' },
    { color: '#374151', name: 'Gray 700' },
    { color: '#1f2937', name: 'Gray 800' },
    { color: '#111827', name: 'Gray 900' },
    { color: '#000000', name: 'Black' },
  ],
  reds: [
    { color: '#fff5f5', name: 'Red 50' },
    { color: '#fed7d7', name: 'Red 100' },
    { color: '#feb2b2', name: 'Red 200' },
    { color: '#fc8181', name: 'Red 300' },
    { color: '#f56565', name: 'Red 400' },
    { color: '#e53e3e', name: 'Red 500' },
    { color: '#c53030', name: 'Red 600' },
    { color: '#9b2c2c', name: 'Red 700' },
    { color: '#822727', name: 'Red 800' },
    { color: '#63171b', name: 'Red 900' },
  ],
  oranges: [
    { color: '#fffaf0', name: 'Orange 50' },
    { color: '#feebc8', name: 'Orange 100' },
    { color: '#fbd38d', name: 'Orange 200' },
    { color: '#f6ad55', name: 'Orange 300' },
    { color: '#ed8936', name: 'Orange 400' },
    { color: '#dd6b20', name: 'Orange 500' },
    { color: '#c05621', name: 'Orange 600' },
    { color: '#9c4221', name: 'Orange 700' },
    { color: '#7b341e', name: 'Orange 800' },
    { color: '#652b19', name: 'Orange 900' },
  ],
  yellows: [
    { color: '#fffff0', name: 'Yellow 50' },
    { color: '#fefcbf', name: 'Yellow 100' },
    { color: '#faf089', name: 'Yellow 200' },
    { color: '#f6e05e', name: 'Yellow 300' },
    { color: '#ecc94b', name: 'Yellow 400' },
    { color: '#d69e2e', name: 'Yellow 500' },
    { color: '#b7791f', name: 'Yellow 600' },
    { color: '#975a16', name: 'Yellow 700' },
    { color: '#744210', name: 'Yellow 800' },
    { color: '#5f370e', name: 'Yellow 900' },
  ],
  greens: [
    { color: '#f0fff4', name: 'Green 50' },
    { color: '#c6f6d5', name: 'Green 100' },
    { color: '#9ae6b4', name: 'Green 200' },
    { color: '#68d391', name: 'Green 300' },
    { color: '#48bb78', name: 'Green 400' },
    { color: '#38a169', name: 'Green 500' },
    { color: '#2f855a', name: 'Green 600' },
    { color: '#276749', name: 'Green 700' },
    { color: '#22543d', name: 'Green 800' },
    { color: '#1c4532', name: 'Green 900' },
  ],
  teals: [
    { color: '#e6fffa', name: 'Teal 50' },
    { color: '#b2f5ea', name: 'Teal 100' },
    { color: '#81e6d9', name: 'Teal 200' },
    { color: '#4fd1c5', name: 'Teal 300' },
    { color: '#38b2ac', name: 'Teal 400' },
    { color: '#319795', name: 'Teal 500' },
    { color: '#2c7a7b', name: 'Teal 600' },
    { color: '#285e61', name: 'Teal 700' },
    { color: '#234e52', name: 'Teal 800' },
    { color: '#1d4044', name: 'Teal 900' },
  ],
  blues: [
    { color: '#ebf8ff', name: 'Blue 50' },
    { color: '#bee3f8', name: 'Blue 100' },
    { color: '#90cdf4', name: 'Blue 200' },
    { color: '#63b3ed', name: 'Blue 300' },
    { color: '#4299e1', name: 'Blue 400' },
    { color: '#3182ce', name: 'Blue 500' },
    { color: '#2b6cb0', name: 'Blue 600' },
    { color: '#2c5282', name: 'Blue 700' },
    { color: '#2a4365', name: 'Blue 800' },
    { color: '#1a365d', name: 'Blue 900' },
  ],
  purples: [
    { color: '#faf5ff', name: 'Purple 50' },
    { color: '#e9d8fd', name: 'Purple 100' },
    { color: '#d6bcfa', name: 'Purple 200' },
    { color: '#b794f4', name: 'Purple 300' },
    { color: '#9f7aea', name: 'Purple 400' },
    { color: '#805ad5', name: 'Purple 500' },
    { color: '#6b46c1', name: 'Purple 600' },
    { color: '#553c9a', name: 'Purple 700' },
    { color: '#44337a', name: 'Purple 800' },
    { color: '#322659', name: 'Purple 900' },
  ],
  pinks: [
    { color: '#fff5f7', name: 'Pink 50' },
    { color: '#fed7e2', name: 'Pink 100' },
    { color: '#fbb6ce', name: 'Pink 200' },
    { color: '#f687b3', name: 'Pink 300' },
    { color: '#ed64a6', name: 'Pink 400' },
    { color: '#d53f8c', name: 'Pink 500' },
    { color: '#b83280', name: 'Pink 600' },
    { color: '#97266d', name: 'Pink 700' },
    { color: '#702459', name: 'Pink 800' },
    { color: '#521b41', name: 'Pink 900' },
  ],
  gold: [
    { color: '#fffbeb', name: 'Amber 50' },
    { color: '#fef3c7', name: 'Amber 100' },
    { color: '#fde68a', name: 'Amber 200' },
    { color: '#fcd34d', name: 'Amber 300' },
    { color: '#fbbf24', name: 'Amber 400' },
    { color: '#f59e0b', name: 'Amber 500' },
    { color: '#d97706', name: 'Amber 600' },
    { color: '#b45309', name: 'Amber 700' },
    { color: '#92400e', name: 'Amber 800' },
    { color: '#78350f', name: 'Amber 900' },
  ],
};

// Quick access colors
const QUICK_COLORS = [
  '#ffffff', '#000000', '#ef4444', '#f97316', '#eab308', 
  '#22c55e', '#3b82f6', '#a855f7', '#ec4899', '#64748b'
];

interface ColorPickerProps {
  value: string;
  onChange: (color: string) => void;
  label?: string;
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
  showOpacity?: boolean;
  onPreviewColor?: (color: string | null) => void; // For live preview on hover
}

export function ColorPicker({ 
  value, 
  onChange, 
  label = 'Color',
  showLabel = true,
  size = 'md',
  showOpacity = false,
  onPreviewColor 
}: ColorPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [recentColors, setRecentColors] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<'presets' | 'recent'>('presets');
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });
  const [colorSelected, setColorSelected] = useState(false); // Track if a color was selected (clicked)
  const dropdownRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const colorInputRef = useRef<HTMLInputElement>(null);
  
  // Handle hover preview
  const handlePreviewEnter = useCallback((color: string) => {
    if (onPreviewColor && !colorSelected) {
      onPreviewColor(color);
    }
  }, [onPreviewColor, colorSelected]);

  const handlePreviewLeave = useCallback(() => {
    if (onPreviewColor && !colorSelected) {
      onPreviewColor(null);
    }
  }, [onPreviewColor, colorSelected]);

  // Load recent colors from localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const saved = localStorage.getItem(RECENT_COLORS_KEY);
      if (saved) {
        setRecentColors(JSON.parse(saved));
      }
    } catch (e) {
      console.warn('Failed to load recent colors:', e);
    }
  }, []);

  // Calculate dropdown position when opening
  const updateDropdownPosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const dropdownWidth = 320; // w-80 = 20rem = 320px
    const dropdownHeight = 400; // approximate height
    
    let left = rect.left;
    let top = rect.bottom + 8;
    
    // Ensure dropdown doesn't go off screen
    if (left + dropdownWidth > window.innerWidth) {
      left = window.innerWidth - dropdownWidth - 16;
    }
    if (left < 16) {
      left = 16;
    }
    if (top + dropdownHeight > window.innerHeight) {
      top = rect.top - dropdownHeight - 8;
    }
    
    setDropdownPosition({ top, left });
  }, []);

  // Save color to recent colors
  const addToRecentColors = useCallback((color: string) => {
    setRecentColors(prev => {
      // Remove if already exists to move to front
      const filtered = prev.filter(c => c.toLowerCase() !== color.toLowerCase());
      const updated = [color, ...filtered].slice(0, MAX_RECENT_COLORS);
      
      // Save to localStorage
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem(RECENT_COLORS_KEY, JSON.stringify(updated));
        } catch (e) {
          console.warn('Failed to save recent colors:', e);
        }
      }
      
      return updated;
    });
  }, []);

  // Handle color change (when user clicks to select)
  const handleColorChange = useCallback((color: string) => {
    setColorSelected(true); // Mark that a color was selected - don't restore on leave
    onChange(color);
    addToRecentColors(color);
    // Close dropdown after selection
    setIsOpen(false);
    // Reset flag after a short delay for next time
    setTimeout(() => setColorSelected(false), 100);
  }, [onChange, addToRecentColors]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node) &&
          triggerRef.current && !triggerRef.current.contains(event.target as Node)) {
        if (!colorSelected) {
          handlePreviewLeave(); // Restore original color before closing (only if not selected)
        }
        setIsOpen(false);
        setColorSelected(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, handlePreviewLeave, colorSelected]);

  const sizeClasses = {
    sm: 'w-6 h-6',
    md: 'w-8 h-8',
    lg: 'w-10 h-10',
  };

  return (
    <div className="relative">
      {/* Trigger Button */}
      <div className="flex items-center gap-2">
        {showLabel && (
          <span className="text-xs text-muted-foreground whitespace-nowrap">{label}:</span>
        )}
        <button
          ref={triggerRef}
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            if (isOpen) {
              if (!colorSelected) {
                handlePreviewLeave(); // Restore original color when closing (only if not selected)
              }
              setColorSelected(false);
            } else {
              updateDropdownPosition();
            }
            setIsOpen(!isOpen);
          }}
          onMouseDown={(e) => e.stopPropagation()}
          className={`relative ${sizeClasses[size]} rounded-lg border-2 border-border hover:border-primary/50 transition-all overflow-hidden group`}
          style={{ backgroundColor: value }}
          title={`${label}: ${value}`}
        >
          <span 
            className="absolute inset-0 ring-1 ring-inset ring-black/10" 
            style={{ backgroundColor: value }} 
          />
          <span className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/20">
            <ChevronDown className="w-3 h-3 text-white drop-shadow-md" />
          </span>
        </button>
        
        {/* Native color input (hidden, triggered programmatically) */}
        <input
          ref={colorInputRef}
          type="color"
          value={value}
          onChange={(e) => handleColorChange(e.target.value)}
          className="sr-only"
        />
        
        {/* Eye dropper button */}
        <button
          type="button"
          onClick={() => colorInputRef.current?.click()}
          className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          title="Pick custom color"
        >
          <Pipette className="w-4 h-4" />
        </button>
      </div>

      {/* Dropdown - Rendered with fixed position to escape parent overflow */}
      {isOpen && (
        <div 
          ref={dropdownRef}
          className="fixed z-[100] w-80 p-4 bg-white dark:bg-gray-900 border border-border rounded-xl shadow-2xl"
          style={{ top: dropdownPosition.top, left: dropdownPosition.left }}
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          onMouseLeave={handlePreviewLeave}
        >
          {/* Current Color Display */}
          <div className="flex items-center gap-3 mb-4 pb-3 border-b border-border">
            <div 
              className="w-14 h-14 rounded-lg border-2 border-border shadow-inner"
              style={{ backgroundColor: value }}
            />
            <div className="flex-1">
              <div className="text-sm font-semibold mb-1">{label}</div>
              <input
                type="text"
                value={value}
                onChange={(e) => {
                  const newValue = e.target.value;
                  if (/^#[0-9A-Fa-f]{0,6}$/.test(newValue)) {
                    if (newValue.length === 7) {
                      handleColorChange(newValue);
                    } else {
                      onChange(newValue); // Allow typing without adding to recent
                    }
                  }
                }}
                className="w-full px-2 py-1.5 text-xs font-mono bg-gray-100 dark:bg-gray-800 rounded border border-border focus:border-primary focus:outline-none uppercase"
                placeholder="#000000"
              />
            </div>
          </div>

          {/* Quick Colors */}
          <div className="mb-4">
            <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2">Quick Colors</div>
            <div className="flex flex-wrap gap-1.5">
              {QUICK_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => handleColorChange(color)}
                  onMouseEnter={() => handlePreviewEnter(color)}
                  onMouseLeave={handlePreviewLeave}
                  className={`w-7 h-7 rounded-lg border-2 transition-all hover:scale-110 ${
                    value.toLowerCase() === color.toLowerCase() 
                      ? 'border-primary ring-2 ring-primary/30 scale-110' 
                      : 'border-gray-200 dark:border-gray-700 hover:border-primary/50'
                  }`}
                  style={{ backgroundColor: color }}
                  title={color}
                >
                  {value.toLowerCase() === color.toLowerCase() && (
                    <Check className={`w-3 h-3 mx-auto ${color === '#ffffff' || color === '#fefce8' ? 'text-gray-800' : 'text-white'}`} />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 mb-3">
            <button
              type="button"
              onClick={() => setActiveTab('presets')}
              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg transition-colors ${
                activeTab === 'presets' 
                  ? 'bg-primary text-white' 
                  : 'bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300'
              }`}
            >
              <Palette className="w-3.5 h-3.5" />
              Palettes
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('recent')}
              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg transition-colors ${
                activeTab === 'recent' 
                  ? 'bg-primary text-white' 
                  : 'bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300'
              }`}
            >
              <History className="w-3.5 h-3.5" />
              Recent
            </button>
          </div>

          {/* Content */}
          <div className="max-h-52 overflow-y-auto custom-scrollbar pr-1">
            {activeTab === 'presets' ? (
              <div className="space-y-4">
                {Object.entries(COLOR_PRESETS).map(([category, colors]) => (
                  <div key={category}>
                    <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 capitalize mb-2">
                      {category}
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {colors.map(({ color, name }) => (
                        <button
                          key={color}
                          type="button"
                          onClick={() => handleColorChange(color)}
                          onMouseEnter={() => handlePreviewEnter(color)}
                          onMouseLeave={handlePreviewLeave}
                          className={`w-6 h-6 rounded-md border transition-all hover:scale-110 ${
                            value.toLowerCase() === color.toLowerCase() 
                              ? 'border-primary ring-2 ring-primary/30 scale-110' 
                              : 'border-gray-200 dark:border-gray-700 hover:border-primary/50'
                          }`}
                          style={{ backgroundColor: color }}
                          title={name}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div>
                {recentColors.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {recentColors.map((color, index) => (
                      <button
                        key={`${color}-${index}`}
                        type="button"
                        onClick={() => handleColorChange(color)}
                        onMouseEnter={() => handlePreviewEnter(color)}
                        onMouseLeave={handlePreviewLeave}
                        className={`w-9 h-9 rounded-lg border-2 transition-all hover:scale-110 ${
                          value.toLowerCase() === color.toLowerCase() 
                            ? 'border-primary ring-2 ring-primary/30 scale-110' 
                            : 'border-gray-200 dark:border-gray-700 hover:border-primary/50'
                        }`}
                        style={{ backgroundColor: color }}
                        title={color}
                      >
                        {value.toLowerCase() === color.toLowerCase() && (
                          <Check className={`w-4 h-4 mx-auto ${isLightColor(color) ? 'text-gray-800' : 'text-white'}`} />
                        )}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-sm text-gray-500 dark:text-gray-400">
                    No recent colors yet.
                    <br />
                    <span className="text-xs">Colors you use will appear here.</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Helper to determine if a color is light (for contrast)
function isLightColor(color: string): boolean {
  const hex = color.replace('#', '');
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5;
}

export default ColorPicker;
