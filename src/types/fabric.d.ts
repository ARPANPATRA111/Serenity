import { fabric } from 'fabric';

declare module 'fabric' {
  namespace fabric {
    interface IVariableTextboxOptions extends ITextboxOptions {
      dynamicKey?: string;
      isPlaceholder?: boolean;
    }

    class VariableTextbox extends Textbox {
      dynamicKey: string | undefined;
      isPlaceholder: boolean;
      constructor(text: string, options?: IVariableTextboxOptions);
      toObject(propertiesToInclude?: string[]): IVariableTextboxOptions;
      setDynamicKey(key: string): void;
      clearDynamicKey(): void;
    }

    interface IQRCodeImageOptions extends IImageOptions {
      verificationId?: string;
      baseUrl?: string;
    }

    class QRCodeImage extends Image {
      verificationId: string | undefined;
      baseUrl: string;
      
      constructor(element: HTMLImageElement | HTMLCanvasElement, options?: IQRCodeImageOptions);
      
      toObject(propertiesToInclude?: string[]): IQRCodeImageOptions;
      updateVerificationId(id: string): Promise<void>;
    }
  }
}

export interface CertificateTemplateDB {
  id: string;
  name: string;
  description?: string;
  width: number;
  height: number;
  canvasJSON: string;
  backgroundImage?: string;
  variableKeys: string[];
  createdAt: number;
  updatedAt: number;
  ownerId: string;
  thumbnail?: string;
}

export interface CertificateTemplate {
  name: string;
  description?: string;
  category?: string;
  version?: string;
  canvas: {
    width: number;
    height: number;
    backgroundColor: string;
  };
  objects: Array<Record<string, unknown>>;
  variables?: string[];
}


export interface DataRow {
  [key: string]: string | number | boolean | null;
}


export interface ParsedDataSource {
  headers: string[];
  rows: DataRow[];
  fileName: string;
  totalRows: number;
  sheetName?: string;
  availableSheets?: string[];
}

export interface CertificateRecord {
  id: string;
  templateId: string;
  userId?: string;
  templateName?: string;
  recipientName: string;
  recipientEmail?: string;
  recipientEmailHash?: string;
  title: string;
  description?: string;
  issuedAt: number;
  issuerName: string;
  viewCount: number;
  pdfUrl?: string;
  certificateImage?: string;
  metadata: Record<string, string>;
  isActive: boolean;
}

export interface GenerationProgress {
  current: number;
  total: number;
  status: string;
  percentage: number;
  isGenerating: boolean;
  errors: Array<{ index: number; message: string }>;
  generatedIds: string[];
}


export interface SendEmailRequest {
  to: string;
  subject: string;
  recipientName: string;
  certificateId: string;
  certificatePdfUrl?: string;
  attachPdf?: boolean;
}

export type SubscriptionTier = 'free' | 'pro' | 'enterprise';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  tier: SubscriptionTier;
  dailyEmailsUsed: number;
  lastEmailResetDate: string; 
  createdAt: number;
  templates: string[]; 
}


export interface LeadCaptureEvent {
  userId: string;
  email: string;
  feature: 'bulk_email' | 'bulk_download' | 'custom_branding' | 'api_access';
  timestamp: number;
  metadata?: Record<string, unknown>;
}

export interface APIResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface VerificationResponse {
  isValid: boolean;
  certificate?: {
    recipientName: string;
    title: string;
    issuedAt: number;
    issuerName: string;
    viewCount: number;
  };
  error?: string;
}

export interface FabricCanvasEvents {
  'object:selected': { selected: fabric.Object[] };
  'object:modified': { target: fabric.Object };
  'object:added': { target: fabric.Object };
  'object:removed': { target: fabric.Object };
  'selection:cleared': undefined;
  'mouse:down': fabric.IEvent;
  'mouse:up': fabric.IEvent;
  'mouse:move': fabric.IEvent;
}

export interface EditorState {
  selectedObject: fabric.Object | null;
  isEditingText: boolean;
  zoomLevel: number;
  canvasDimensions: { width: number; height: number };
  historyIndex: number;
  historyStack: string[];
  clipboard: fabric.Object | null;
  
  setSelectedObject: (obj: fabric.Object | null) => void;
  setIsEditingText: (editing: boolean) => void;
  setZoomLevel: (zoom: number) => void;
  setCanvasDimensions: (dims: { width: number; height: number }) => void;
  pushHistory: (json: string) => void;
  undo: () => string | null;
  redo: () => string | null;
  setClipboard: (obj: fabric.Object | null) => void;
}

export interface DataSourceState {
  dataSource: ParsedDataSource | null;
  selectedKeys: string[];
  previewRowIndex: number;
  
  setDataSource: (source: ParsedDataSource | null) => void;
  setSelectedKeys: (keys: string[]) => void;
  setPreviewRowIndex: (index: number) => void;
  clearDataSource: () => void;
}
