/**
 * useFabric Hook - Core Canvas Management
 * 
 * Manages the Fabric.js canvas lifecycle with imperative control.
 * CRITICAL: Canvas state is managed via refs, NOT React state, to avoid
 * re-renders during high-frequency operations (dragging, resizing).
 * 
 * Zustand store is only updated for low-frequency UI updates (selection changes).
 * Auto-saves canvas state to localStorage to prevent data loss on refresh.
 */

'use client';

import { useEffect, useRef, useCallback, useMemo } from 'react';
import { fabric } from 'fabric';
import { useEditorStore } from '@/store/editorStore';
import { registerVariableTextbox, createVariableTextbox, isVariableTextbox } from './VariableTextbox';
import { registerQRCodeImageType } from './QRCodeImage';
import { debounce } from '@/lib/utils';

// Auto-save key for localStorage
const CANVAS_AUTOSAVE_KEY = 'serenity_canvas_autosave';

interface UseFabricOptions {
  /** Canvas width in pixels */
  width?: number;
  /** Canvas height in pixels */
  height?: number;
  /** Background color */
  backgroundColor?: string;
  /** Whether to enable selection */
  selection?: boolean;
  /** Callback when canvas is ready */
  onReady?: (canvas: fabric.Canvas) => void;
  /** Callback when an object is selected */
  onObjectSelected?: (obj: fabric.Object | null) => void;
  /** Callback when canvas is modified */
  onModified?: () => void;
}

// A4 Landscape dimensions at 72 DPI (screen)
export const A4_LANDSCAPE = {
  width: 842,  // 297mm at 72 DPI
  height: 595, // 210mm at 72 DPI
};

// High DPI multiplier for print quality (72 DPI -> 300 DPI)
export const HIGH_DPI_MULTIPLIER = 4.166;

export function useFabric(
  canvasRef: React.RefObject<HTMLCanvasElement>,
  options: UseFabricOptions = {}
) {
  const {
    width = A4_LANDSCAPE.width,
    height = A4_LANDSCAPE.height,
    backgroundColor = '#ffffff',
    selection = true,
    onReady,
    onObjectSelected,
    onModified,
  } = options;

  // Fabric canvas instance - stored in ref to avoid re-renders
  const fabricRef = useRef<fabric.Canvas | null>(null);
  
  // History tracking for undo/redo
  const historyRef = useRef<string[]>([]);
  const historyIndexRef = useRef<number>(-1);
  const isHistoryActionRef = useRef<boolean>(false);

  // Zustand store actions (only for low-frequency updates)
  const {
    setSelectedObject,
    setIsEditingText,
    setZoomLevel,
    pushHistory,
    setHistoryState,
  } = useEditorStore();

  /**
   * Initialize the canvas
   */
  useEffect(() => {
    if (!canvasRef.current || fabricRef.current) return;

    // Register custom classes
    registerVariableTextbox();
    registerQRCodeImageType();

    // Create the Fabric.js canvas
    const canvas = new fabric.Canvas(canvasRef.current, {
      width,
      height,
      backgroundColor,
      selection,
      preserveObjectStacking: true,
      stopContextMenu: true,
      fireRightClick: true,
    });

    fabricRef.current = canvas;

    // Check URL params to determine if we should restore from auto-save
    // If ?template= is in the URL, we'll load from API, so skip auto-restore
    // If creating a new template (no template param), clear the auto-save
    let isLoadingExistingTemplate = false;
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const templateIdFromUrl = urlParams.get('template');
      
      if (templateIdFromUrl) {
        // Loading existing template - clear auto-save and let API load handle it
        // Dev logging removed
        localStorage.removeItem(CANVAS_AUTOSAVE_KEY);
        isLoadingExistingTemplate = true;
      } else {
        // Creating new template - clear any stale auto-save data
        // Dev logging removed
        localStorage.removeItem(CANVAS_AUTOSAVE_KEY);
        isLoadingExistingTemplate = false;
      }
    }
    
    // Add outer shade area (red transparent) - shows what won't be visible
    const outerShade = new fabric.Rect({
      left: -50,
      top: -50,
      width: width + 100,
      height: height + 100,
      fill: 'rgba(220, 38, 38, 0.08)',
      selectable: false,
      evented: false,
      excludeFromExport: true,
      objectCaching: false,
    });
    (outerShade as any).isOuterShade = true;
    canvas.add(outerShade);
    
    // Add inner clear area (the actual certificate area)
    const innerClear = new fabric.Rect({
      left: 0,
      top: 0,
      width: width,
      height: height,
      fill: backgroundColor,
      selectable: false,
      evented: false,
      excludeFromExport: true,
      objectCaching: false,
    });
    (innerClear as any).isInnerClear = true;
    canvas.add(innerClear);
    innerClear.sendToBack();
    outerShade.sendToBack();
    
    // Add canvas boundary indicator - RED dashed line
    // Use strokeUniform to maintain consistent stroke width regardless of scale
    // Position with half stroke width offset to ensure full visibility
    const strokeWidth = 3;
    const boundaryRect = new fabric.Rect({
      left: strokeWidth / 2,
      top: strokeWidth / 2,
      width: width - strokeWidth,
      height: height - strokeWidth,
      fill: 'transparent',
      stroke: '#dc2626',
      strokeWidth: strokeWidth,
      strokeDashArray: [12, 6],
      strokeUniform: true,
      selectable: false,
      evented: false,
      excludeFromExport: true,
      objectCaching: false,
    });
    (boundaryRect as any).isBoundary = true;
    canvas.add(boundaryRect);
    canvas.requestRenderAll();
    
    // Add default verification URL tag ONLY for new canvas (not when loading existing template)
    if (!isLoadingExistingTemplate) {
      const verifyTextbox = new fabric.Textbox('{{VERIFICATION_URL}}', {
        left: width / 2,
        top: height - 25,
        originX: 'center',
        originY: 'center',
        width: 350,
        fontSize: 9,
        fontFamily: 'Courier New, monospace',
        fill: '#666666', // Neutral gray color - will be a clickable link in PDF
        textAlign: 'center',
        // Lock scaling/resizing but allow movement
        lockScalingX: true,
        lockScalingY: true,
        lockUniScaling: true,
        hasControls: false,
        hasBorders: true,
        borderColor: '#dc2626',
        borderDashArray: [4, 2],
        selectable: true,
        evented: true,
      } as fabric.ITextboxOptions);
      // Fix browser compatibility for textBaseline
      (verifyTextbox as any).textBaseline = 'alphabetic';
      // Mark as verification URL - cannot be deleted
      (verifyTextbox as any).isVerificationUrl = true;
      (verifyTextbox as any).isLocked = true;
      canvas.add(verifyTextbox);
    }

    // Set up event listeners INLINE to avoid hoisting issues
    // Selection events (low-frequency, update store)
    canvas.on('selection:created', (e) => {
      const selected = e.selected?.[0] || null;
      setSelectedObject(selected);
      onObjectSelected?.(selected);
    });

    canvas.on('selection:updated', (e) => {
      const selected = e.selected?.[0] || null;
      setSelectedObject(selected);
      onObjectSelected?.(selected);
    });

    canvas.on('selection:cleared', () => {
      setSelectedObject(null);
      onObjectSelected?.(null);
    });

    // Text editing events
    canvas.on('text:editing:entered', () => {
      setIsEditingText(true);
    });

    canvas.on('text:editing:exited', () => {
      setIsEditingText(false);
    });

    // Modification events - debounced to prevent spam
    const debouncedOnModified = debounce(() => {
      if (!isHistoryActionRef.current) {
        // Inline save to history
        if (fabricRef.current) {
          const json = JSON.stringify(fabricRef.current.toJSON(['dynamicKey', 'isPlaceholder', 'verificationId', 'isVerificationUrl', 'isClickableLink', 'isLocked']));
          historyRef.current = historyRef.current.slice(0, historyIndexRef.current + 1);
          historyRef.current.push(json);
          historyIndexRef.current = historyRef.current.length - 1;
          if (historyRef.current.length > 3) {
            historyRef.current.shift();
            historyIndexRef.current--;
          }
          const canUndoNow = historyIndexRef.current > 0;
          const canRedoNow = false; // After a new action, no redo available
          setHistoryState(canUndoNow, canRedoNow);
          // Auto-save to localStorage
          if (typeof window !== 'undefined') {
            try {
              const saveData = { canvasJSON: json, savedAt: new Date().toISOString() };
              localStorage.setItem(CANVAS_AUTOSAVE_KEY, JSON.stringify(saveData));
            } catch (e) {
              console.warn('Failed to auto-save:', e);
            }
          }
        }
      }
      onModified?.();
    }, 300);

    canvas.on('object:modified', debouncedOnModified);
    canvas.on('object:added', debouncedOnModified);
    canvas.on('object:removed', debouncedOnModified);

    // Helper function to constrain viewport to printable area
    const constrainViewport = () => {
      const vpt = canvas.viewportTransform;
      if (!vpt) return;
      
      const zoom = canvas.getZoom();
      const canvasEl = canvas.getElement();
      const canvasWidth = canvasEl?.clientWidth || width;
      const canvasHeight = canvasEl?.clientHeight || height;
      
      // Calculate the scaled dimensions of the printable area
      const scaledWidth = width * zoom;
      const scaledHeight = height * zoom;
      
      // If zoomed out or at 100%, center the canvas
      if (zoom <= 1.0) {
        vpt[4] = (canvasWidth - scaledWidth) / 2;
        vpt[5] = (canvasHeight - scaledHeight) / 2;
      } else {
        // When zoomed in, constrain panning to keep content visible
        const maxPanX = 0;
        const minPanX = canvasWidth - scaledWidth;
        const maxPanY = 0;
        const minPanY = canvasHeight - scaledHeight;
        
        vpt[4] = Math.min(maxPanX, Math.max(minPanX, vpt[4]));
        vpt[5] = Math.min(maxPanY, Math.max(minPanY, vpt[5]));
      }
    };

    // Zoom events - limit zoom to 100%-300% to keep content within print boundary
    canvas.on('mouse:wheel', (opt) => {
      const delta = opt.e.deltaY;
      let zoom = canvas.getZoom();
      zoom *= 0.999 ** delta;
      // Minimum zoom of 1.0 (100%) ensures content stays within print boundary
      // Maximum zoom of 3.0 (300%) for detailed editing
      zoom = Math.min(Math.max(1.0, zoom), 3.0);
      canvas.zoomToPoint({ x: opt.e.offsetX, y: opt.e.offsetY }, zoom);
      // Constrain viewport after zooming
      constrainViewport();
      canvas.requestRenderAll();
      setZoomLevel(zoom);
      opt.e.preventDefault();
      opt.e.stopPropagation();
    });

    // Panning with middle mouse button or Alt + drag
    let isPanning = false;
    let lastPosX = 0;
    let lastPosY = 0;

    canvas.on('mouse:down', (opt) => {
      const evt = opt.e as MouseEvent;
      // Middle mouse button (button === 1) or Alt key
      if (evt.button === 1 || evt.altKey) {
        isPanning = true;
        canvas.selection = false;
        lastPosX = evt.clientX;
        lastPosY = evt.clientY;
        canvas.setCursor('grabbing');
      }
    });

    canvas.on('mouse:move', (opt) => {
      if (isPanning) {
        const evt = opt.e as MouseEvent;
        const vpt = canvas.viewportTransform;
        if (vpt) {
          vpt[4] += evt.clientX - lastPosX;
          vpt[5] += evt.clientY - lastPosY;
          constrainViewport();
          canvas.requestRenderAll();
          lastPosX = evt.clientX;
          lastPosY = evt.clientY;
        }
      }
    });

    canvas.on('mouse:up', () => {
      if (isPanning) {
        isPanning = false;
        canvas.selection = true;
        canvas.setCursor('default');
        constrainViewport();
        canvas.requestRenderAll();
      }
    });

    setTimeout(() => {
      if (fabricRef.current) {
        const initialJson = JSON.stringify(fabricRef.current.toJSON(['dynamicKey', 'isPlaceholder', 'verificationId', 'isVerificationUrl', 'isClickableLink', 'isLocked']));
        historyRef.current = [initialJson];
        historyIndexRef.current = 0;
        setHistoryState(false, false); // Initial state: can't undo or redo
      }
    }, 100);

    // Notify that canvas is ready
    onReady?.(canvas);

    // Cleanup on unmount
    return () => {
      // Clear the ref before disposing to prevent any pending operations
      const canvasToDispose = fabricRef.current;
      fabricRef.current = null;
      if (canvasToDispose) {
        try {
          canvasToDispose.dispose();
        } catch (e) {
          console.warn('Error disposing canvas:', e);
        }
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canvasRef]);

  /**
   * Auto-save canvas state to localStorage
   */
  const autoSaveToLocalStorage = useCallback((json: string) => {
    if (typeof window === 'undefined') return;
    try {
      const saveData = {
        canvasJSON: json,
        savedAt: new Date().toISOString(),
      };
      localStorage.setItem(CANVAS_AUTOSAVE_KEY, JSON.stringify(saveData));
    } catch (e) {
      console.warn('Failed to auto-save canvas:', e);
    }
  }, []);

  /**
   * Save current canvas state to history
   */
  const saveToHistory = useCallback(() => {
    if (!fabricRef.current) return;

    const json = JSON.stringify(fabricRef.current.toJSON(['dynamicKey', 'isPlaceholder', 'verificationId', 'isVerificationUrl', 'isClickableLink', 'isLocked']));
    
    // Remove any redo states
    historyRef.current = historyRef.current.slice(0, historyIndexRef.current + 1);
    
    // Add new state
    historyRef.current.push(json);
    historyIndexRef.current = historyRef.current.length - 1;

    // Keep history manageable (max 3 states for quick undo/redo)
    if (historyRef.current.length > 3) {
      historyRef.current.shift();
      historyIndexRef.current--;
    }

    pushHistory(json);
    
    // Auto-save to localStorage
    autoSaveToLocalStorage(json);
  }, [pushHistory, autoSaveToLocalStorage]);

  /**
   * Restore canvas from auto-save in localStorage
   */
  const restoreFromAutoSave = useCallback((canvas: fabric.Canvas) => {
    if (typeof window === 'undefined') return;
    try {
      const saved = localStorage.getItem(CANVAS_AUTOSAVE_KEY);
      if (!saved) return;
      
      const saveData = JSON.parse(saved);
      if (!saveData.canvasJSON) return;
      
      const canvasData = JSON.parse(saveData.canvasJSON);
      canvas.loadFromJSON(canvasData, () => {
        canvas.requestRenderAll();
        console.log('Canvas restored from auto-save');
      });
    } catch (e) {
      console.warn('Failed to restore canvas from auto-save:', e);
    }
  }, []);

  /**
   * Clear auto-saved canvas (call when starting new design)
   */
  const clearAutoSave = useCallback(() => {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(CANVAS_AUTOSAVE_KEY);
  }, []);

  /**
   * Undo the last action
   */
  const undo = useCallback(() => {
    if (!fabricRef.current || historyIndexRef.current <= 0) return;

    isHistoryActionRef.current = true;
    historyIndexRef.current--;
    const state = historyRef.current[historyIndexRef.current];
    
    // Update store with new history state IMMEDIATELY (before async load)
    const canUndoNow = historyIndexRef.current > 0;
    const canRedoNow = historyIndexRef.current < historyRef.current.length - 1;
    setHistoryState(canUndoNow, canRedoNow);
    
    fabricRef.current.loadFromJSON(JSON.parse(state), () => {
      if (!fabricRef.current) return;
      
      // Re-add boundary elements (they are excluded from history via excludeFromExport)
      const hasOuterShade = fabricRef.current.getObjects().some((obj: any) => obj.isOuterShade);
      const hasInnerClear = fabricRef.current.getObjects().some((obj: any) => obj.isInnerClear);
      const hasBoundaryRect = fabricRef.current.getObjects().some((obj: any) => obj.isBoundary);
      
      if (!hasOuterShade) {
        const outerShadeRect = new fabric.Rect({
          left: -50,
          top: -50,
          width: width + 100,
          height: height + 100,
          fill: 'rgba(220, 38, 38, 0.08)',
          selectable: false,
          evented: false,
          excludeFromExport: true,
          objectCaching: false,
        });
        (outerShadeRect as any).isOuterShade = true;
        fabricRef.current.add(outerShadeRect);
        fabricRef.current.sendToBack(outerShadeRect);
      }
      
      if (!hasInnerClear) {
        const innerClearRect = new fabric.Rect({
          left: 0,
          top: 0,
          width: width,
          height: height,
          fill: backgroundColor,
          selectable: false,
          evented: false,
          excludeFromExport: true,
          objectCaching: false,
        });
        (innerClearRect as any).isInnerClear = true;
        fabricRef.current.add(innerClearRect);
        // Send to back but above outer shade
        const outerShade = fabricRef.current.getObjects().find((obj: any) => obj.isOuterShade);
        if (outerShade) {
          fabricRef.current.sendToBack(innerClearRect);
          fabricRef.current.sendToBack(outerShade);
        }
      }
      
      if (!hasBoundaryRect) {
        const strokeWidth = 3;
        const boundaryRect = new fabric.Rect({
          left: strokeWidth / 2,
          top: strokeWidth / 2,
          width: width - strokeWidth,
          height: height - strokeWidth,
          fill: 'transparent',
          stroke: '#dc2626',
          strokeWidth: strokeWidth,
          strokeDashArray: [12, 6],
          strokeUniform: true,
          selectable: false,
          evented: false,
          excludeFromExport: true,
          objectCaching: false,
        });
        (boundaryRect as any).isBoundary = true;
        fabricRef.current.add(boundaryRect);
      }
      
      fabricRef.current.requestRenderAll();
      
      // Delay resetting the flag longer than the debounce (300ms) to prevent trailing events
      setTimeout(() => {
        isHistoryActionRef.current = false;
      }, 400);
    });
  }, [width, height, backgroundColor, setHistoryState]);

  /**
   * Redo the last undone action
   */
  const redo = useCallback(() => {
    if (!fabricRef.current || historyIndexRef.current >= historyRef.current.length - 1) return;

    isHistoryActionRef.current = true;
    historyIndexRef.current++;
    const state = historyRef.current[historyIndexRef.current];
    
    // Update store with new history state IMMEDIATELY (before async load)
    const canUndoNow = historyIndexRef.current > 0;
    const canRedoNow = historyIndexRef.current < historyRef.current.length - 1;
    setHistoryState(canUndoNow, canRedoNow);
    
    fabricRef.current.loadFromJSON(JSON.parse(state), () => {
      if (!fabricRef.current) return;
      
      // Re-add boundary elements (they are excluded from history via excludeFromExport)
      const hasOuterShade = fabricRef.current.getObjects().some((obj: any) => obj.isOuterShade);
      const hasInnerClear = fabricRef.current.getObjects().some((obj: any) => obj.isInnerClear);
      const hasBoundaryRect = fabricRef.current.getObjects().some((obj: any) => obj.isBoundary);
      
      if (!hasOuterShade) {
        const outerShadeRect = new fabric.Rect({
          left: -50,
          top: -50,
          width: width + 100,
          height: height + 100,
          fill: 'rgba(220, 38, 38, 0.08)',
          selectable: false,
          evented: false,
          excludeFromExport: true,
          objectCaching: false,
        });
        (outerShadeRect as any).isOuterShade = true;
        fabricRef.current.add(outerShadeRect);
        fabricRef.current.sendToBack(outerShadeRect);
      }
      
      if (!hasInnerClear) {
        const innerClearRect = new fabric.Rect({
          left: 0,
          top: 0,
          width: width,
          height: height,
          fill: backgroundColor,
          selectable: false,
          evented: false,
          excludeFromExport: true,
          objectCaching: false,
        });
        (innerClearRect as any).isInnerClear = true;
        fabricRef.current.add(innerClearRect);
        // Send to back but above outer shade
        const outerShade = fabricRef.current.getObjects().find((obj: any) => obj.isOuterShade);
        if (outerShade) {
          fabricRef.current.sendToBack(innerClearRect);
          fabricRef.current.sendToBack(outerShade);
        }
      }
      
      if (!hasBoundaryRect) {
        const strokeWidth = 3;
        const boundaryRect = new fabric.Rect({
          left: strokeWidth / 2,
          top: strokeWidth / 2,
          width: width - strokeWidth,
          height: height - strokeWidth,
          fill: 'transparent',
          stroke: '#dc2626',
          strokeWidth: strokeWidth,
          strokeDashArray: [12, 6],
          strokeUniform: true,
          selectable: false,
          evented: false,
          excludeFromExport: true,
          objectCaching: false,
        });
        (boundaryRect as any).isBoundary = true;
        fabricRef.current.add(boundaryRect);
      }
      
      fabricRef.current.requestRenderAll();
      
      // Delay resetting the flag longer than the debounce (300ms) to prevent trailing events
      setTimeout(() => {
        isHistoryActionRef.current = false;
      }, 400);
    });
  }, [width, height, backgroundColor, setHistoryState]);

  /**
   * Add a text object to the canvas
   */
  const addText = useCallback((text: string = 'New Text', options?: fabric.ITextboxOptions) => {
    if (!fabricRef.current) return null;

    const textbox = new fabric.Textbox(text, {
      left: width / 2,
      top: height / 2,
      originX: 'center',
      originY: 'center',
      fontSize: 24,
      fontFamily: 'Arial',
      fill: '#000000',
      ...options,
    } as fabric.ITextboxOptions);
    // Fix browser compatibility for textBaseline
    (textbox as any).textBaseline = 'alphabetic';

    fabricRef.current.add(textbox);
    fabricRef.current.setActiveObject(textbox);
    fabricRef.current.requestRenderAll();

    return textbox;
  }, [width, height]);

  /**
   * Add a variable textbox (for data binding)
   */
  const addVariableTextbox = useCallback((dynamicKey: string, options?: fabric.ITextboxOptions) => {
    if (!fabricRef.current) return null;

    const textbox = createVariableTextbox(`{{${dynamicKey}}}`, {
      left: width / 2,
      top: height / 2,
      originX: 'center',
      originY: 'center',
      fontSize: 24,
      fontFamily: 'Arial',
      fill: '#000000',
      dynamicKey,
      isPlaceholder: true,
      ...options,
    });
    // Fix browser compatibility for textBaseline
    (textbox as any).textBaseline = 'alphabetic';

    fabricRef.current.add(textbox);
    fabricRef.current.setActiveObject(textbox);
    fabricRef.current.requestRenderAll();

    return textbox;
  }, [width, height]);

  /**
   * Add an image to the canvas
   */
  const addImage = useCallback((url: string, options?: fabric.IImageOptions): Promise<fabric.Image> => {
    return new Promise((resolve, reject) => {
      if (!fabricRef.current) {
        reject(new Error('Canvas not initialized'));
        return;
      }

      fabric.Image.fromURL(url, (img) => {
        if (!img) {
          reject(new Error('Failed to load image'));
          return;
        }

        // Scale image to fit within canvas if too large
        const maxWidth = width * 0.8;
        const maxHeight = height * 0.8;
        const scale = Math.min(
          maxWidth / (img.width || 1),
          maxHeight / (img.height || 1),
          1
        );

        img.set({
          left: width / 2,
          top: height / 2,
          originX: 'center',
          originY: 'center',
          scaleX: scale,
          scaleY: scale,
          ...options,
        });

        fabricRef.current?.add(img);
        fabricRef.current?.setActiveObject(img);
        fabricRef.current?.requestRenderAll();

        resolve(img);
      }, { crossOrigin: 'anonymous' });
    });
  }, [width, height]);

  /**
   * Add a shape to the canvas
   */
  const addShape = useCallback((type: 'rect' | 'circle' | 'triangle' | 'line' | 'star' | 'pentagon' | 'hexagon' | 'arrow' | 'dashedLine' | 'arrowLine' | 'roundedRect' | 'diamond', options?: fabric.IObjectOptions) => {
    if (!fabricRef.current) return null;

    let shape: fabric.Object;

    // Helper function to create polygon points
    const createPolygonPoints = (sides: number, radius: number) => {
      const points = [];
      const angleStep = (2 * Math.PI) / sides;
      for (let i = 0; i < sides; i++) {
        const angle = i * angleStep - Math.PI / 2; // Start from top
        points.push({
          x: radius * Math.cos(angle),
          y: radius * Math.sin(angle),
        });
      }
      return points;
    };

    // Helper function to create star points
    const createStarPoints = (points: number, outerRadius: number, innerRadius: number) => {
      const starPoints = [];
      const step = Math.PI / points;
      for (let i = 0; i < 2 * points; i++) {
        const radius = i % 2 === 0 ? outerRadius : innerRadius;
        const angle = i * step - Math.PI / 2;
        starPoints.push({
          x: radius * Math.cos(angle),
          y: radius * Math.sin(angle),
        });
      }
      return starPoints;
    };

    switch (type) {
      case 'rect':
        shape = new fabric.Rect({
          left: width / 2,
          top: height / 2,
          originX: 'center',
          originY: 'center',
          width: 100,
          height: 100,
          fill: '#3b82f6',
          ...options,
        });
        break;
      case 'roundedRect':
        shape = new fabric.Rect({
          left: width / 2,
          top: height / 2,
          originX: 'center',
          originY: 'center',
          width: 120,
          height: 80,
          rx: 15,
          ry: 15,
          fill: '#3b82f6',
          ...options,
        });
        break;
      case 'circle':
        shape = new fabric.Circle({
          left: width / 2,
          top: height / 2,
          originX: 'center',
          originY: 'center',
          radius: 50,
          fill: '#3b82f6',
          ...options,
        });
        break;
      case 'triangle':
        shape = new fabric.Triangle({
          left: width / 2,
          top: height / 2,
          originX: 'center',
          originY: 'center',
          width: 100,
          height: 100,
          fill: '#3b82f6',
          ...options,
        });
        break;
      case 'line':
        shape = new fabric.Line([0, 0, 150, 0], {
          left: width / 2 - 75,
          top: height / 2,
          stroke: '#3b82f6',
          strokeWidth: 2,
          strokeUniform: true,
          ...options,
        });
        break;
      case 'dashedLine':
        shape = new fabric.Line([0, 0, 150, 0], {
          left: width / 2 - 75,
          top: height / 2,
          stroke: '#3b82f6',
          strokeWidth: 2,
          strokeDashArray: [10, 5],
          strokeUniform: true,
          ...options,
        });
        break;
      case 'arrowLine':
        // Create an arrow using a path
        const arrowPath = 'M 0 25 L 120 25 M 100 10 L 120 25 L 100 40';
        shape = new fabric.Path(arrowPath, {
          left: width / 2 - 60,
          top: height / 2,
          stroke: '#3b82f6',
          strokeWidth: 3,
          fill: 'transparent',
          strokeLineCap: 'round',
          strokeLineJoin: 'round',
          ...options,
        });
        break;
      case 'star':
        const starPoints = createStarPoints(5, 50, 25);
        shape = new fabric.Polygon(starPoints, {
          left: width / 2,
          top: height / 2,
          originX: 'center',
          originY: 'center',
          fill: '#f59e0b',
          ...options,
        });
        break;
      case 'pentagon':
        const pentagonPoints = createPolygonPoints(5, 50);
        shape = new fabric.Polygon(pentagonPoints, {
          left: width / 2,
          top: height / 2,
          originX: 'center',
          originY: 'center',
          fill: '#3b82f6',
          ...options,
        });
        break;
      case 'hexagon':
        const hexagonPoints = createPolygonPoints(6, 50);
        shape = new fabric.Polygon(hexagonPoints, {
          left: width / 2,
          top: height / 2,
          originX: 'center',
          originY: 'center',
          fill: '#3b82f6',
          ...options,
        });
        break;
      case 'arrow':
        // Arrow shape pointing right
        const arrowPoints = [
          { x: 0, y: 20 },
          { x: 60, y: 20 },
          { x: 60, y: 0 },
          { x: 100, y: 30 },
          { x: 60, y: 60 },
          { x: 60, y: 40 },
          { x: 0, y: 40 },
        ];
        shape = new fabric.Polygon(arrowPoints, {
          left: width / 2,
          top: height / 2,
          originX: 'center',
          originY: 'center',
          fill: '#3b82f6',
          ...options,
        });
        break;
      case 'diamond':
        const diamondPoints = [
          { x: 50, y: 0 },
          { x: 100, y: 50 },
          { x: 50, y: 100 },
          { x: 0, y: 50 },
        ];
        shape = new fabric.Polygon(diamondPoints, {
          left: width / 2,
          top: height / 2,
          originX: 'center',
          originY: 'center',
          fill: '#3b82f6',
          ...options,
        });
        break;
      default:
        return null;
    }

    fabricRef.current.add(shape);
    fabricRef.current.setActiveObject(shape);
    fabricRef.current.requestRenderAll();

    return shape;
  }, [width, height]);

  /**
   * Utility function to restore the correct z-order of helper objects
   * Order should be: outerShade (back) -> innerClear -> boundaryRect -> user objects (front)
   */
  const restoreHelperOrder = useCallback(() => {
    if (!fabricRef.current) return;
    
    const canvas = fabricRef.current;
    const outerShade = canvas.getObjects().find((obj: any) => obj.isOuterShade);
    const innerClear = canvas.getObjects().find((obj: any) => obj.isInnerClear);
    const boundaryRect = canvas.getObjects().find((obj: any) => obj.isBoundary);
    
    // Send to back in reverse order (last one ends up at the very back)
    if (boundaryRect) canvas.sendToBack(boundaryRect);
    if (innerClear) canvas.sendToBack(innerClear);
    if (outerShade) canvas.sendToBack(outerShade);
  }, []);

  /**
   * Add a decorative border to the certificate
   */
  const addBorder = useCallback((style: 'simple' | 'double' | 'ornate' | 'gold' | 'corner', color: string = '#d4af37', options?: fabric.IObjectOptions) => {
    if (!fabricRef.current) return null;

    const padding = 20;
    const borderWidth = width - padding * 2;
    const borderHeight = height - padding * 2;
    let result: fabric.Object | null = null;

    switch (style) {
      case 'simple':
        const simpleBorder = new fabric.Rect({
          left: padding,
          top: padding,
          width: borderWidth,
          height: borderHeight,
          fill: 'transparent',
          stroke: color,
          strokeWidth: 3,
          ...options,
        });
        fabricRef.current.add(simpleBorder);
        result = simpleBorder;
        break;

      case 'double':
        const outerBorder = new fabric.Rect({
          left: padding,
          top: padding,
          width: borderWidth,
          height: borderHeight,
          fill: 'transparent',
          stroke: color,
          strokeWidth: 3,
          ...options,
        });
        const innerBorder = new fabric.Rect({
          left: padding + 10,
          top: padding + 10,
          width: borderWidth - 20,
          height: borderHeight - 20,
          fill: 'transparent',
          stroke: color,
          strokeWidth: 1,
          ...options,
        });
        const borderGroup = new fabric.Group([outerBorder, innerBorder], {
          left: padding,
          top: padding,
          ...options,
        });
        fabricRef.current.add(borderGroup);
        result = borderGroup;
        break;

      case 'ornate':
        const ornateOuter = new fabric.Rect({
          left: 0,
          top: 0,
          width: borderWidth,
          height: borderHeight,
          fill: 'transparent',
          stroke: color,
          strokeWidth: 4,
        });
        const ornateInner = new fabric.Rect({
          left: 8,
          top: 8,
          width: borderWidth - 16,
          height: borderHeight - 16,
          fill: 'transparent',
          stroke: color,
          strokeWidth: 1,
        });
        const ornateGroup = new fabric.Group([ornateOuter, ornateInner], {
          left: padding,
          top: padding,
          ...options,
        });
        fabricRef.current.add(ornateGroup);
        result = ornateGroup;
        break;

      case 'gold':
        const goldBorder = new fabric.Rect({
          left: padding,
          top: padding,
          width: borderWidth,
          height: borderHeight,
          fill: 'transparent',
          stroke: color,
          strokeWidth: 8,
          rx: 10,
          ry: 10,
          ...options,
        });
        fabricRef.current.add(goldBorder);
        result = goldBorder;
        break;

      case 'corner':
        const cornerSize = 40;
        const corners: fabric.Object[] = [];
        
        corners.push(new fabric.Path(`M 0 ${cornerSize} L 0 0 L ${cornerSize} 0`, {
          left: padding,
          top: padding,
          stroke: color,
          strokeWidth: 4,
          fill: 'transparent',
        }));
        
        corners.push(new fabric.Path(`M 0 0 L ${cornerSize} 0 L ${cornerSize} ${cornerSize}`, {
          left: padding + borderWidth - cornerSize,
          top: padding,
          stroke: color,
          strokeWidth: 4,
          fill: 'transparent',
        }));
        
        corners.push(new fabric.Path(`M 0 0 L 0 ${cornerSize} L ${cornerSize} ${cornerSize}`, {
          left: padding,
          top: padding + borderHeight - cornerSize,
          stroke: color,
          strokeWidth: 4,
          fill: 'transparent',
        }));
        
        corners.push(new fabric.Path(`M ${cornerSize} 0 L ${cornerSize} ${cornerSize} L 0 ${cornerSize}`, {
          left: padding + borderWidth - cornerSize,
          top: padding + borderHeight - cornerSize,
          stroke: color,
          strokeWidth: 4,
          fill: 'transparent',
        }));
        
        const cornerGroup = new fabric.Group(corners, {
          left: padding,
          top: padding,
          ...options,
        });
        fabricRef.current.add(cornerGroup);
        result = cornerGroup;
        break;
    }

    // Send the border to back (just above helper objects)
    if (result) {
      fabricRef.current.sendToBack(result);
    }
    
    // Restore correct order of helper objects
    restoreHelperOrder();
    
    fabricRef.current.requestRenderAll();
    return result;
  }, [width, height, restoreHelperOrder]);

  /**
   * Delete selected objects
   */
  const deleteSelected = useCallback(() => {
    if (!fabricRef.current) return;

    const activeObjects = fabricRef.current.getActiveObjects();
    if (activeObjects.length === 0) return;

    fabricRef.current.discardActiveObject();
    activeObjects.forEach((obj) => fabricRef.current?.remove(obj));
    fabricRef.current.requestRenderAll();
  }, []);

  /**
   * Clone selected object
   */
  const cloneSelected = useCallback(() => {
    if (!fabricRef.current) return;

    const activeObject = fabricRef.current.getActiveObject();
    if (!activeObject) return;

    activeObject.clone((cloned: fabric.Object) => {
      cloned.set({
        left: (cloned.left || 0) + 20,
        top: (cloned.top || 0) + 20,
      });
      fabricRef.current?.add(cloned);
      fabricRef.current?.setActiveObject(cloned);
      fabricRef.current?.requestRenderAll();
    }, ['dynamicKey', 'isPlaceholder', 'verificationId']);
  }, []);

  /**
   * Bring selected object to front
   */
  const bringToFront = useCallback(() => {
    if (!fabricRef.current) return;
    const activeObject = fabricRef.current.getActiveObject();
    if (activeObject) {
      fabricRef.current.bringToFront(activeObject);
      fabricRef.current.requestRenderAll();
    }
  }, []);

  /**
   * Send selected object to back
   */
  const sendToBack = useCallback(() => {
    if (!fabricRef.current) return;
    const activeObject = fabricRef.current.getActiveObject();
    if (activeObject) {
      fabricRef.current.sendToBack(activeObject);
      fabricRef.current.requestRenderAll();
    }
  }, []);

  /**
   * Export canvas to JSON
   */
  const toJSON = useCallback(() => {
    if (!fabricRef.current) return null;
    const json = fabricRef.current.toJSON(['dynamicKey', 'isPlaceholder', 'verificationId', 'isBoundary', 'isVerificationUrl', 'isClickableLink', 'isLocked']);
    // Filter out boundary objects and fix invalid textBaseline values
    if (json.objects) {
      json.objects = json.objects.filter((obj: any) => !obj.isBoundary);
      // Fix Fabric.js 'alphabetic' vs 'alphabetical' textBaseline issue
      json.objects = json.objects.map((obj: any) => {
        if (obj.textBaseline === 'alphabetical') {
          obj.textBaseline = 'alphabetic';
        }
        return obj;
      });
    }
    return json;
  }, []);

  /**
   * Load canvas from JSON
   */
  const loadFromJSON = useCallback((json: string | object): Promise<void> => {
    return new Promise((resolve) => {
      if (!fabricRef.current) {
        resolve();
        return;
      }

      const data = typeof json === 'string' ? JSON.parse(json) : json;
      
      // Fix textBaseline issue in loaded templates (Fabric.js uses 'alphabetical' but browsers expect 'alphabetic')
      if (data.objects) {
        data.objects = data.objects.map((obj: any) => {
          if (obj.textBaseline === 'alphabetical') {
            obj.textBaseline = 'alphabetic';
          }
          return obj;
        });
      }
      
      fabricRef.current.loadFromJSON(data, () => {
        if (fabricRef.current) {
          // Re-apply verification URL properties to ensure they persist
          const objects = fabricRef.current.getObjects();
          let hasVerificationUrl = false;
          
          objects.forEach((obj: any) => {
            if (obj.isVerificationUrl) {
              hasVerificationUrl = true;
              obj.set({
                lockScalingX: true,
                lockScalingY: true,
                lockUniScaling: true,
                hasControls: false,
                hasBorders: true,
                borderColor: '#dc2626',
                borderDashArray: [4, 2],
                cornerColor: '#dc2626',
              });
            }
            // Fix textBaseline for any remaining objects
            if (obj.textBaseline === 'alphabetical') {
              obj.set({ textBaseline: 'alphabetic' });
            }
          });
          
          // Add verification URL if not present (for old templates)
          if (!hasVerificationUrl) {
            const verifyTextbox = new fabric.Textbox('{{VERIFICATION_URL}}', {
              left: width / 2,
              top: height - 25,
              originX: 'center',
              originY: 'center',
              width: 350,
              fontSize: 9,
              fontFamily: 'Courier New, monospace',
              fill: '#666666',
              textAlign: 'center',
              lockScalingX: true,
              lockScalingY: true,
              lockUniScaling: true,
              hasControls: false,
              hasBorders: true,
              borderColor: '#dc2626',
              borderDashArray: [4, 2],
              selectable: true,
              evented: true,
            } as fabric.ITextboxOptions);
            (verifyTextbox as any).textBaseline = 'alphabetic';
            (verifyTextbox as any).isVerificationUrl = true;
            (verifyTextbox as any).isLocked = true;
            fabricRef.current.add(verifyTextbox);
          }
          
          // Re-add helper objects after loading (they get removed by loadFromJSON due to excludeFromExport)
          
          // Get canvas background color from loaded JSON or use default
          const canvasBgColor = data.background || backgroundColor;
          
          // 1. Outer shade (red transparent overlay outside printable area)
          const outerShadeRect = new fabric.Rect({
            left: -50,
            top: -50,
            width: width + 100,
            height: height + 100,
            fill: 'rgba(220, 38, 38, 0.08)',
            selectable: false,
            evented: false,
            excludeFromExport: true,
            objectCaching: false,
          });
          (outerShadeRect as any).isOuterShade = true;
          fabricRef.current.add(outerShadeRect);
          fabricRef.current.sendToBack(outerShadeRect);
          
          // 2. Inner clear (the certificate background - covers the red shade in printable area)
          const innerClearRect = new fabric.Rect({
            left: 0,
            top: 0,
            width: width,
            height: height,
            fill: canvasBgColor,
            selectable: false,
            evented: false,
            excludeFromExport: true,
            objectCaching: false,
          });
          (innerClearRect as any).isInnerClear = true;
          fabricRef.current.add(innerClearRect);
          fabricRef.current.sendToBack(innerClearRect);
          // Ensure outer shade is behind inner clear
          fabricRef.current.sendToBack(outerShadeRect);
          
          // 3. Boundary rect (red dashed line showing print boundary)
          const strokeWidth = 3;
          const boundaryRect = new fabric.Rect({
            left: strokeWidth / 2,
            top: strokeWidth / 2,
            width: width - strokeWidth,
            height: height - strokeWidth,
            fill: 'transparent',
            stroke: '#dc2626',
            strokeWidth: strokeWidth,
            strokeDashArray: [12, 6],
            strokeUniform: true,
            selectable: false,
            evented: false,
            excludeFromExport: true,
            objectCaching: false,
          });
          (boundaryRect as any).isBoundary = true;
          fabricRef.current.add(boundaryRect);
          
          fabricRef.current.requestRenderAll();
        }
        saveToHistory();
        resolve();
      });
    });
  }, [saveToHistory, width, height]);

  /**
   * Export canvas to high-DPI data URL for PDF generation
   */
  const toHighDPIDataURL = useCallback((multiplier: number = HIGH_DPI_MULTIPLIER): string => {
    if (!fabricRef.current) return '';
    
    // Temporarily hide boundary for export
    const objects = fabricRef.current.getObjects();
    const boundaryObjects = objects.filter((obj: any) => obj.isBoundary);
    boundaryObjects.forEach((obj: fabric.Object) => obj.set('visible', false));
    
    const dataUrl = fabricRef.current.toDataURL({
      format: 'png',
      quality: 1,
      multiplier,
    });
    
    // Restore boundary visibility
    boundaryObjects.forEach((obj: fabric.Object) => obj.set('visible', true));
    fabricRef.current.requestRenderAll();
    
    return dataUrl;
  }, []);

  /**
   * Clear the canvas
   */
  const clear = useCallback(() => {
    if (!fabricRef.current) return;
    fabricRef.current.clear();
    fabricRef.current.backgroundColor = backgroundColor;
    
    // 1. Re-add the outer shade rect after clearing
    const outerShadeRect = new fabric.Rect({
      left: -50,
      top: -50,
      width: width + 100,
      height: height + 100,
      fill: 'rgba(220, 38, 38, 0.08)',
      selectable: false,
      evented: false,
      excludeFromExport: true,
      objectCaching: false,
    });
    (outerShadeRect as any).isOuterShade = true;
    fabricRef.current.add(outerShadeRect);
    fabricRef.current.sendToBack(outerShadeRect);
    
    // 2. Re-add the inner clear rect (certificate background)
    const innerClearRect = new fabric.Rect({
      left: 0,
      top: 0,
      width: width,
      height: height,
      fill: backgroundColor,
      selectable: false,
      evented: false,
      excludeFromExport: true,
      objectCaching: false,
    });
    (innerClearRect as any).isInnerClear = true;
    fabricRef.current.add(innerClearRect);
    fabricRef.current.sendToBack(innerClearRect);
    fabricRef.current.sendToBack(outerShadeRect);
    
    // 3. Re-add the boundary rect after clearing
    const strokeWidth = 3;
    const boundaryRect = new fabric.Rect({
      left: strokeWidth / 2,
      top: strokeWidth / 2,
      width: width - strokeWidth,
      height: height - strokeWidth,
      fill: 'transparent',
      stroke: '#dc2626',
      strokeWidth: strokeWidth,
      strokeDashArray: [12, 6],
      strokeUniform: true,
      selectable: false,
      evented: false,
      excludeFromExport: true,
      objectCaching: false,
    });
    (boundaryRect as any).isBoundary = true;
    fabricRef.current.add(boundaryRect);
    
    fabricRef.current.requestRenderAll();
    saveToHistory();
  }, [backgroundColor, saveToHistory, width, height]);

  /**
   * Set canvas background color
   * Updates both the canvas background and the inner clear rect
   */
  const setBackgroundColor = useCallback((color: string) => {
    if (!fabricRef.current) return;
    
    // Update the canvas background color
    fabricRef.current.backgroundColor = color;
    
    // Update the inner clear rect if it exists
    const innerClear = fabricRef.current.getObjects().find((obj: any) => obj.isInnerClear);
    if (innerClear) {
      innerClear.set('fill', color);
    }
    
    fabricRef.current.requestRenderAll();
    saveToHistory();
  }, [saveToHistory]);

  /**
   * Get current canvas background color
   */
  const getBackgroundColor = useCallback((): string => {
    if (!fabricRef.current) return backgroundColor;
    return (fabricRef.current.backgroundColor as string) || backgroundColor;
  }, [backgroundColor]);

  /**
   * Set background image
   */
  const setBackgroundImage = useCallback((url: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      if (!fabricRef.current) {
        reject(new Error('Canvas not initialized'));
        return;
      }

      fabric.Image.fromURL(url, (img) => {
        if (!img) {
          reject(new Error('Failed to load background image'));
          return;
        }

        // Scale to fit canvas
        const scaleX = width / (img.width || 1);
        const scaleY = height / (img.height || 1);

        fabricRef.current?.setBackgroundImage(img, () => {
          fabricRef.current?.requestRenderAll();
          resolve();
        }, {
          scaleX,
          scaleY,
        });
      }, { crossOrigin: 'anonymous' });
    });
  }, [width, height]);

  /**
   * Get the canvas instance (for advanced usage)
   */
  const getCanvas = useCallback(() => fabricRef.current, []);

  /**
   * Check if object is a variable textbox
   */
  const isVariable = useCallback((obj: fabric.Object) => isVariableTextbox(obj), []);

  // Memoize the return value to prevent infinite re-renders in consumers
  return useMemo(() => ({
    // Canvas ref
    canvas: fabricRef.current,
    getCanvas,
    
    // Object manipulation
    addText,
    addVariableTextbox,
    addImage,
    addShape,
    addBorder,
    deleteSelected,
    cloneSelected,
    bringToFront,
    sendToBack,
    
    // History
    undo,
    redo,
    
    // Serialization
    toJSON,
    loadFromJSON,
    toHighDPIDataURL,
    
    // Canvas operations
    clear,
    setBackgroundImage,
    setBackgroundColor,
    getBackgroundColor,
    clearAutoSave,
    
    // Utilities
    isVariable,
  }), [
    getCanvas,
    addText,
    addVariableTextbox,
    addImage,
    addShape,
    addBorder,
    deleteSelected,
    cloneSelected,
    bringToFront,
    sendToBack,
    undo,
    redo,
    toJSON,
    loadFromJSON,
    toHighDPIDataURL,
    clear,
    setBackgroundImage,
    setBackgroundColor,
    getBackgroundColor,
    clearAutoSave,
    isVariable,
  ]);
}

export type UseFabricReturn = ReturnType<typeof useFabric>;
