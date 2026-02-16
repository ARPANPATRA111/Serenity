'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { FabricCanvasWrapper } from './FabricCanvasWrapper';
import { Toolbar } from './Toolbar';
import { PropertiesBar } from './PropertiesBar';
import { LeftSidebarTabs } from './LeftSidebarTabs';
import { RightSidebar } from './RightSidebar';
import { GenerationModal } from './GenerationModal';
import { CertificateInfoModal } from './CertificateInfoModal';
import { useEditorStore } from '@/store/editorStore';
import { useDataSourceStore } from '@/store/dataSourceStore';
import { useFabricContext } from './FabricContext';
import { useAuth } from '@/contexts/AuthContext';
import { useSearchParams } from 'next/navigation';
import { Loader2, AlertCircle, X, PanelLeftOpen, PanelRightOpen, Palette, Database } from 'lucide-react';

export function EditorLayout() {
  const { leftSidebarOpen, rightSidebarOpen, setLeftSidebarOpen, setRightSidebarOpen } = useEditorStore();
  const [leftSidebarWidth, setLeftSidebarWidth] = useState(256); // Default 256px (w-64)
  const [rightSidebarWidth, setRightSidebarWidth] = useState(288); // Default 288px (w-72)
  const [isResizingLeft, setIsResizingLeft] = useState(false);
  const [isResizingRight, setIsResizingRight] = useState(false);
  const [generationModalOpen, setGenerationModalOpen] = useState(false);
  const [certificateInfoModalOpen, setCertificateInfoModalOpen] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [saveErrorMessage, setSaveErrorMessage] = useState<string | null>(null);
  const [loadingTemplate, setLoadingTemplate] = useState(false);
  const hasLoadedTemplate = useRef(false);
  
  // Mobile drawer states
  const [mobileLeftDrawerOpen, setMobileLeftDrawerOpen] = useState(false);
  const [mobileRightDrawerOpen, setMobileRightDrawerOpen] = useState(false);

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
  const { templateId, templateName, isDirty, isEditingText, setTemplateName, setTemplateInfo, setIsDirty, certificateMetadata, setCertificateMetadata, reset: resetEditorStore } = useEditorStore();
  const { dataSource } = useDataSourceStore();
  const { fabricInstance } = useFabricContext();
  const { user } = useAuth();

  // Track which template was last loaded
  const lastLoadedTemplateId = useRef<string | null>(null);

  // Reset store when creating a new template (no template param in URL)
  useEffect(() => {
    const paramTemplateId = searchParams?.get('template');
    // Only reset when:
    // 1. No template param AND
    // 2. We previously had a template loaded (or first load)
    if (!paramTemplateId && lastLoadedTemplateId.current !== 'NEW') {
      resetEditorStore();
      setTemplateInfo(null, 'Untitled Template');
      lastLoadedTemplateId.current = 'NEW';
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

            // Load certificate metadata if available, otherwise reset to defaults
            if (data.template.certificateMetadata) {
              setCertificateMetadata(data.template.certificateMetadata);
            } else {
              // Reset to defaults if template has no metadata
              setCertificateMetadata({ title: '', issuedBy: '', description: '' });
            }
            
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
  }, [searchParams, fabricInstance, setTemplateInfo, setTemplateName, setIsDirty, setCertificateMetadata, user?.id]);


  // Handle Save - returns { success, error } for consumers like GenerationModal
  const handleSave = useCallback(async (): Promise<{ success: boolean; error?: string }> => {
    if (!fabricInstance || !user) return { success: false, error: 'Not ready' };
    
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
          userId: user.id,
          certificateMetadata,
          category: certificateMetadata.category,
        }),
      });
      
      const data = await res.json();
      
      if (data.success) {
        setSaveStatus('saved');
        setIsDirty(false);
        setSaveErrorMessage(null);
        // Check both data.id and data.template?.id for new templates
        const newTemplateId = data.id || data.template?.id;
        if (newTemplateId && !templateId) {
          setTemplateInfo(newTemplateId, templateName);
          // Update URL without reload
          window.history.pushState({}, '', `/editor?template=${newTemplateId}`);
        }
        setTimeout(() => setSaveStatus('idle'), 2000);
        return { success: true };
      } else {
        setSaveStatus('error');
        const errorMsg = data.error || 'Failed to save template';
        setSaveErrorMessage(errorMsg);
        return { success: false, error: errorMsg };
      }
    } catch (e) {
      console.error('Save failed', e);
      setSaveStatus('error');
      const errorMsg = 'An unexpected error occurred while saving';
      setSaveErrorMessage(errorMsg);
      return { success: false, error: errorMsg };
    }
  }, [fabricInstance, user, templateId, templateName, certificateMetadata, setTemplateInfo, setIsDirty]);

  return (
    <div className="flex h-screen flex-col bg-background overflow-hidden">
      {/* Top Toolbar - Scrollable on small screens */}
      <div className="min-w-0 flex-shrink-0">
        <Toolbar 
          onSave={handleSave} 
          saveStatus={saveStatus}
          onGenerate={() => setGenerationModalOpen(true)}
          onOpenCertificateInfo={() => setCertificateInfoModalOpen(true)}
        />
      </div>

      {/* Main Content Area */}
      <div className="flex flex-1 overflow-hidden relative min-h-0">
        {/* Left Sidebar - Hidden on small screens */}
        {leftSidebarOpen && (
          <div 
            className="hidden md:block border-r border-border bg-card z-10 relative flex-shrink-0"
            style={{ width: leftSidebarWidth }}
          >
             <LeftSidebarTabs />
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

        {/* Right Sidebar (Data Sources) - Hidden on small screens */}
        {rightSidebarOpen && (
          <div 
            className="hidden lg:block border-l border-border bg-card z-10 relative flex-shrink-0"
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

        {/* Mobile Left Drawer Overlay */}
        {mobileLeftDrawerOpen && (
          <div className="fixed inset-0 z-50 md:hidden">
            <div 
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
              onClick={() => setMobileLeftDrawerOpen(false)}
            />
            <div className="absolute left-0 top-0 bottom-0 w-[280px] bg-card border-r border-border animate-in slide-in-from-left duration-300">
              <div className="flex items-center justify-between p-3 border-b border-border">
                <span className="font-semibold text-sm">Tools & Media</span>
                <button 
                  onClick={() => setMobileLeftDrawerOpen(false)}
                  className="p-1 rounded-lg hover:bg-muted"
                  title="Close"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="h-[calc(100%-49px)] overflow-hidden">
                <LeftSidebarTabs />
              </div>
            </div>
          </div>
        )}

        {/* Mobile Right Drawer Overlay */}
        {mobileRightDrawerOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <div 
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
              onClick={() => setMobileRightDrawerOpen(false)}
            />
            <div className="absolute right-0 top-0 bottom-0 w-[300px] bg-card border-l border-border animate-in slide-in-from-right duration-300">
              <div className="flex items-center justify-between p-3 border-b border-border">
                <span className="font-semibold text-sm">Data Sources</span>
                <button 
                  onClick={() => setMobileRightDrawerOpen(false)}
                  className="p-1 rounded-lg hover:bg-muted"
                  title="Close"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="h-[calc(100%-49px)] overflow-hidden">
                <RightSidebar />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Mobile Bottom Toolbar */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-card/95 backdrop-blur-sm safe-area-bottom">
        <div className="flex items-center justify-around py-2 px-4">
          <button
            onClick={() => setMobileLeftDrawerOpen(true)}
            className="flex flex-col items-center gap-1 p-2 rounded-lg hover:bg-muted transition-colors"
            title="Tools & Media"
          >
            <Palette className="h-5 w-5" />
            <span className="text-[10px] text-muted-foreground">Tools</span>
          </button>
          <button
            onClick={() => setMobileRightDrawerOpen(true)}
            className="flex flex-col items-center gap-1 p-2 rounded-lg hover:bg-muted transition-colors"
            title="Data Sources"
          >
            <Database className="h-5 w-5" />
            <span className="text-[10px] text-muted-foreground">Data</span>
          </button>
        </div>
      </div>

      {/* Generation Modal */}
      <GenerationModal
        isOpen={generationModalOpen}
        onClose={() => setGenerationModalOpen(false)}
        onSave={handleSave}
      />

      <CertificateInfoModal
        isOpen={certificateInfoModalOpen}
        onClose={() => setCertificateInfoModalOpen(false)}
      />

      {/* Save Error Toast */}
      {saveErrorMessage && (
        <div className="fixed bottom-16 md:bottom-4 right-4 z-50 animate-in slide-in-from-bottom-2 fade-in duration-300">
          <div className="flex items-start gap-3 bg-destructive/10 border border-destructive/30 text-destructive rounded-lg p-4 shadow-lg max-w-md">
            <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-medium text-sm">Save Failed</p>
              <p className="text-sm mt-1 opacity-90">{saveErrorMessage}</p>
            </div>
            <button
              onClick={() => setSaveErrorMessage(null)}
              className="flex-shrink-0 p-1 hover:bg-destructive/20 rounded transition-colors"
              title="Dismiss"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
