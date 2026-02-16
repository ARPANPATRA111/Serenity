import { create } from 'zustand';
import { fabric } from 'fabric';

export interface MediaAsset {
  id: string;
  userId: string;
  name: string;
  url: string;
  type: string;
  size: number;
  uploadedAt: string;
  storagePath: string;
}

export interface CertificateMetadata {
  title: string;
  issuedBy: string;
  description: string;
  category?: string;
}

export type LeftSidebarTab = 'media' | 'colors' | 'effects';

export interface EditorState {
  selectedObject: fabric.Object | null;
  selectedObjectType: string | null;
  isEditingText: boolean;
  zoomLevel: number;
  canvasDimensions: { width: number; height: number };
  leftSidebarOpen: boolean;
  rightSidebarOpen: boolean;
  leftSidebarTab: LeftSidebarTab;
  historyIndex: number;
  historyLength: number;
  canUndo: boolean;
  canRedo: boolean;
  clipboard: fabric.Object | null;
  templateId: string | null;
  templateName: string;
  isDirty: boolean;
  isPreviewMode: boolean;
  previewData: Record<string, string> | null;
  mediaAssets: MediaAsset[];
  isLoadingMedia: boolean;
  isUploadingMedia: boolean;
  certificateMetadata: CertificateMetadata;
  setSelectedObject: (obj: fabric.Object | null) => void;
  setIsEditingText: (editing: boolean) => void;
  setZoomLevel: (zoom: number) => void;
  setCanvasDimensions: (dims: { width: number; height: number }) => void;
  setLeftSidebarOpen: (open: boolean) => void;
  setRightSidebarOpen: (open: boolean) => void;
  setLeftSidebarTab: (tab: LeftSidebarTab) => void;
  pushHistory: (json: string) => void;
  setHistoryState: (canUndo: boolean, canRedo: boolean) => void;
  setClipboard: (obj: fabric.Object | null) => void;
  setTemplateInfo: (id: string | null, name: string) => void;
  setTemplateName: (name: string) => void;
  setIsDirty: (dirty: boolean) => void;
  setPreviewMode: (enabled: boolean, data?: Record<string, string>) => void;
  setMediaAssets: (assets: MediaAsset[]) => void;
  addMediaAsset: (asset: MediaAsset) => void;
  removeMediaAsset: (assetId: string) => void;
  setIsLoadingMedia: (loading: boolean) => void;
  setIsUploadingMedia: (uploading: boolean) => void;
  setCertificateMetadata: (metadata: CertificateMetadata) => void;
  reset: () => void;
}

const initialState = {
  selectedObject: null,
  selectedObjectType: null,
  isEditingText: false,
  zoomLevel: 1,
  canvasDimensions: { width: 842, height: 595 },
  leftSidebarOpen: true,
  rightSidebarOpen: true,
  leftSidebarTab: 'media' as LeftSidebarTab,
  historyIndex: -1,
  historyLength: 0,
  canUndo: false,
  canRedo: false,
  clipboard: null,
  templateId: null,
  templateName: 'Untitled Template',
  isDirty: false,
  isPreviewMode: false,
  previewData: null,
  mediaAssets: [] as MediaAsset[],
  isLoadingMedia: false,
  isUploadingMedia: false,
  certificateMetadata: {
    title: '',
    issuedBy: '',
    description: '',
  } as CertificateMetadata,
};

export const useEditorStore = create<EditorState>((set, get) => ({
  ...initialState,

  setSelectedObject: (obj) => {
    set({
      selectedObject: obj,
      selectedObjectType: obj?.type || null,
    });
  },

  setIsEditingText: (editing) => set({ isEditingText: editing }),

  setZoomLevel: (zoom) => set({ zoomLevel: zoom }),

  setCanvasDimensions: (dims) => set({ canvasDimensions: dims }),

  setLeftSidebarOpen: (open) => set({ leftSidebarOpen: open }),
  setRightSidebarOpen: (open) => set({ rightSidebarOpen: open }),
  setLeftSidebarTab: (tab) => set({ leftSidebarTab: tab }),

  pushHistory: () => {
    const { historyIndex } = get();
    const newIndex = historyIndex + 1;
    set({
      historyIndex: newIndex,
      historyLength: newIndex + 1,
      canUndo: newIndex > 0,
      canRedo: false,
      isDirty: true,
    });
  },

  setHistoryState: (canUndo, canRedo) => set({ canUndo, canRedo }),

  setClipboard: (obj) => set({ clipboard: obj }),

  setTemplateInfo: (id, name) => set({ templateId: id, templateName: name }),

  setTemplateName: (name) => set({ templateName: name, isDirty: true }),

  setIsDirty: (dirty) => set({ isDirty: dirty }),

  setPreviewMode: (enabled, data) => set({ 
    isPreviewMode: enabled, 
    previewData: enabled ? (data || null) : null 
  }),

  setMediaAssets: (assets) => set({ mediaAssets: assets }),

  addMediaAsset: (asset) => set((state) => ({
    mediaAssets: [asset, ...state.mediaAssets]
  })),

  removeMediaAsset: (assetId) => set((state) => ({
    mediaAssets: state.mediaAssets.filter(a => a.id !== assetId)
  })),

  setIsLoadingMedia: (loading) => set({ isLoadingMedia: loading }),

  setIsUploadingMedia: (uploading) => set({ isUploadingMedia: uploading }),

  setCertificateMetadata: (metadata) => set({ certificateMetadata: metadata, isDirty: true }),

  reset: () => set(initialState),
}));
