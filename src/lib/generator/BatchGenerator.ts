/**
 * BatchGenerator - The Heart of Certificate Generation
 * 
 * This module handles bulk certificate generation with:
 * - High-DPI canvas rasterization (72 DPI → 300 DPI)
 * - Non-blocking processing with setTimeout yielding
 * - Progress tracking and cancellation support
 * - PDF generation and ZIP packaging
 * - API-based storage for certificate verification
 * 
 * CRITICAL: All processing happens client-side to save server costs.
 * Certificates are stored via API for cross-device verification.
 */

import { fabric } from 'fabric';
import { jsPDF } from 'jspdf';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { nanoid } from 'nanoid';
import { 
  registerVariableTextbox, 
  getVariableTextboxes,
  findQRCodeImage,
  A4_LANDSCAPE,
  HIGH_DPI_MULTIPLIER,
} from '@/lib/fabric';
import { yieldToMain } from '@/lib/utils';
import type { DataRow, CertificateRecord as FirebaseCertificateRecord } from '@/types/fabric.d';

/**
 * Generation options
 */
export interface BatchGenerationOptions {
  /** Template JSON string */
  templateJSON: string;
  /** Data rows to process */
  dataRows: DataRow[];
  /** Field to use for naming files (e.g., 'Name') */
  nameField?: string;
  /** Whether to generate QR codes with verification IDs */
  generateQRCodes?: boolean;
  /** Whether to save certificates to Firestore */
  saveToDB?: boolean;
  /** Template ID for DB records */
  templateId?: string;
  /** Template name for auto-save */
  templateName?: string;
  /** User ID for template ownership */
  userId?: string;
  /** Issuer name for certificates */
  issuerName?: string;
  /** Certificate title field */
  titleField?: string;
  /** Output format */
  outputFormat?: 'pdf' | 'png' | 'both';
  /** Progress callback */
  onProgress?: (current: number, total: number, status: string) => void;
  /** Error callback */
  onError?: (index: number, message: string) => void;
  /** Certificate generated callback */
  onCertificateGenerated?: (id: string, record: Partial<FirebaseCertificateRecord>) => void;
  /** Check if generation should be cancelled */
  isCancelled?: () => boolean;
}

/**
 * Generation result
 */
export interface BatchGenerationResult {
  success: boolean;
  totalGenerated: number;
  errors: Array<{ index: number; message: string }>;
  certificateIds: string[];
  zipBlob?: Blob;
}

/**
 * Yield interval - yield to main thread every N records
 */
const YIELD_INTERVAL = 5;

/**
 * Main batch generation function
 * Processes data rows and generates certificates without blocking the UI
 */
export async function generateBatch(
  options: BatchGenerationOptions
): Promise<BatchGenerationResult> {
  const {
    templateJSON,
    dataRows,
    nameField = 'Name',
    generateQRCodes = true,
    templateId,
    issuerName = 'Serenity',
    titleField = 'Certificate',
    templateName = 'Untitled Template',
    userId,
    outputFormat = 'pdf',
    onProgress,
    onError,
    onCertificateGenerated,
    isCancelled,
  } = options;

  const result: BatchGenerationResult = {
    success: false,
    totalGenerated: 0,
    errors: [],
    certificateIds: [],
  };

  console.log('[BatchGenerator] Starting batch generation with options:', {
    dataRowsCount: dataRows.length,
    nameField,
    generateQRCodes,
    templateId,
    templateName,
    userId,
    issuerName,
    titleField,
    outputFormat,
  });

  // Register custom Fabric classes
  registerVariableTextbox();

  // Create hidden canvas for rendering
  const hiddenCanvasEl = document.createElement('canvas');
  hiddenCanvasEl.width = A4_LANDSCAPE.width;
  hiddenCanvasEl.height = A4_LANDSCAPE.height;
  hiddenCanvasEl.style.display = 'none';
  document.body.appendChild(hiddenCanvasEl);

  // Create Fabric.js StaticCanvas (no interaction needed)
  const staticCanvas = new fabric.StaticCanvas(hiddenCanvasEl, {
    width: A4_LANDSCAPE.width,
    height: A4_LANDSCAPE.height,
    backgroundColor: '#ffffff',
  });

  // Prepare ZIP archive
  const zip = new JSZip();
  const pdfFolder = zip.folder('certificates');

  try {
    const total = dataRows.length;
    onProgress?.(0, total, 'Initializing...');

    // Parse template
    const template = typeof templateJSON === 'string' 
      ? JSON.parse(templateJSON) 
      : templateJSON;

    for (let i = 0; i < total; i++) {
      // Check for cancellation
      if (isCancelled?.()) {
        onProgress?.(i, total, 'Cancelled');
        break;
      }

      const row = dataRows[i];
      const certificateId = nanoid(12);

      try {
        onProgress?.(i + 1, total, `Processing ${i + 1} of ${total}...`);

        // Load template into canvas
        await loadTemplateIntoCanvas(staticCanvas, template);

        // Update variable textboxes with row data
        updateTextboxesWithData(staticCanvas, row);

        // Check if there's a QR code in the template
        const hasQRCode = findQRCodeImage(staticCanvas) !== null;

        // Update QR code if present
        if (generateQRCodes && hasQRCode) {
          await updateQRCode(staticCanvas, certificateId);
        }
        
        // Update verification URL placeholder (if present)
        updateVerificationUrlPlaceholder(staticCanvas, certificateId);
        
        // Add verification URL text only if no QR code AND no verification placeholder
        // (The clickable link is always added to the PDF separately)
        const hasVerificationText = staticCanvas.getObjects().some(
          obj => (obj as any).isVerificationUrl || 
                 (obj.type === 'text' && (obj as fabric.Text).text?.includes('Verify:'))
        );
        if (!hasQRCode && !hasVerificationText) {
          addVerificationURL(staticCanvas, certificateId);
        }

        // Render canvas
        staticCanvas.requestRenderAll();

        // Generate high-DPI image
        const dataURL = staticCanvas.toDataURL({
          format: 'png',
          quality: 1,
          multiplier: HIGH_DPI_MULTIPLIER,
        });

        // Generate filename
        const recipientName = String(row[nameField] || `Certificate_${i + 1}`);
        const sanitizedName = sanitizeFilename(recipientName);

        if (outputFormat === 'pdf' || outputFormat === 'both') {
          // Create PDF
          const pdf = new jsPDF({
            orientation: 'landscape',
            unit: 'pt',
            format: 'a4',
          });

          // A4 Landscape dimensions in points (must match canvas ratio)
          const pdfWidth = pdf.internal.pageSize.getWidth();
          const pdfHeight = pdf.internal.pageSize.getHeight();

          // Add image to PDF (full page, scaled to fit)
          pdf.addImage(dataURL, 'PNG', 0, 0, pdfWidth, pdfHeight, undefined, 'FAST');

          // Add clickable link over the verification URL area at the bottom
          // This makes the existing URL text or QR code clickable
          const verifyUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/verify/${certificateId}`;
          
          // Add clickable area at the bottom where the URL/QR is displayed
          // The link covers the area without adding visible text (text already in image)
          const linkWidth = hasQRCode ? 150 : 400; // QR code is smaller
          const linkHeight = hasQRCode ? 150 : 30;
          const linkX = (pdfWidth - linkWidth) / 2;
          const linkY = hasQRCode ? pdfHeight - 180 : pdfHeight - 35;
          
          // Add clickable link annotation (invisible, just makes the area clickable)
          pdf.link(linkX, linkY, linkWidth, linkHeight, { url: verifyUrl });

          // Get PDF blob
          const pdfBlob = pdf.output('blob');

          // Add to ZIP
          pdfFolder?.file(`${sanitizedName}_${certificateId}.pdf`, pdfBlob);
        }

        if (outputFormat === 'png' || outputFormat === 'both') {
          // Convert data URL to blob for PNG
          const pngBlob = await dataURLToBlob(dataURL);
          pdfFolder?.file(`${sanitizedName}_${certificateId}.png`, pngBlob);
        }

        // Create certificate record for Firebase
        const record: Partial<FirebaseCertificateRecord> = {
          id: certificateId,
          recipientName,
          title: String(row[titleField] || 'Certificate of Completion'),
          issuedAt: Date.now(),
          issuerName,
          viewCount: 0,
          metadata: row as Record<string, string>,
          isActive: true,
        };

        result.certificateIds.push(certificateId);
        result.totalGenerated++;
        console.log(`[BatchGenerator] Generated certificate ${certificateId} for ${recipientName} (${i + 1}/${total})`);

        onCertificateGenerated?.(certificateId, record);

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error(`[BatchGenerator] Error generating certificate ${i + 1}:`, errorMessage);
        result.errors.push({ index: i, message: errorMessage });
        onError?.(i, errorMessage);
      }

      // Yield to main thread periodically to prevent UI blocking
      if ((i + 1) % YIELD_INTERVAL === 0) {
        await yieldToMain();
      }
    }

    // Generate ZIP file
    onProgress?.(total, total, 'Creating ZIP archive...');
    const zipBlob = await zip.generateAsync({ 
      type: 'blob',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
    }, (metadata) => {
      onProgress?.(total, total, `Compressing... ${Math.round(metadata.percent)}%`);
    });

    result.zipBlob = zipBlob;
    result.success = result.errors.length === 0;

    // Store certificates via API (Firebase Admin SDK - server-side, no permission issues)
    onProgress?.(total, total, 'Saving certificate records to cloud...');
    console.log('[BatchGenerator] Preparing to store certificates, total generated:', result.totalGenerated);
    console.log('[BatchGenerator] Certificate IDs generated:', result.certificateIds);
    
    // Build certificate records with their images
    const certificatesToSave: FirebaseCertificateRecord[] = [];
    
    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];
      const certId = result.certificateIds[i];
      if (!certId) {
        console.log(`[BatchGenerator] Skipping index ${i}, no certificate ID`);
        continue;
      }
      
      const recipientName = String(row[nameField] || `Certificate_${i + 1}`);
      
      // Generate certificate thumbnail (smaller size for storage)
      const thumbnailDataURL = staticCanvas.toDataURL({
        format: 'png',
        quality: 0.8,
        multiplier: 1.5, // 1.5x for decent quality but not too large
      });
      
      certificatesToSave.push({
        id: certId,
        templateId: templateId || 'local',
        recipientName,
        recipientEmail: String(row['Email'] || row['email'] || ''),
        title: String(row[titleField] || 'Certificate of Completion'),
        issuedAt: Date.now(),
        issuerName,
        viewCount: 0,
        metadata: row as Record<string, string>,
        isActive: true,
        certificateImage: thumbnailDataURL, // Store the certificate image
      });
    }

    // Save all certificates via API (uses Firebase Admin SDK on server)
    if (certificatesToSave.length > 0) {
      try {
        const response = await fetch('/api/certificates', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ certificates: certificatesToSave }),
        });
        
        const data = await response.json();
        
        if (data.success) {
          console.log(`[BatchGenerator] Saved ${data.created} certificates to Firebase via API`);
        } else {
          console.warn('[BatchGenerator] Some certificates failed to save:', data.errors);
        }
      } catch (apiError) {
        console.warn('[BatchGenerator] Failed to save certificates via API:', apiError);
        // Don't fail the entire operation if API fails
      }
    }

    // Templates are now saved via EditorLayout using Firebase API
    // No need for localStorage auto-save here

    onProgress?.(total, total, 'Complete!');

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Generation failed';
    result.errors.push({ index: -1, message: errorMessage });
    result.success = false;
  } finally {
    // Cleanup
    staticCanvas.dispose();
    document.body.removeChild(hiddenCanvasEl);
  }

  return result;
}

/**
 * Load template JSON into a canvas
 */
async function loadTemplateIntoCanvas(
  canvas: fabric.StaticCanvas,
  template: object
): Promise<void> {
  return new Promise((resolve) => {
    canvas.loadFromJSON(template, () => {
      canvas.requestRenderAll();
      resolve();
    });
  });
}

/**
 * Update all VariableTextbox instances with data from a row
 * Also removes the placeholder styling for clean PDF output
 */
function updateTextboxesWithData(
  canvas: fabric.StaticCanvas,
  data: DataRow
): void {
  const textboxes = getVariableTextboxes(canvas);

  for (const textbox of textboxes) {
    if (textbox.dynamicKey && data[textbox.dynamicKey] !== undefined) {
      const value = data[textbox.dynamicKey];
      textbox.set('text', String(value ?? ''));
      
      // Remove placeholder styling for clean output
      textbox.set({
        strokeWidth: 0,
        stroke: undefined,
        strokeDashArray: undefined,
        padding: 0,
      });
      
      // Mark as no longer a placeholder so badge doesn't render
      (textbox as any).isPlaceholder = false;
    }
  }
}

/**
 * Update verification URL placeholder with actual URL
 */
function updateVerificationUrlPlaceholder(
  canvas: fabric.StaticCanvas,
  certificateId: string
): void {
  const verificationURL = `${typeof window !== 'undefined' ? window.location.origin : 'https://serenity.app'}/verify/${certificateId}`;
  
  const objects = canvas.getObjects();
  for (const obj of objects) {
    // Check if this is a verification URL placeholder
    if ((obj as any).isVerificationUrl || 
        (obj.type === 'text' && (obj as fabric.Text).text?.includes('{{VERIFICATION_URL}}'))) {
      (obj as fabric.Text).set('text', `Verify: ${verificationURL}`);
      (obj as any).isVerificationUrl = false; // Clear the flag
    }
  }
}

/**
 * Update QR code with verification ID
 */
async function updateQRCode(
  canvas: fabric.StaticCanvas,
  certificateId: string
): Promise<void> {
  const qrImage = findQRCodeImage(canvas);
  
  if (qrImage && typeof qrImage.updateVerificationId === 'function') {
    await qrImage.updateVerificationId(certificateId);
  }
}

/**
 * Add verification URL at the bottom of the certificate
 */
function addVerificationURL(
  canvas: fabric.StaticCanvas,
  certificateId: string
): void {
  const verificationURL = `${typeof window !== 'undefined' ? window.location.origin : 'https://serenity.app'}/verify/${certificateId}`;
  
  const verificationText = new fabric.Text(`Verify: ${verificationURL}`, {
    left: A4_LANDSCAPE.width / 2,
    top: A4_LANDSCAPE.height - 25,
    originX: 'center',
    originY: 'center',
    fontSize: 10,
    fontFamily: 'Arial',
    fill: '#666666',
    selectable: false,
    evented: false,
  });
  
  canvas.add(verificationText);
}

/**
 * Convert data URL to Blob
 */
async function dataURLToBlob(dataURL: string): Promise<Blob> {
  const response = await fetch(dataURL);
  return response.blob();
}

/**
 * Sanitize filename by removing invalid characters
 */
function sanitizeFilename(name: string): string {
  return name
    .replace(/[<>:"/\\|?*]/g, '_')
    .replace(/\s+/g, '_')
    .substring(0, 50);
}

/**
 * Download the generated ZIP file
 */
export function downloadZip(blob: Blob, filename: string = 'certificates.zip'): void {
  saveAs(blob, filename);
}

/**
 * Generate a single certificate (for preview)
 */
export async function generateSingleCertificate(
  templateJSON: string,
  data: DataRow,
  certificateId?: string
): Promise<{ dataURL: string; pdfBlob: Blob; certificateId: string }> {
  const id = certificateId || nanoid(12);
  
  // Register custom classes
  registerVariableTextbox();

  // Create hidden canvas
  const hiddenCanvasEl = document.createElement('canvas');
  hiddenCanvasEl.width = A4_LANDSCAPE.width;
  hiddenCanvasEl.height = A4_LANDSCAPE.height;
  document.body.appendChild(hiddenCanvasEl);

  const staticCanvas = new fabric.StaticCanvas(hiddenCanvasEl, {
    width: A4_LANDSCAPE.width,
    height: A4_LANDSCAPE.height,
    backgroundColor: '#ffffff',
  });

  try {
    // Load template
    const template = typeof templateJSON === 'string' 
      ? JSON.parse(templateJSON) 
      : templateJSON;

    await loadTemplateIntoCanvas(staticCanvas, template);

    // Update data
    updateTextboxesWithData(staticCanvas, data);
    await updateQRCode(staticCanvas, id);

    staticCanvas.requestRenderAll();

    // Generate high-DPI image
    const dataURL = staticCanvas.toDataURL({
      format: 'png',
      quality: 1,
      multiplier: HIGH_DPI_MULTIPLIER,
    });

    // Create PDF
    const pdf = new jsPDF({
      orientation: 'landscape',
      unit: 'pt',
      format: 'a4',
    });

    // Use dynamic page size for proper scaling
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();
    
    pdf.addImage(dataURL, 'PNG', 0, 0, pdfWidth, pdfHeight, undefined, 'FAST');
    const pdfBlob = pdf.output('blob');

    return { dataURL, pdfBlob, certificateId: id };

  } finally {
    staticCanvas.dispose();
    document.body.removeChild(hiddenCanvasEl);
  }
}
