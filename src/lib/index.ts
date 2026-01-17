export * from './utils';

// QR Code (exported with prefix to avoid conflicts)
export { 
  generateQRCodeDataURL as generateQRCode,
  generateVerificationURL,
  generateCertificateQRCode 
} from './qrcode';

// Fabric.js (re-export)
export * from './fabric';

// Excel parsing (re-export)
export * from './excel';

// Generator (re-export)
export * from './generator';

// Templates (re-export)
export * from './templates';

// Firebase (re-export selectively)
export { app as firebaseApp, initializeFirebase } from './firebase';
