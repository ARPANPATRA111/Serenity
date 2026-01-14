'use client';

/**
 * FabricCanvasWrapper - Core Canvas Component
 * 
 * Wraps the Fabric.js canvas with React integration.
 * CRITICAL: Uses refs for canvas state, NOT React state.
 */

import { useRef, useEffect, useState, useCallback } from 'react';
import { useFabric, A4_LANDSCAPE, createVariableTextbox } from '@/lib/fabric';
import { useFabricContext } from './FabricContext';
import { useEditorStore } from '@/store/editorStore';

export function FabricCanvasWrapper() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [isDragOver, setIsDragOver] = useState(false);
  const initRef = useRef(false);
  
  const { setFabricInstance } = useFabricContext();
  const { zoomLevel, isPreviewMode } = useEditorStore();

  const fabricHook = useFabric(canvasRef, {
    width: A4_LANDSCAPE.width,
    height: A4_LANDSCAPE.height,
    backgroundColor: '#ffffff',
  });

  // Set fabric instance when hook is ready
  useEffect(() => {
    if (fabricHook && fabricHook.getCanvas() && !initRef.current) {
      initRef.current = true;
      setFabricInstance(fabricHook);
      // Dev logging removed
    }
  }, [fabricHook, setFabricInstance]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Dev logging removed
      initRef.current = false;
      setFabricInstance(null);
    };
  }, [setFabricInstance]);

  // Calculate scale to fit canvas in container
  useEffect(() => {
    const updateScale = () => {
      if (!containerRef.current) return;

      const containerWidth = containerRef.current.clientWidth - 64; // padding
      const containerHeight = containerRef.current.clientHeight - 64;

      const scaleX = containerWidth / A4_LANDSCAPE.width;
      const scaleY = containerHeight / A4_LANDSCAPE.height;
      const newScale = Math.min(scaleX, scaleY, 1);

      setScale(newScale);
    };

    updateScale();
    window.addEventListener('resize', updateScale);
    return () => window.removeEventListener('resize', updateScale);
  }, []);

  // Handle drag and drop
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);

    const variable = e.dataTransfer.getData('variable');
    if (!variable) return;

    const canvas = fabricHook?.getCanvas();
    if (!canvas) return;

    // Calculate drop position relative to canvas
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    // Account for the scale transform
    const dropX = (e.clientX - rect.left) / scale;
    const dropY = (e.clientY - rect.top) / scale;

    // Create variable textbox at drop position
    const textbox = createVariableTextbox(`{{${variable}}}`, {
      left: Math.max(50, Math.min(dropX, A4_LANDSCAPE.width - 50)),
      top: Math.max(30, Math.min(dropY, A4_LANDSCAPE.height - 30)),
      originX: 'center',
      originY: 'center',
      fontSize: 24,
      fontFamily: 'Arial',
      fill: '#000000',
      dynamicKey: variable,
      isPlaceholder: true,
    });

    canvas.add(textbox);
    canvas.setActiveObject(textbox);
    canvas.requestRenderAll();
  }, [fabricHook, scale]);

  return (
    <div
      ref={containerRef}
      className={`canvas-container flex h-full w-full items-center justify-center overflow-auto p-8 ${
        isPreviewMode ? 'bg-emerald-500/5' : 'bg-muted/30'
      }`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className="relative">
        <div
          className={`fabric-canvas-container relative shadow-2xl border-2 rounded-lg transition-all ${
            isDragOver ? 'border-primary ring-4 ring-primary/20' : isPreviewMode ? 'border-emerald-500 ring-2 ring-emerald-500/20' : 'border-border'
          }`}
          style={{
            transform: `scale(${scale})`,
            transformOrigin: 'center center',
          }}
        >
          <canvas ref={canvasRef} />
          
          {/* Drop overlay */}
          {isDragOver && !isPreviewMode && (
            <div className="absolute inset-0 bg-primary/10 flex items-center justify-center pointer-events-none z-10">
              <div className="bg-primary text-white px-4 py-2 rounded-lg font-medium">
                Drop variable here
              </div>
            </div>
          )}
          
          {/* Preview Mode overlay */}
          {isPreviewMode && (
            <div className="absolute top-2 right-2 bg-emerald-500 text-white px-2 py-1 rounded text-xs font-medium z-10">
              Preview Mode
            </div>
          )}
        </div>
        
        {/* Canvas info indicator */}
        <div className="absolute -bottom-10 left-0 right-0 text-center">
          <span className="text-xs text-muted-foreground bg-background px-2 py-1 rounded">
            A4 Landscape ({A4_LANDSCAPE.width} × {A4_LANDSCAPE.height}px) | 
            <span className="text-red-500 ml-1">Red dashed line = Print boundary</span> | 
            Zoom: {Math.round(zoomLevel * 100)}%
          </span>
        </div>
        
        {/* Keyboard shortcuts hint */}
        <div className="absolute -bottom-20 left-0 right-0 text-center">
          <span className="text-[10px] text-muted-foreground/70 bg-background/50 px-2 py-1 rounded">
            <span className="font-medium">Shortcuts:</span>{' '}
            <span className="text-blue-500">Ctrl+S</span> Save |{' '}
            <span className="text-blue-500">Ctrl+Z</span> Undo |{' '}
            <span className="text-blue-500">Ctrl+Y</span> Redo |{' '}
            <span className="text-blue-500">Ctrl+Q</span> Preview |{' '}
            <span className="text-blue-500">Alt+Drag</span> Pan |{' '}
            <span className="text-blue-500">Del</span> Delete
          </span>
        </div>
      </div>
    </div>
  );
}
