/**
 * Fabric.js v5.3.0 Type Definitions Extension
 * Custom types for Serenity Certificate Generator
 */

import { fabric } from 'fabric';

declare module 'fabric' {
  namespace fabric {
    /**
     * VariableTextbox - Custom Fabric.js Textbox subclass
     * Extends the standard Textbox with dynamic data binding capabilities
     */
    interface IVariableTextboxOptions extends ITextboxOptions {
      /** Excel column header name for data binding */
      dynamicKey?: string;
      /** Whether to render a dashed border indicating it's a placeholder */
      isPlaceholder?: boolean;
    }

    class VariableTextbox extends Textbox {
      dynamicKey: string | undefined;
      isPlaceholder: boolean;
      
      constructor(text: string, options?: IVariableTextboxOptions);
      
      /**
       * Override toObject to include custom properties in serialization
       */
      toObject(propertiesToInclude?: string[]): IVariableTextboxOptions;
      
      /**
       * Set the dynamic key and update visual styling
       */
      setDynamicKey(key: string): void;
      
      /**
       * Clear the dynamic key and reset styling
       */
      clearDynamicKey(): void;
    }

    /**
     * QRCodeImage - Custom Image object for QR codes
     */
    interface IQRCodeImageOptions extends IImageOptions {
      /** The verification ID that the QR code points to */
      verificationId?: string;
      /** Base URL for QR code generation */
      baseUrl?: string;
    }

    class QRCodeImage extends Image {
      verificationId: string | undefined;
      baseUrl: string;
      
      constructor(element: HTMLImageElement | HTMLCanvasElement, options?: IQRCodeImageOptions);
      
      toObject(propertiesToInclude?: string[]): IQRCodeImageOptions;
      
      /**
       * Update the QR code with a new verification ID
       */
      updateVerificationId(id: string): Promise<void>;
    }
  }
}

/**
 * Certificate Template JSON Schema (for database storage)
 */
export interface CertificateTemplateDB {
  /** Unique template identifier */
  id: string;
  /** Human-readable template name */
  name: string;
  /** Template description */
  description?: string;
  /** Canvas width in pixels */
  width: number;
  /** Canvas height in pixels */
  height: number;
  /** Fabric.js canvas JSON */
  canvasJSON: string;
  /** Background image URL (optional) */
  backgroundImage?: string;
  /** Variable keys used in the template */
  variableKeys: string[];
  /** Creation timestamp */
  createdAt: number;
  /** Last modified timestamp */
  updatedAt: number;
  /** Owner user ID */
  ownerId: string;
  /** Thumbnail data URL */
  thumbnail?: string;
}

/**
 * Certificate Template JSON Schema (for JSON files)
 */
export interface CertificateTemplate {
  /** Template name */
  name: string;
  /** Template description */
  description?: string;
  /** Template category */
  category?: string;
  /** Template version */
  version?: string;
  /** Canvas configuration */
  canvas: {
    width: number;
    height: number;
    backgroundColor: string;
  };
  /** Canvas objects (serialized) */
  objects: Array<Record<string, unknown>>;
  /** Variable keys used in the template */
  variables?: string[];
}

/**
 * Data Row from Excel/CSV
 */
export interface DataRow {
  [key: string]: string | number | boolean | null;
}

/**
 * Parsed Data Source
 */
export interface ParsedDataSource {
  /** Column headers */
  headers: string[];
  /** Data rows */
  rows: DataRow[];
  /** Original file name */
  fileName: string;
  /** Total row count */
  totalRows: number;
  /** Current sheet name (for multi-sheet files) */
  sheetName?: string;
  /** All available sheet names */
  availableSheets?: string[];
}

/**
 * Certificate Record for Verification
 */
export interface CertificateRecord {
  /** NanoID identifier */
  id: string;
  /** Template ID used */
  templateId: string;
  /** User ID who created the certificate */
  userId?: string;
  /** Template name for display */
  templateName?: string;
  /** Recipient name */
  recipientName: string;
  /** Recipient email (plain text for display, stored securely) */
  recipientEmail?: string;
  /** Recipient email (hashed for searching) */
  recipientEmailHash?: string;
  /** Certificate title */
  title: string;
  /** Issued date */
  issuedAt: number;
  /** Issuer organization */
  issuerName: string;
  /** View count */
  viewCount: number;
  /** PDF URL in Firebase Storage */
  pdfUrl?: string;
  /** Certificate image data URL */
  certificateImage?: string;
  /** Additional metadata (key-value from data source) */
  metadata: Record<string, string>;
  /** Whether certificate is active */
  isActive: boolean;
}

/**
 * Generation Progress State
 */
export interface GenerationProgress {
  /** Current processing index */
  current: number;
  /** Total items to process */
  total: number;
  /** Current status message */
  status: string;
  /** Percentage complete (0-100) */
  percentage: number;
  /** Is generation in progress */
  isGenerating: boolean;
  /** Any errors encountered */
  errors: Array<{ index: number; message: string }>;
  /** Generated certificate IDs */
  generatedIds: string[];
}

/**
 * Email Sending Request
 */
export interface SendEmailRequest {
  to: string;
  subject: string;
  recipientName: string;
  certificateId: string;
  certificatePdfUrl?: string;
  attachPdf?: boolean;
}

/**
 * User Subscription Tier
 */
export type SubscriptionTier = 'free' | 'pro' | 'enterprise';

/**
 * User Profile
 */
export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  tier: SubscriptionTier;
  dailyEmailsUsed: number;
  lastEmailResetDate: string; // ISO date string
  createdAt: number;
  templates: string[]; // Template IDs
}

/**
 * Lead Capture Event (for Freemium upsell)
 */
export interface LeadCaptureEvent {
  userId: string;
  email: string;
  feature: 'bulk_email' | 'bulk_download' | 'custom_branding' | 'api_access';
  timestamp: number;
  metadata?: Record<string, unknown>;
}

/**
 * API Response Types
 */
export interface APIResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

/**
 * Verification API Response
 */
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

/**
 * Fabric Canvas Event Types
 */
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

/**
 * Editor State for Zustand Store
 */
export interface EditorState {
  /** Currently selected object */
  selectedObject: fabric.Object | null;
  /** Whether we're in text editing mode */
  isEditingText: boolean;
  /** Current zoom level */
  zoomLevel: number;
  /** Canvas dimensions */
  canvasDimensions: { width: number; height: number };
  /** Undo/Redo stack */
  historyIndex: number;
  historyStack: string[];
  /** Clipboard */
  clipboard: fabric.Object | null;
  
  // Actions
  setSelectedObject: (obj: fabric.Object | null) => void;
  setIsEditingText: (editing: boolean) => void;
  setZoomLevel: (zoom: number) => void;
  setCanvasDimensions: (dims: { width: number; height: number }) => void;
  pushHistory: (json: string) => void;
  undo: () => string | null;
  redo: () => string | null;
  setClipboard: (obj: fabric.Object | null) => void;
}

/**
 * Data Source State for Zustand Store
 */
export interface DataSourceState {
  /** Parsed data source */
  dataSource: ParsedDataSource | null;
  /** Selected variable keys for mapping */
  selectedKeys: string[];
  /** Row preview index */
  previewRowIndex: number;
  
  // Actions
  setDataSource: (source: ParsedDataSource | null) => void;
  setSelectedKeys: (keys: string[]) => void;
  setPreviewRowIndex: (index: number) => void;
  clearDataSource: () => void;
}
