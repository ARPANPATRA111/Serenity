'use client';

/**
 * EditorLayout - Main Editor Component
 * 
 * Assembles the complete editor interface:
 * - Toolbar (top)
 * - Left Sidebar (tools, templates)
 * - Canvas Area (center)
 * - Right Sidebar (properties, data)
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { FabricCanvasWrapper } from './FabricCanvasWrapper';
import { Toolbar } from './Toolbar';
import { PropertiesBar } from './PropertiesBar';
import { LeftSidebar } from './LeftSidebar';
import { RightSidebar } from './RightSidebar';
import { GenerationModal } from './GenerationModal';
import { useEditorStore } from '@/store/editorStore';
import { useDataSourceStore } from '@/store/dataSourceStore';
import { useFabricContext } from './FabricContext';
import { useAuth } from '@/contexts/AuthContext';
import { useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';

export function EditorLayout() {
  const { leftSidebarOpen, rightSidebarOpen, setLeftSidebarOpen, setRightSidebarOpen } = useEditorStore();
  const [leftSidebarWidth, setLeftSidebarWidth] = useState(256); // Default 256px (w-64)
  const [rightSidebarWidth, setRightSidebarWidth] = useState(288); // Default 288px (w-72)
  const [isResizingLeft, setIsResizingLeft] = useState(false);
  const [isResizingRight, setIsResizingRight] = useState(false);
  const [generationModalOpen, setGenerationModalOpen] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [loadingTemplate, setLoadingTemplate] = useState(false);
  const hasLoadedTemplate = useRef(false);

  // Resizable sidebar handlers
  const handleLeftResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizingLeft(true);
  }, []);

  const handleRightResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizingRight(true);
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isResizingLeft) {
        const newWidth = Math.min(Math.max(200, e.clientX), 400);
        setLeftSidebarWidth(newWidth);
      }
      if (isResizingRight) {
        const newWidth = Math.min(Math.max(240, window.innerWidth - e.clientX), 480);
        setRightSidebarWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsResizingLeft(false);
      setIsResizingRight(false);
    };

    if (isResizingLeft || isResizingRight) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizingLeft, isResizingRight]);

  const searchParams = useSearchParams();
  const { templateId, templateName, isDirty, isEditingText, setTemplateName, setTemplateInfo, setIsDirty, reset: resetEditorStore } = useEditorStore();
  const { dataSource } = useDataSourceStore();
  const { fabricInstance } = useFabricContext();
  const { user } = useAuth();
  const hasResetForNewTemplate = useRef(false);

  // Track which template was last loaded
  const lastLoadedTemplateId = useRef<string | null>(null);

  // Reset store when creating a new template
  useEffect(() => {
    const paramTemplateId = searchParams?.get('template');
    if (!paramTemplateId && !hasResetForNewTemplate.current) {
      resetEditorStore();
      setTemplateInfo(null, 'Untitled Template');
      hasResetForNewTemplate.current = true;
    }
  }, [searchParams, resetEditorStore, setTemplateInfo]);

  // Load template from API
  useEffect(() => {
    const paramTemplateId = searchParams?.get('template');
    
    if (paramTemplateId && paramTemplateId !== lastLoadedTemplateId.current && fabricInstance && user?.id) {
      setLoadingTemplate(true);
      lastLoadedTemplateId.current = paramTemplateId;
      
      fetch(`/api/templates/${paramTemplateId}`)
        .then(res => res.json())
        .then(data => {
          if (data.success && data.template) {
            // Check ownership - if not owner, set templateId to null (Copy Mode)
            const isOwner = data.template.userId === user.id;
            
            if (isOwner) {
              setTemplateInfo(data.template.id, data.template.name);
            } else {
              setTemplateInfo(null, `Copy of ${data.template.name}`);
            }
            
            setTemplateName(isOwner ? data.template.name : `Copy of ${data.template.name}`);
            
            if (data.template.canvasJSON) {
              try {
                fabricInstance.loadFromJSON(data.template.canvasJSON).then(() => {
                   // Clean up selection after load
                   fabricInstance.getCanvas()?.discardActiveObject();
                   fabricInstance.getCanvas()?.requestRenderAll();
                   setIsDirty(false);
                   hasLoadedTemplate.current = true;
                }).catch(e => {
                   console.error('Failed to load template', e);
                });
              } catch (e) {
                console.error('Failed to parse template JSON', e);
              }
            }
          }
        })
        .catch(err => {
          console.error('Failed to load template', err);
        })
        .finally(() => {
          setLoadingTemplate(false);
        });
    }
  }, [searchParams, fabricInstance, setTemplateInfo, setTemplateName, setIsDirty, user?.id]);


  // Handle Save
  const handleSave = useCallback(async () => {
    if (!fabricInstance || !user) return;
    
    setSaveStatus('saving');
    
    try {
      const json = fabricInstance.toJSON();
      const canvasJSON = JSON.stringify(json);
      const thumbnailRef = fabricInstance.getCanvas()?.toDataURL({ format: 'png', multiplier: 0.5 });
      
      const method = templateId ? 'PUT' : 'POST';
      const url = templateId ? `/api/templates/${templateId}` : '/api/templates';
      
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: templateName,
          canvasJSON,
          thumbnail: thumbnailRef,
          userId: user.id, // Ensure userId is passed
        }),
      });
      
      const data = await res.json();
      
      if (data.success) {
        setSaveStatus('saved');
        setIsDirty(false);
        // Check both data.id and data.template?.id for new templates
        const newTemplateId = data.id || data.template?.id;
        if (newTemplateId && !templateId) {
          setTemplateInfo(newTemplateId, templateName);
          // Update URL without reload
          window.history.pushState({}, '', `/editor?template=${newTemplateId}`);
        }
        setTimeout(() => setSaveStatus('idle'), 2000);
      } else {
        setSaveStatus('error');
      }
    } catch (e) {
      console.error('Save failed', e);
      setSaveStatus('error');
    }
  }, [fabricInstance, user, templateId, templateName, setTemplateInfo, setIsDirty]);

  return (
    <div className="flex h-screen flex-col bg-background overflow-hidden">
      {/* Top Toolbar */}
      <Toolbar 
        onSave={handleSave} 
        saveStatus={saveStatus}
        onGenerate={() => setGenerationModalOpen(true)}
      />

      {/* Main Content Area */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* Left Sidebar */}
        {leftSidebarOpen && (
          <div 
            className="border-r border-border bg-card z-10 relative"
            style={{ width: leftSidebarWidth }}
          >
             <LeftSidebar />
             {/* Resize Handle */}
             <div 
               className="absolute right-0 top-0 h-full w-1 cursor-col-resize opacity-0 hover:bg-primary/50 hover:opacity-100 transition-opacity"
               onMouseDown={handleLeftResizeStart}
             />
          </div>
        )}

        {/* Center Canvas Area */}
        <div className="flex-1 flex flex-col relative overflow-hidden bg-dot-pattern">
          {/* Properties Bar (Top of Canvas) */}
          <PropertiesBar />

          {/* Canvas Wrapper */}
          <div className="flex-1 relative overflow-hidden">
             {loadingTemplate && (
                <div className="absolute inset-0 z-50 flex items-center justify-center bg-background/50 backdrop-blur-sm">
                   <div className="flex flex-col items-center gap-2">
                     <Loader2 className="h-8 w-8 animate-spin text-primary" />
                     <span className="text-sm text-muted-foreground">Loading Template...</span>
                   </div>
                </div>
             )}
             <FabricCanvasWrapper />
          </div>
        </div>

        {/* Right Sidebar (Data Sources) */}
        {rightSidebarOpen && (
          <div 
            className="border-l border-border bg-card z-10 relative"
            style={{ width: rightSidebarWidth }}
          >
             {/* Resize Handle */}
             <div 
               className="absolute left-0 top-0 h-full w-1 cursor-col-resize opacity-0 hover:bg-primary/50 hover:opacity-100 transition-opacity"
               onMouseDown={handleRightResizeStart}
               style={{ transform: 'translateX(-50%)' }}
             />
             <RightSidebar />
          </div>
        )}
      </div>

      {/* Generation Modal */}
      <GenerationModal
        isOpen={generationModalOpen}
        onClose={() => setGenerationModalOpen(false)}
        onSave={handleSave}
      />
    </div>
  );
}
