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
  generateQRCodeDataURL,
} from '@/lib/fabric';
import { disableObjectCaching, qrPixelSize, QR_LOGICAL_SIZE, type EditorChromeCanvas } from '@/lib/fabric/exportQuality';
import { normalizeTemplateJSON, substituteInlineTokens } from '@/lib/fabric/templateNormalization';
import { yieldToMain } from '@/lib/utils';
import { buildVerificationUrl } from '@/lib/verification/url';
import { loadFontsForTemplate } from '@/lib/fonts/googleFonts';
import { certificateFileStem } from '@/lib/certificates/fileName';
import { persistCertificateRecords, type PersistFailure } from './persistence';
import type { DataRow, CertificateRecord as FirebaseCertificateRecord } from '@/types/fabric.d';

export interface BatchGenerationOptions {
  templateJSON: string;
  dataRows: DataRow[];
  nameField?: string;
  /** Spreadsheet column holding recipient emails; stored on each record. */
  emailField?: string;
  generateQRCodes?: boolean;
  saveToDB?: boolean;
  templateId?: string;
  templateName?: string;
  userId?: string;
  authToken?: string;
  issuerName?: string;
  certificateTitle?: string;
  certificateDescription?: string;
  eventId?: string;
  titleField?: string;
  outputFormat?: 'pdf' | 'png' | 'both';
  /** Keep each PDF in memory for emailing afterwards. Off saves memory on large batches. */
  retainPdfBlobs?: boolean;
  onProgress?: (current: number, total: number, status: string) => void;
  onError?: (index: number, message: string) => void;
  onCertificateGenerated?: (id: string, record: Partial<FirebaseCertificateRecord>) => void;
  isCancelled?: () => boolean;
}

export interface GeneratedCertificateResult {
  rowIndex: number;
  certificateId: string;
  recipientName: string;
  rowData: DataRow;
  record: Partial<FirebaseCertificateRecord>;
}

export interface BatchGenerationResult {
  success: boolean;
  cancelled: boolean;
  generationBatchId: string;
  totalGenerated: number;
  errors: Array<{ index: number; message: string }>;
  certificateIds: string[];
  generatedCertificates: GeneratedCertificateResult[];
  persistedCertificateIds: string[];
  persistenceErrors: Array<{ index: number; certificateId?: string; message: string }>;
  /** Records that could not be saved; pass to `retryCertificatePersistence`. */
  unsavedRecords: FirebaseCertificateRecord[];
  certificateImageUrls: Map<string, string>;
  certificatePdfBlobs: Map<string, Blob>;
  zipBlob?: Blob;
  limitReached?: boolean;
  remaining?: number;
}

const YIELD_INTERVAL = 10;
const UPLOAD_CONCURRENCY = 4;
const THUMBNAIL_MULTIPLIER = 2;

function authHeaders(authToken?: string): Record<string, string> {
  return authToken ? { Authorization: `Bearer ${authToken}` } : {};
}

/** Runs async tasks with bounded concurrency while generation continues. */
function createUploadQueue(concurrency: number) {
  const pending: Array<() => Promise<void>> = [];
  let active = 0;
  let idleResolvers: Array<() => void> = [];

  const pump = () => {
    while (active < concurrency && pending.length > 0) {
      const task = pending.shift()!;
      active += 1;
      void task().finally(() => {
        active -= 1;
        pump();
        if (active === 0 && pending.length === 0) {
          idleResolvers.forEach((resolve) => resolve());
          idleResolvers = [];
        }
      });
    }
  };

  return {
    push(task: () => Promise<void>) {
      pending.push(task);
      pump();
    },
    drain(): Promise<void> {
      if (active === 0 && pending.length === 0) return Promise.resolve();
      return new Promise((resolve) => idleResolvers.push(resolve));
    },
  };
}

export async function generateBatch(
  options: BatchGenerationOptions
): Promise<BatchGenerationResult> {
  const {
    templateJSON,
    dataRows,
    nameField = 'Name',
    emailField,
    generateQRCodes = true,
    templateId,
    issuerName = 'Serenity',
    certificateTitle = 'Certificate of Completion',
    certificateDescription = '',
    eventId,
    titleField = 'Certificate',
    templateName = 'Untitled Template',
    userId,
    authToken,
    outputFormat = 'pdf',
    retainPdfBlobs = true,
    onProgress,
    onError,
    onCertificateGenerated,
    isCancelled,
  } = options;

  const generationBatchId = nanoid(12);

  const result: BatchGenerationResult = {
    success: false,
    cancelled: false,
    generationBatchId,
    totalGenerated: 0,
    errors: [],
    certificateIds: [],
    generatedCertificates: [],
    persistedCertificateIds: [],
    persistenceErrors: [],
    unsavedRecords: [],
    certificateImageUrls: new Map(),
    certificatePdfBlobs: new Map(),
  };

  await loadFontsForTemplate(templateJSON);

  // Check user's certificate generation limit before starting
  if (userId) {
    try {
      const premiumResponse = await fetch('/api/users/premium', {
        headers: authHeaders(authToken),
      });
      const premiumData = await premiumResponse.json();

      if (premiumData.success) {
        const canGenerate = premiumData.canGenerate;
        const remainingFree = premiumData.remainingFree ?? 5;
        const isPremium = premiumData.isPremium;

        if (!isPremium && !canGenerate) {
          result.errors.push({
            index: -1,
            message: 'Free tier limit reached. Paid upgrades are not currently available.'
          });
          result.limitReached = true;
          result.remaining = 0;
          return result;
        }

        if (!isPremium && dataRows.length > remainingFree) {
          result.errors.push({
            index: -1,
            message: `You can only generate ${remainingFree} more certificate(s) on the free tier.`
          });
          result.limitReached = true;
          result.remaining = remainingFree;
          return result;
        }
      }
    } catch (e) {
      console.warn('[BatchGenerator] Failed to check premium status:', e);
      // Continue anyway if the check fails - the API will still enforce limits
    }
  }

  // Register custom Fabric classes
  registerVariableTextbox();

  // Hidden export canvas. It is never shown, so retina scaling and automatic
  // re-renders on add/remove would only cost time: every export renders
  // itself through toDataURL.
  const hiddenCanvasEl = document.createElement('canvas');
  hiddenCanvasEl.width = A4_LANDSCAPE.width;
  hiddenCanvasEl.height = A4_LANDSCAPE.height;
  hiddenCanvasEl.style.display = 'none';
  document.body.appendChild(hiddenCanvasEl);

  const staticCanvas = new fabric.StaticCanvas(hiddenCanvasEl, {
    width: A4_LANDSCAPE.width,
    height: A4_LANDSCAPE.height,
    backgroundColor: '#ffffff',
    enableRetinaScaling: false,
    renderOnAddRemove: false,
  });
  // Certificates never show the editor's placeholder frames or badges.
  (staticCanvas as typeof staticCanvas & EditorChromeCanvas).hideEditorChrome = true;

  const zip = new JSZip();
  const pdfFolder = zip.folder('certificates');
  const imageUrlMap: Map<string, string> = new Map();
  const uploads = createUploadQueue(UPLOAD_CONCURRENCY);
  let uploadsFinished = 0;

  const uploadThumbnail = async (certId: string, thumbnailDataURL: string): Promise<void> => {
    try {
      const response = await fetch('/api/certificates/upload-image', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders(authToken),
        },
        body: JSON.stringify({
          certificateId: certId,
          imageBase64: thumbnailDataURL,
        }),
      });
      const data = await response.json();
      if (data.success && data.url) {
        imageUrlMap.set(certId, data.url);
      }
    } catch (uploadError) {
      console.warn(`[BatchGenerator] Failed to upload thumbnail for ${certId}:`, uploadError);
    } finally {
      uploadsFinished += 1;
    }
  };

  try {
    const total = dataRows.length;
    onProgress?.(0, total, 'Initializing...');

    // Normalised once: repairs hand-written templates so placeholders are
    // real variables (see templateNormalization.ts).
    const template = normalizeTemplateJSON(templateJSON as string | { objects?: unknown[] });

    for (let i = 0; i < total; i++) {
      if (isCancelled?.()) {
        result.cancelled = true;
        onProgress?.(i, total, 'Cancelled');
        break;
      }

      const row = dataRows[i];
      const certificateId = nanoid(12);

      try {
        onProgress?.(i + 1, total, `Processing ${i + 1} of ${total}...`);

        await loadTemplateIntoCanvas(staticCanvas, template);
        // Render every shape at full export resolution instead of through
        // Fabric's size-capped object cache (see exportQuality.ts).
        disableObjectCaching(staticCanvas.getObjects());

        updateTextboxesWithData(staticCanvas, row);

        const hasQRCode = findQRCodeImage(staticCanvas) !== null;
        if (generateQRCodes && hasQRCode) {
          await updateQRCode(staticCanvas, certificateId);
        }

        updateVerificationUrlPlaceholder(staticCanvas, certificateId);
        const clickableLinks = collectClickableLinks(staticCanvas, certificateId);

        const dataURL = staticCanvas.toDataURL({
          format: 'jpeg',
          quality: 0.92,
          multiplier: HIGH_DPI_MULTIPLIER,
        });

        const recipientName = String(row[nameField] || `Certificate_${i + 1}`);
        const sanitizedName = certificateFileStem(recipientName);

        if (outputFormat === 'pdf' || outputFormat === 'both' || retainPdfBlobs) {
          const pdfBlob = renderPdf(dataURL, clickableLinks);
          if (retainPdfBlobs) result.certificatePdfBlobs.set(certificateId, pdfBlob);
          if (outputFormat === 'pdf' || outputFormat === 'both') {
            pdfFolder?.file(`${sanitizedName}_${certificateId}.pdf`, pdfBlob);
          }
        }

        if (outputFormat === 'png' || outputFormat === 'both') {
          const pngDataURL = staticCanvas.toDataURL({
            format: 'png',
            quality: 1,
            multiplier: HIGH_DPI_MULTIPLIER,
          });
          const pngBlob = await dataURLToBlob(pngDataURL);
          pdfFolder?.file(`${sanitizedName}_${certificateId}.png`, pngBlob);
        }

        // Preview image for the verification page and history, captured while
        // the canvas holds this certificate. JPEG keeps photographic
        // backgrounds under the 2 MB upload limit that PNG could exceed.
        const thumbnailDataURL = staticCanvas.toDataURL({
          format: 'jpeg',
          quality: 0.9,
          multiplier: THUMBNAIL_MULTIPLIER,
        });
        uploads.push(() => uploadThumbnail(certificateId, thumbnailDataURL));

        const record: Partial<FirebaseCertificateRecord> = {
          id: certificateId,
          recipientName,
          title: certificateTitle || String(row[titleField] || 'Certificate of Completion'),
          description: certificateDescription || '',
          eventId,
          issuedAt: Date.now(),
          issuerName,
          viewCount: 0,
          metadata: row as Record<string, string>,
          isActive: true,
          generationBatchId,
          rowIndex: i,
          generationStatus: 'rendered',
        };

        result.certificateIds.push(certificateId);
        result.generatedCertificates.push({
          rowIndex: i,
          certificateId,
          recipientName,
          rowData: row,
          record,
        });
        result.totalGenerated++;

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

    onProgress?.(total, total, 'Creating ZIP archive...');
    result.zipBlob = await zip.generateAsync({
      type: 'blob',
      compression: 'DEFLATE',
      compressionOptions: { level: 4 },
    }, (metadata) => {
      onProgress?.(total, total, `Compressing... ${Math.round(metadata.percent)}%`);
    });

    const generatedCount = result.generatedCertificates.length;
    onProgress?.(total, total, `Uploading previews... ${Math.min(uploadsFinished, generatedCount)}/${generatedCount}`);
    await uploads.drain();
    imageUrlMap.forEach((url, certId) => {
      result.certificateImageUrls.set(certId, url);
    });

    const certificatesToSave: FirebaseCertificateRecord[] = result.generatedCertificates.map((generated) => {
      const row = generated.rowData;
      const emailValue = emailField ? row[emailField] : (row['Email'] ?? row['email']);
      return {
        id: generated.certificateId,
        templateId: templateId || 'local',
        userId,
        templateName,
        recipientName: generated.recipientName,
        recipientEmail: typeof emailValue === 'string' ? emailValue.trim() : '',
        title: certificateTitle || 'Certificate of Completion',
        description: certificateDescription || '',
        eventId,
        issuedAt: Date.now(),
        issuerName,
        viewCount: 0,
        metadata: row as Record<string, string>,
        isActive: true,
        generationBatchId,
        rowIndex: generated.rowIndex,
        generationStatus: 'rendered',
        idempotencyKey: `${generationBatchId}:${generated.rowIndex}`,
        certificateImage: imageUrlMap.get(generated.certificateId) || '',
      };
    });

    if (certificatesToSave.length > 0) {
      onProgress?.(total, total, 'Saving certificate records...');
      const outcome = await persistCertificateRecords(certificatesToSave, {
        authToken,
        onChunk: (saved, all) => onProgress?.(total, total, `Saving certificate records... ${saved}/${all}`),
      });
      applyPersistOutcome(result, certificatesToSave, outcome.persistedIds, outcome.failures, onError);
    }

    onProgress?.(total, total, result.cancelled ? 'Cancelled' : 'Complete!');
    result.success = result.errors.length === 0 && result.persistenceErrors.length === 0 && !result.cancelled;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Generation failed';
    result.errors.push({ index: -1, message: errorMessage });
    result.success = false;
  } finally {
    staticCanvas.dispose();
    document.body.removeChild(hiddenCanvasEl);
  }

  return result;
}

function applyPersistOutcome(
  result: BatchGenerationResult,
  attempted: FirebaseCertificateRecord[],
  persistedIds: string[],
  failures: PersistFailure[],
  onError?: (index: number, message: string) => void,
) {
  const persisted = new Set([...result.persistedCertificateIds, ...persistedIds]);
  result.persistedCertificateIds = Array.from(persisted);
  result.unsavedRecords = attempted.filter((record) => !persisted.has(record.id));
  result.persistenceErrors = failures.map((failure) => ({ index: -1, message: failure.message }));

  for (const failure of failures) {
    const message = failure.limitReached
      ? failure.message
      : `${failure.ids.length} certificate record(s) were not saved: ${failure.message}`;
    result.errors.push({ index: -1, message });
    onError?.(-1, message);
    if (failure.limitReached) {
      result.limitReached = true;
      result.remaining = failure.remaining ?? 0;
    }
  }
}

/** Retries saving records that failed during `generateBatch`. */
export async function retryCertificatePersistence(
  result: BatchGenerationResult,
  authToken?: string,
): Promise<BatchGenerationResult> {
  if (result.unsavedRecords.length === 0) return result;
  const attempted = result.unsavedRecords;
  const outcome = await persistCertificateRecords(attempted, { authToken });
  const next: BatchGenerationResult = {
    ...result,
    errors: result.errors.filter((error) => error.index !== -1),
  };
  applyPersistOutcome(next, attempted, outcome.persistedIds, outcome.failures);
  next.success = next.errors.length === 0 && next.persistenceErrors.length === 0 && !next.cancelled;
  return next;
}

function renderPdf(dataURL: string, clickableLinks: ClickableLinkInfo[]): Blob {
  const pdf = new jsPDF({
    orientation: 'landscape',
    unit: 'pt',
    format: 'a4',
  });

  // A4 landscape in points; the canvas uses the same aspect ratio.
  const pdfWidth = pdf.internal.pageSize.getWidth();
  const pdfHeight = pdf.internal.pageSize.getHeight();
  pdf.addImage(dataURL, 'JPEG', 0, 0, pdfWidth, pdfHeight, undefined, 'FAST');

  const scaleX = pdfWidth / A4_LANDSCAPE.width;
  const scaleY = pdfHeight / A4_LANDSCAPE.height;
  for (const link of clickableLinks) {
    pdf.link(link.x * scaleX, link.y * scaleY, link.width * scaleX, link.height * scaleY, { url: link.url });
  }

  return pdf.output('blob');
}

async function loadTemplateIntoCanvas(
  canvas: fabric.StaticCanvas,
  template: object
): Promise<void> {
  return new Promise((resolve) => {
    canvas.loadFromJSON(template, () => resolve());
  });
}

function updateTextboxesWithData(
  canvas: fabric.StaticCanvas,
  data: DataRow
): void {
  // Inline tokens in ordinary text ("Presented by {{Issuer}}") are replaced
  // exactly as the editor preview shows them, so the PDF matches the preview.
  for (const object of canvas.getObjects()) {
    const text = object as fabric.Textbox & { dynamicKey?: string; isVerificationUrl?: boolean };
    const type = (object.type || '').toLowerCase();
    if (!['text', 'i-text', 'textbox'].includes(type) || text.dynamicKey || text.isVerificationUrl) continue;
    if (typeof text.text === 'string' && text.text.includes('{{') && !text.text.includes('{{VERIFICATION_URL}}')) {
      const substituted = substituteInlineTokens(text.text, data as Record<string, unknown>);
      if (substituted !== text.text) text.set('text', substituted);
    }
  }

  const textboxes = getVariableTextboxes(canvas);

  for (const textbox of textboxes) {
    if (textbox.dynamicKey && data[textbox.dynamicKey] !== undefined) {
      const value = data[textbox.dynamicKey];
      textbox.set('text', String(value ?? ''));
    }

    // Editor-only chrome (dashed outline and the blue name badge) never
    // prints, even for a placeholder whose column is missing from the data.
    textbox.set({
      strokeWidth: 0,
      stroke: undefined,
      strokeDashArray: undefined,
      padding: 0,
    });
    (textbox as any).isPlaceholder = false;
  }
}

interface ClickableLinkInfo {
  url: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

function collectClickableLinks(
  canvas: fabric.StaticCanvas,
  certificateId: string
): ClickableLinkInfo[] {
  const links: ClickableLinkInfo[] = [];
  const verificationURL = buildVerificationUrl(certificateId);

  const objects = canvas.getObjects();
  for (const obj of objects) {
    // Verification URL placeholder - always links to verification page
    if ((obj as any).isVerificationUrl) {
      const bounds = obj.getBoundingRect();
      links.push({
        url: verificationURL,
        x: bounds.left,
        y: bounds.top,
        width: bounds.width,
        height: bounds.height,
      });
    }
    // User-added clickable link elements
    else if ((obj as any).isClickableLink && obj.type === 'textbox') {
      const text = (obj as fabric.Textbox).text || '';
      // Use the text content as the URL
      const url = text.startsWith('http') ? text : `https://${text}`;
      const bounds = obj.getBoundingRect();
      links.push({
        url,
        x: bounds.left,
        y: bounds.top,
        width: bounds.width,
        height: bounds.height,
      });
    }
  }

  return links;
}

function updateVerificationUrlPlaceholder(
  canvas: fabric.StaticCanvas,
  certificateId: string
): void {
  const verificationURL = buildVerificationUrl(certificateId);

  const objects = canvas.getObjects();
  for (const obj of objects) {
    // Check if this is a verification URL placeholder
    if ((obj as any).isVerificationUrl ||
        (obj.type === 'textbox' && (obj as fabric.Textbox).text?.includes('{{VERIFICATION_URL}}'))) {
      const textbox = obj as fabric.Textbox;

      // Replace placeholder text with actual URL (no prefix, clean look)
      textbox.set({
        text: verificationURL,
        backgroundColor: 'transparent', // Remove background color for clean output
        strokeWidth: 0, // Remove border
        stroke: undefined,
        strokeDashArray: undefined,
      });

      // Ensure textbox is wide enough to display the full URL without wrapping
      // Use a minimum width based on URL length
      const minWidth = Math.max(350, verificationURL.length * 6);
      if (textbox.width && textbox.width < minWidth) {
        textbox.set({ width: minWidth });
      }

      // Keep the flag so we can add PDF link annotation
      (obj as any).isVerificationUrl = true;
    }
  }
}

/**
 * Replaces the QR image with one encoding this certificate's verification URL.
 *
 * The printed QR keeps the geometry every earlier release produced (the image
 * was always regenerated at 200px, so it printed at 200 x scale), so existing
 * templates print exactly as before. The image is now generated at the export
 * resolution and drawn without smoothing, so modules print sharp instead of
 * being upscaled and blurred.
 */
async function updateQRCode(
  canvas: fabric.StaticCanvas,
  certificateId: string
): Promise<void> {
  const qrImage = findQRCodeImage(canvas);
  if (!qrImage) return;

  const qrColor = qrImage.qrColor || '#000000';
  const qrBackgroundColor = qrImage.qrBackgroundColor || '#ffffff';
  const displayWidth = QR_LOGICAL_SIZE * (qrImage.scaleX ?? 1);
  const displayHeight = QR_LOGICAL_SIZE * (qrImage.scaleY ?? 1);
  const pixelSize = qrPixelSize(displayWidth, HIGH_DPI_MULTIPLIER);

  const newDataUrl = await generateQRCodeDataURL(certificateId, pixelSize, qrColor, qrBackgroundColor);

  return new Promise<void>((resolve, reject) => {
    fabric.Image.fromURL(newDataUrl, (newImg) => {
      const element = newImg?.getElement() as HTMLImageElement | undefined;
      if (!newImg || !element) {
        reject(new Error('Generated QR image could not be loaded'));
        return;
      }

      qrImage.setElement(element);
      const naturalWidth = element.naturalWidth || element.width || pixelSize;
      const naturalHeight = element.naturalHeight || element.height || pixelSize;
      qrImage.set({
        width: naturalWidth,
        height: naturalHeight,
        scaleX: displayWidth / naturalWidth,
        scaleY: displayHeight / naturalHeight,
      });
      // Nearest-neighbour sampling keeps module edges hard when scaled.
      (qrImage as unknown as { imageSmoothing: boolean }).imageSmoothing = false;
      qrImage.objectCaching = false;
      qrImage.verificationId = certificateId;
      resolve();
    });
  });
}

async function dataURLToBlob(dataURL: string): Promise<Blob> {
  const response = await fetch(dataURL);
  return response.blob();
}

export function downloadZip(blob: Blob, filename: string = 'certificates.zip'): void {
  saveAs(blob, filename);
}
