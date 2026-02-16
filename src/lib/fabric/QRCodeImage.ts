import { fabric } from 'fabric';
import { generateQRCodeDataURL as generateQRCode, QRCodeOptions } from '../qrcode';

// QR Code generation constants
const QR_SIZE = 200;

export interface QRCodeImageOptions extends fabric.IImageOptions {
  size?: number;
  qrColor?: string;
  qrBackgroundColor?: string;
}

export async function generateQRCodeDataURL(
  verificationId: string,
  size: number = QR_SIZE,
  color: string = '#000000',
  backgroundColor: string = '#ffffff'
): Promise<string> {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://serenity.app';
  const verifyUrl = `${baseUrl}/verify/${verificationId}`;
  
  try {
    const dataUrl = await generateQRCode(verifyUrl, {
      width: size,
      margin: 1,
      color: {
        dark: color,
        light: backgroundColor,
      },
      errorCorrectionLevel: 'M',
    });
    return dataUrl;
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
  ctx.fillRect(16, 16, size - 32, size - 32);
  
  ctx.fillStyle = '#9ca3af';
  ctx.font = '12px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('QR Code', size / 2, size / 2);
  
  return canvas.toDataURL('image/png');
}

export async function createQRCodeImage(
  verificationId: string,
  options?: QRCodeImageOptions
): Promise<fabric.Image & { 
  verificationId: string; 
  qrColor: string;
  qrBackgroundColor: string;
  updateVerificationId: (id: string) => Promise<void>;
  updateQRStyle: (color: string, backgroundColor: string) => Promise<void>;
}> {
  const size = options?.size || QR_SIZE;
  const qrColor = options?.qrColor || '#000000';
  const qrBackgroundColor = options?.qrBackgroundColor || '#ffffff';
  const dataUrl = await generateQRCodeDataURL(verificationId, size, qrColor, qrBackgroundColor);
  
  return new Promise((resolve, reject) => {
    fabric.Image.fromURL(dataUrl, (img) => {
      if (!img) {
        reject(new Error('Failed to create QR code image'));
        return;
      }
      
      // Add custom properties
      const qrImage = img as fabric.Image & {
        verificationId: string;
        qrColor: string;
        qrBackgroundColor: string;
        updateVerificationId: (id: string) => Promise<void>;
        updateQRStyle: (color: string, backgroundColor: string) => Promise<void>;
      };
      
      qrImage.verificationId = verificationId;
      qrImage.qrColor = qrColor;
      qrImage.qrBackgroundColor = qrBackgroundColor;
      
      // Method to update the QR code with a new ID
      qrImage.updateVerificationId = async function(id: string) {
        this.verificationId = id;
        const newDataUrl = await generateQRCodeDataURL(id, size, this.qrColor, this.qrBackgroundColor);
        
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

      // Method to update QR code color/style
      qrImage.updateQRStyle = async function(color: string, backgroundColor: string) {
        this.qrColor = color;
        this.qrBackgroundColor = backgroundColor;
        const newDataUrl = await generateQRCodeDataURL(this.verificationId, size, color, backgroundColor);
        
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
  // Override toObject for QR code images to include verificationId and colors
  const originalToObject = fabric.Image.prototype.toObject;
  fabric.Image.prototype.toObject = function(propertiesToInclude?: string[]) {
    const obj = originalToObject.call(this, propertiesToInclude);
    const qrImage = this as fabric.Image & { 
      verificationId?: string;
      qrColor?: string;
      qrBackgroundColor?: string;
    };
    if (qrImage.verificationId) {
      obj.verificationId = qrImage.verificationId;
      obj.qrColor = qrImage.qrColor || '#000000';
      obj.qrBackgroundColor = qrImage.qrBackgroundColor || '#ffffff';
    }
    return obj;
  };
}

export function isQRCodeImage(obj: fabric.Object): obj is fabric.Image & { 
  verificationId: string; 
  qrColor: string;
  qrBackgroundColor: string;
  updateVerificationId?: (id: string) => Promise<void>;
  updateQRStyle?: (color: string, backgroundColor: string) => Promise<void>;
} {
  return obj.type === 'image' && !!(obj as fabric.Image & { verificationId?: string }).verificationId;
}

export function findQRCodeImage(canvas: fabric.Canvas | fabric.StaticCanvas): (fabric.Image & { 
  verificationId: string; 
  qrColor: string;
  qrBackgroundColor: string;
  updateVerificationId?: (id: string) => Promise<void>;
  updateQRStyle?: (color: string, backgroundColor: string) => Promise<void>;
}) | null {
  const objects = canvas.getObjects();
  for (const obj of objects) {
    if (isQRCodeImage(obj)) {
      return obj;
    }
  }
  return null;
}
