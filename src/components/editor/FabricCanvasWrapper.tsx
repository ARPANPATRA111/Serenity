'use client';

import { useRef, useEffect, useState, useCallback } from 'react';
import { useFabric, A4_LANDSCAPE, createVariableTextbox } from '@/lib/fabric';
import { useFabricContext } from './FabricContext';
import { useEditorStore } from '@/store/editorStore';
import { ZoomIn, ZoomOut, Maximize2, RotateCcw, Smartphone } from 'lucide-react';

export function FabricCanvasWrapper() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [manualZoom, setManualZoom] = useState(1);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isLandscape, setIsLandscape] = useState(true);
  const [showMobileHint, setShowMobileHint] = useState(true);
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

  // Detect mobile and orientation
  useEffect(() => {
    const checkMobileAndOrientation = () => {
      const isMobileDevice = window.innerWidth < 768 || ('ontouchstart' in window);
      const isLandscapeOrientation = window.innerWidth > window.innerHeight;
      setIsMobile(isMobileDevice);
      setIsLandscape(isLandscapeOrientation);
    };

    checkMobileAndOrientation();
    window.addEventListener('resize', checkMobileAndOrientation);
    window.addEventListener('orientationchange', checkMobileAndOrientation);
    return () => {
      window.removeEventListener('resize', checkMobileAndOrientation);
      window.removeEventListener('orientationchange', checkMobileAndOrientation);
    };
  }, []);

  // Calculate scale to fit canvas in container (with extra padding for boundary visibility)
  useEffect(() => {
    const updateScale = () => {
      if (!containerRef.current) return;

      // Less padding on mobile for more canvas space
      const padding = isMobile ? 40 : 120;
      const containerWidth = containerRef.current.clientWidth - padding;
      const containerHeight = containerRef.current.clientHeight - padding;

      const scaleX = containerWidth / A4_LANDSCAPE.width;
      const scaleY = containerHeight / A4_LANDSCAPE.height;
      const baseScale = Math.min(scaleX, scaleY, isMobile ? 1 : 0.9);

      setScale(baseScale);
    };

    updateScale();
    window.addEventListener('resize', updateScale);
    return () => window.removeEventListener('resize', updateScale);
  }, [isMobile]);

  // Combined scale with manual zoom
  const effectiveScale = scale * manualZoom;

  // Mobile zoom controls
  const handleZoomIn = useCallback(() => {
    setManualZoom(prev => Math.min(prev + 0.25, 3));
  }, []);

  const handleZoomOut = useCallback(() => {
    setManualZoom(prev => Math.max(prev - 0.25, 0.5));
  }, []);

  const handleResetZoom = useCallback(() => {
    setManualZoom(1);
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

    // Account for the scale transform (including manual zoom)
    const dropX = (e.clientX - rect.left) / effectiveScale;
    const dropY = (e.clientY - rect.top) / effectiveScale;

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
  }, [fabricHook, effectiveScale]);

  return (
    <div
      ref={containerRef}
      className={`canvas-container flex h-full w-full items-center justify-center overflow-auto ${isMobile ? 'p-4' : 'p-12'} ${
        isPreviewMode ? 'bg-emerald-500/5' : 'bg-muted/30'
      }`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Mobile Landscape Hint */}
      {isMobile && !isLandscape && showMobileHint && (
        <div className="fixed top-16 left-4 right-4 z-50 bg-amber-500/90 text-white rounded-lg p-3 shadow-lg animate-in fade-in slide-in-from-top duration-300">
          <div className="flex items-center gap-3">
            <Smartphone className="h-5 w-5 flex-shrink-0 rotate-90" />
            <div className="flex-1 text-sm">
              <p className="font-medium">Rotate for better editing</p>
              <p className="text-xs opacity-90">Landscape mode works better for A4 certificates</p>
            </div>
            <button 
              onClick={() => setShowMobileHint(false)}
              className="text-white/80 hover:text-white text-xl leading-none"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* Mobile Zoom Controls */}
      {isMobile && (
        <div className="fixed bottom-20 right-4 z-40 flex flex-col gap-2">
          <button
            onClick={handleZoomIn}
            className="p-3 bg-card border border-border rounded-full shadow-lg hover:bg-muted transition-colors"
            title="Zoom in"
          >
            <ZoomIn className="h-5 w-5" />
          </button>
          <button
            onClick={handleZoomOut}
            className="p-3 bg-card border border-border rounded-full shadow-lg hover:bg-muted transition-colors"
            title="Zoom out"
          >
            <ZoomOut className="h-5 w-5" />
          </button>
          {manualZoom !== 1 && (
            <button
              onClick={handleResetZoom}
              className="p-3 bg-card border border-border rounded-full shadow-lg hover:bg-muted transition-colors"
              title="Reset zoom"
            >
              <RotateCcw className="h-4 w-4" />
            </button>
          )}
          <span className="text-[10px] text-center text-muted-foreground bg-background/80 px-1 rounded">
            {Math.round(manualZoom * 100)}%
          </span>
        </div>
      )}

      <div className="relative">
        <div
          className={`fabric-canvas-container relative shadow-2xl border-2 rounded-lg transition-all ${
            isDragOver ? 'border-primary ring-4 ring-primary/20' : isPreviewMode ? 'border-emerald-500 ring-2 ring-emerald-500/20' : 'border-border'
          }`}
          style={{
            transform: `scale(${effectiveScale})`,
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
        
        {/* Canvas info indicator - Simplified on mobile */}
        <div className={`absolute ${isMobile ? '-bottom-6' : '-bottom-10'} left-0 right-0 text-center`}>
          <span className={`${isMobile ? 'text-[10px]' : 'text-xs'} text-muted-foreground bg-background px-2 py-1 rounded`}>
            {isMobile ? (
              <>A4 Landscape | Zoom: {Math.round(manualZoom * 100)}%</>
            ) : (
              <>
                A4 Landscape ({A4_LANDSCAPE.width} × {A4_LANDSCAPE.height}px) | 
                <span className="text-red-500 ml-1">Red dashed line = Print boundary</span> | 
                Zoom: {Math.round(zoomLevel * 100)}%
              </>
            )}
          </span>
        </div>
        
        {/* Keyboard shortcuts hint - Hidden on mobile */}
        {!isMobile && (
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
        )}
      </div>
    </div>
  );
}
