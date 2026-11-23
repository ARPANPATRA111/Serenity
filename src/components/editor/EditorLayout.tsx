'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import { FabricCanvasWrapper } from './FabricCanvasWrapper';
import { Toolbar } from './Toolbar';
import { PropertiesBar } from './PropertiesBar';
import { LeftSidebarTabs } from './LeftSidebarTabs';
import { RightSidebar } from './RightSidebar';
import { useEditorStore } from '@/store/editorStore';
import { useDataSourceStore } from '@/store/dataSourceStore';
import { useFabricContext } from './FabricContext';
import { useAuth } from '@/contexts/AuthContext';
import { authenticatedFetch } from '@/lib/api/authFetch';
import { validateTemplateInvariants } from '@/lib/fabric/templateInvariants';
import { draftKey, readDraft, removeDraft, shouldOfferDraft, type Draft } from '@/lib/editor/drafts';
import { exportCanvasImage } from '@/lib/fabric/exportQuality';
import { A4_LANDSCAPE } from '@/lib/fabric/useFabric';
import { useSearchParams } from 'next/navigation';
import { Loader2, AlertCircle, X, PanelLeftOpen, PanelRightOpen, Palette, Database } from 'lucide-react';

const GenerationModal = dynamic(
  () => import('./GenerationModal').then((module) => module.GenerationModal),
  { ssr: false },
);
const CertificateInfoModal = dynamic(
  () => import('./CertificateInfoModal').then((module) => module.CertificateInfoModal),
  { ssr: false },
);

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
  // Saving or generating before the template is on the canvas would use a
  // half-loaded design; the ref also guards the Ctrl+S shortcut.
  const templateLoadingRef = useRef(false);
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

  // Unsaved-design drafts (see lib/editor/drafts.ts), scoped to this account
  // and design. A newer draft than the saved design is offered, never applied
  // without a choice.
  const activeDraftKeyRef = useRef<string | null>(null);
  const [draftOffer, setDraftOffer] = useState<{ key: string; draft: Draft } | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const startDraftTracking = useCallback((key: string, savedAt: string | null) => {
    if (!fabricInstance) return;
    activeDraftKeyRef.current = key;
    fabricInstance.setDraftKey(key);
    const draft = readDraft(key);
    setDraftOffer(shouldOfferDraft(draft, fabricInstance.serializeForDraft(), savedAt) ? { key, draft } : null);
  }, [fabricInstance]);

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

  // Load a saved template. The request starts as soon as the template ID and
  // the signed-in user are known, while the canvas is still starting; the
  // design is drawn once both are ready. Only the newest request is applied.
  type FetchedTemplate = { requestedId: string; template: any };
  const [fetchedTemplate, setFetchedTemplate] = useState<FetchedTemplate | null>(null);
  const [templateLoadError, setTemplateLoadError] = useState<string | null>(null);
  const [templateLoadAttempt, setTemplateLoadAttempt] = useState(0);
  const templateRequestRef = useRef(0);
  const paramTemplateId = searchParams?.get('template') || null;

  useEffect(() => {
    if (!paramTemplateId || !user?.id) return;
    if (paramTemplateId === lastLoadedTemplateId.current) return;
    const request = ++templateRequestRef.current;
    setLoadingTemplate(true);
    templateLoadingRef.current = true;
    setTemplateLoadError(null);
    setFetchedTemplate(null);

    authenticatedFetch(`/api/templates/${paramTemplateId}`)
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (request !== templateRequestRef.current) return;
        if (!res.ok || !data.success || !data.template) {
          throw new Error(res.status === 404 || res.status === 403
            ? 'This template does not exist or is not shared with you.'
            : data.error || 'The template could not be loaded.');
        }
        setFetchedTemplate({ requestedId: paramTemplateId, template: data.template });
      })
      .catch((err) => {
        if (request !== templateRequestRef.current) return;
        console.error('Failed to load template', err);
        setTemplateLoadError(err instanceof Error ? err.message : 'The template could not be loaded.');
        setLoadingTemplate(false);
        // Saving or generating stays blocked: the canvas is not this design.
        templateLoadingRef.current = true;
      });
  }, [paramTemplateId, user?.id, templateLoadAttempt]);

  useEffect(() => {
    if (!fetchedTemplate || !fabricInstance || !user?.id) return;
    if (fetchedTemplate.requestedId !== paramTemplateId) return;
    const { template } = fetchedTemplate;
    setFetchedTemplate(null);

    // Check ownership - if not owner, set templateId to null (Copy Mode)
    const isOwner = template.userId === user.id;
    setTemplateInfo(isOwner ? template.id : null, isOwner ? template.name : `Copy of ${template.name}`);
    setTemplateName(isOwner ? template.name : `Copy of ${template.name}`);
    setCertificateMetadata(template.certificateMetadata
      || { title: '', issuedBy: '', description: '', category: undefined, eventId: undefined });

    const finish = (error?: unknown) => {
      if (error) {
        console.error('Failed to draw template', error);
        setTemplateLoadError('The design could not be drawn. Retry, or start a new design.');
        templateLoadingRef.current = true;
      } else {
        // Recorded only after success, so a failure can be retried.
        lastLoadedTemplateId.current = fetchedTemplate.requestedId;
        hasLoadedTemplate.current = true;
        templateLoadingRef.current = false;
        setIsDirty(false);
        setLastSavedAt(isOwner ? template.updatedAt || null : null);
        // Drafts of a copy are kept apart from drafts of the owner's design.
        startDraftTracking(draftKey(user.id, isOwner ? template.id : `copy-of-${template.id}`), isOwner ? template.updatedAt : null);
      }
      setLoadingTemplate(false);
    };

    if (!template.canvasJSON) {
      finish();
      return;
    }
    fabricInstance.loadFromJSON(template.canvasJSON)
      .then(() => {
        fabricInstance.getCanvas()?.discardActiveObject();
        fabricInstance.getCanvas()?.requestRenderAll();
        finish();
      })
      .catch(finish);
  }, [fetchedTemplate, fabricInstance, paramTemplateId, user?.id, setTemplateInfo, setTemplateName, setIsDirty, setCertificateMetadata, startDraftTracking]);

  const retryTemplateLoad = useCallback(() => {
    lastLoadedTemplateId.current = null;
    setTemplateLoadError(null);
    setTemplateLoadAttempt((attempt) => attempt + 1);
  }, []);

  // A blank new design keeps drafts under this account's "new" key.
  useEffect(() => {
    if (paramTemplateId || !fabricInstance || !user?.id) return;
    startDraftTracking(draftKey(user.id, null), null);
  }, [paramTemplateId, fabricInstance, user?.id, startDraftTracking]);

  // Leaving with unsaved changes asks first. A draft is also kept, but the
  // browser prompt is the only warning before work is replaced by navigation.
  useEffect(() => {
    if (!isDirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [isDirty]);

  const restoreDraft = useCallback(async () => {
    if (!draftOffer || !fabricInstance) return;
    const offer = draftOffer;
    setDraftOffer(null);
    try {
      await fabricInstance.loadFromJSON(offer.draft.canvasJSON);
      setIsDirty(true);
    } catch (error) {
      console.error('Draft could not be restored', error);
      setSaveErrorMessage('The draft could not be restored. Your saved design is unchanged.');
    }
  }, [draftOffer, fabricInstance, setIsDirty]);

  const discardDraft = useCallback(() => {
    if (draftOffer) removeDraft(draftOffer.key);
    setDraftOffer(null);
  }, [draftOffer]);


  // Handle Save - returns { success, error } for consumers like GenerationModal
  const handleSave = useCallback(async (): Promise<{ success: boolean; error?: string }> => {
    if (!fabricInstance || !user || templateLoadingRef.current) return { success: false, error: 'Not ready' };
    // Preview puts a recipient's values on the canvas; saving then would store
    // them in the reusable template and its thumbnail.
    if (useEditorStore.getState().isPreviewMode) {
      return { success: false, error: 'Exit Preview before saving.' };
    }

    setSaveStatus('saving');
    
    try {
      const json = fabricInstance.toJSON();
      const invariantResult = validateTemplateInvariants(json);
      if (!invariantResult.valid) {
        const errorMsg = invariantResult.errors.join(' ');
        setSaveStatus('error');
        setSaveErrorMessage(errorMsg);
        return { success: false, error: errorMsg };
      }
      const canvasJSON = JSON.stringify(json);
      // The certificate area only, without the editor's print-boundary guide
      // or the current zoom; JPEG keeps the template document small.
      const editorCanvas = fabricInstance.getCanvas();
      const thumbnailRef = editorCanvas
        ? exportCanvasImage(editorCanvas, { format: 'jpeg', quality: 0.85, multiplier: 0.5, width: A4_LANDSCAPE.width, height: A4_LANDSCAPE.height })
        : undefined;
      
      const method = templateId ? 'PUT' : 'POST';
      const url = templateId ? `/api/templates/${templateId}` : '/api/templates';

      const send = async (name: string) => {
        const response = await authenticatedFetch(url, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name,
            canvasJSON,
            thumbnail: thumbnailRef,
            userId: user.id,
            certificateMetadata,
            category: certificateMetadata.category,
          }),
        });
        return response.json();
      };

      let savedName = templateName;
      let data = await send(savedName);
      // A new template (including a copy of a gallery template opened again)
      // takes the next free name instead of failing; renaming an existing
      // template to a taken name still reports the conflict.
      for (let attempt = 2; !templateId && data.code === 'DUPLICATE_NAME' && attempt <= 20; attempt += 1) {
        savedName = `${templateName} (${attempt})`;
        data = await send(savedName);
      }
      if (savedName !== templateName && data.success) setTemplateName(savedName);

      if (data.success) {
        setSaveStatus('saved');
        setIsDirty(false);
        setSaveErrorMessage(null);
        setLastSavedAt(new Date().toISOString());
        setDraftOffer(null);
        // The saved design replaces its draft.
        if (activeDraftKeyRef.current) removeDraft(activeDraftKeyRef.current);
        // Check both data.id and data.template?.id for new templates
        const newTemplateId = data.id || data.template?.id;
        if (newTemplateId && !templateId) {
          setTemplateInfo(newTemplateId, savedName);
          // Drafts of the design continue under its new ID.
          const key = draftKey(user.id, newTemplateId);
          activeDraftKeyRef.current = key;
          fabricInstance.setDraftKey(key);
          // Already on the canvas: the URL change below must not load it again.
          lastLoadedTemplateId.current = newTemplateId;
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
  }, [fabricInstance, user, templateId, templateName, certificateMetadata, setTemplateInfo, setTemplateName, setIsDirty]);

  return (
    <div className="flex h-screen flex-col bg-background overflow-hidden">
      {/* Top Toolbar - Scrollable on small screens */}
      <div className="min-w-0 flex-shrink-0">
        <Toolbar 
          onSave={handleSave} 
          saveStatus={saveStatus}
          isTemplateLoading={loadingTemplate || !!templateLoadError}
          lastSavedAt={lastSavedAt}
          isDirty={isDirty}
          onGenerate={() => setGenerationModalOpen(true)}
          onOpenData={() => {
            // The data sidebar exists at desktop widths; smaller screens use the drawer.
            if (window.matchMedia('(min-width: 1024px)').matches) setRightSidebarOpen(true);
            else setMobileRightDrawerOpen(true);
            requestAnimationFrame(() => {
              const upload = Array.from(document.querySelectorAll<HTMLElement>('[data-roster-upload]'))
                .find((element) => element.offsetParent !== null);
              upload?.focus();
            });
          }}
          onOpenCertificateInfo={() => setCertificateInfoModalOpen(true)}
        />
      </div>

      {/* Main Content Area */}
      {/* Bottom padding keeps the canvas clear of the phone/tablet toolbar. */}
      <div className="flex flex-1 overflow-hidden relative min-h-0 pb-[60px] lg:pb-0">
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

          {draftOffer && (
            <div role="status" className="flex flex-wrap items-center justify-between gap-2 border-b border-warning/30 bg-warning/10 px-4 py-2 text-sm">
              <span>
                Unsaved changes to this design from{' '}
                {new Date(draftOffer.draft.savedAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })} were found in this browser.
              </span>
              <span className="flex gap-2">
                <button type="button" onClick={() => void restoreDraft()} className="rounded-md bg-primary px-3 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90">
                  Restore changes
                </button>
                <button type="button" onClick={discardDraft} className="rounded-md border border-border bg-card px-3 py-1 text-xs font-medium hover:bg-muted">
                  Discard
                </button>
              </span>
            </div>
          )}

          {/* Canvas Wrapper */}
          <div className="flex-1 relative overflow-hidden">
             {templateLoadError && (
                <div className="absolute inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm">
                  <div role="alert" className="max-w-sm rounded-xl border border-border bg-card p-5 text-center shadow-lg">
                    <p className="font-semibold">This template could not be opened</p>
                    <p className="mt-1 text-sm text-muted-foreground">{templateLoadError} Saving and generating are paused so nothing overwrites it.</p>
                    <div className="mt-4 flex justify-center gap-2">
                      <button type="button" onClick={retryTemplateLoad} className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
                        Retry
                      </button>
                      <a href="/editor" className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted">
                        New design
                      </a>
                    </div>
                  </div>
                </div>
             )}
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
                  title="Close" aria-label="Close tools and media"
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
                  title="Close" aria-label="Close data sources"
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

      {/* Phone and tablet bottom toolbar. The data sidebar only appears at
          desktop widths (lg), so tablets need the Data button as well; the
          tools sidebar appears from md, so Tools is phone-only. */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-card/95 backdrop-blur-sm safe-area-bottom">
        <div className="flex items-center justify-around py-2 px-4">
          <button
            onClick={() => setMobileLeftDrawerOpen(true)}
            className="flex flex-col items-center gap-1 p-2 rounded-lg hover:bg-muted transition-colors md:hidden"
            title="Tools & Media"
            aria-label="Tools and media"
          >
            <Palette className="h-5 w-5" />
            <span className="text-[10px] text-muted-foreground">Tools</span>
          </button>
          <button
            onClick={() => setMobileRightDrawerOpen(true)}
            className="flex flex-col items-center gap-1 p-2 rounded-lg hover:bg-muted transition-colors"
            title="Data Sources"
            aria-label="Data sources: import a spreadsheet and map fields"
          >
            <Database className="h-5 w-5" />
            <span className="text-[10px] text-muted-foreground">Data</span>
          </button>
        </div>
      </div>

      {/* Generation Modal */}
      {generationModalOpen && (
        <GenerationModal
          onEditInfo={() => {
            setGenerationModalOpen(false);
            setCertificateInfoModalOpen(true);
          }}
          isOpen
          onClose={() => setGenerationModalOpen(false)}
          onSave={handleSave}
        />
      )}

      {certificateInfoModalOpen && (
        <CertificateInfoModal
          isOpen
          onClose={() => setCertificateInfoModalOpen(false)}
        />
      )}

      {/* Save Error Toast */}
      {saveErrorMessage && (
        <div className="fixed bottom-16 lg:bottom-4 right-4 z-50 animate-in slide-in-from-bottom-2 fade-in duration-300">
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
