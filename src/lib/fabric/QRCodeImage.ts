import { fabric } from 'fabric';

// QR Code generation constants
const QR_SIZE = 200;
const QR_PADDING = 16;

export async function generateQRCodeDataURL(
  verificationId: string,
  size: number = QR_SIZE
): Promise<string> {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://serenity.app';
  const verifyUrl = `${baseUrl}/verify/${verificationId}`;
  
  // Use QR code API (free, no auth required)
  // In production, use a client-side library for better privacy
  const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(verifyUrl)}&format=png&margin=0`;
  
  try {
    const response = await fetch(qrApiUrl);
    const blob = await response.blob();
    
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error('Failed to generate QR code:', error);
    // Return a placeholder on error
    return createPlaceholderQR(size);
  }
}

function createPlaceholderQR(size: number): string {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  
  if (!ctx) return '';
  
  // Draw placeholder
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, size, size);
  
  ctx.fillStyle = '#e5e7eb';
  ctx.fillRect(QR_PADDING, QR_PADDING, size - QR_PADDING * 2, size - QR_PADDING * 2);
  
  ctx.fillStyle = '#9ca3af';
  ctx.font = '12px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('QR Code', size / 2, size / 2);
  
  return canvas.toDataURL('image/png');
}

export async function createQRCodeImage(
  verificationId: string,
  options?: fabric.IImageOptions & { size?: number }
): Promise<fabric.Image & { verificationId: string; updateVerificationId: (id: string) => Promise<void> }> {
  const size = options?.size || QR_SIZE;
  const dataUrl = await generateQRCodeDataURL(verificationId, size);
  
  return new Promise((resolve, reject) => {
    fabric.Image.fromURL(dataUrl, (img) => {
      if (!img) {
        reject(new Error('Failed to create QR code image'));
        return;
      }
      
      // Add custom properties
      const qrImage = img as fabric.Image & {
        verificationId: string;
        updateVerificationId: (id: string) => Promise<void>;
      };
      
      qrImage.verificationId = verificationId;
      
      // Method to update the QR code with a new ID
      qrImage.updateVerificationId = async function(id: string) {
        this.verificationId = id;
        const newDataUrl = await generateQRCodeDataURL(id, size);
        
        return new Promise<void>((res) => {
          fabric.Image.fromURL(newDataUrl, (newImg) => {
            if (newImg && newImg.getElement()) {
              this.setElement(newImg.getElement() as HTMLImageElement);
              this.canvas?.requestRenderAll();
            }
            res();
          });
        });
      };
      
      // Apply options
      qrImage.set({
        ...options,
        originX: 'center',
        originY: 'center',
      });
      
      resolve(qrImage);
    });
  });
}

export function registerQRCodeImageType(): void {
  // Override toObject for QR code images to include verificationId
  const originalToObject = fabric.Image.prototype.toObject;
  fabric.Image.prototype.toObject = function(propertiesToInclude?: string[]) {
    const obj = originalToObject.call(this, propertiesToInclude);
    if ((this as fabric.Image & { verificationId?: string }).verificationId) {
      obj.verificationId = (this as fabric.Image & { verificationId: string }).verificationId;
    }
    return obj;
  };
}

export function isQRCodeImage(obj: fabric.Object): obj is fabric.Image & { verificationId: string; updateVerificationId?: (id: string) => Promise<void> } {
  return obj.type === 'image' && !!(obj as fabric.Image & { verificationId?: string }).verificationId;
}

export function findQRCodeImage(canvas: fabric.Canvas | fabric.StaticCanvas): (fabric.Image & { verificationId: string; updateVerificationId?: (id: string) => Promise<void> }) | null {
  const objects = canvas.getObjects();
  for (const obj of objects) {
    if (isQRCodeImage(obj)) {
      return obj;
    }
  }
  return null;
}
