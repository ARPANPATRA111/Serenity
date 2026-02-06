import QRCode from 'qrcode';

export interface QRCodeOptions {
  width?: number;
  margin?: number;
  color?: {
    dark?: string;
    light?: string;
  };
  errorCorrectionLevel?: 'L' | 'M' | 'Q' | 'H';
}

const DEFAULT_OPTIONS: QRCodeOptions = {
  width: 128,
  margin: 2,
  color: {
    dark: '#000000',
    light: '#ffffff',
  },
  errorCorrectionLevel: 'M',
};

export async function generateQRCodeDataURL(
  data: string,
  options: QRCodeOptions = {}
): Promise<string> {
  const mergedOptions = { ...DEFAULT_OPTIONS, ...options };
  
  return QRCode.toDataURL(data, {
    width: mergedOptions.width,
    margin: mergedOptions.margin,
    color: mergedOptions.color,
    errorCorrectionLevel: mergedOptions.errorCorrectionLevel,
  });
}

export function generateVerificationURL(certificateId: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
  return `${baseUrl}/verify/${certificateId}`;
}

export async function generateCertificateQRCode(
  certificateId: string,
  options: QRCodeOptions = {}
): Promise<string> {
  const verificationUrl = generateVerificationURL(certificateId);
  return generateQRCodeDataURL(verificationUrl, options);
}

export async function generateQRCodeCanvas(
  data: string,
  options: QRCodeOptions = {}
): Promise<HTMLCanvasElement> {
  const mergedOptions = { ...DEFAULT_OPTIONS, ...options };
  
  const canvas = document.createElement('canvas');
  
  await QRCode.toCanvas(canvas, data, {
    width: mergedOptions.width,
    margin: mergedOptions.margin,
    color: mergedOptions.color,
    errorCorrectionLevel: mergedOptions.errorCorrectionLevel,
  });
  
  return canvas;
}
