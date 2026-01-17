export interface CertificateRecord {
  id: string;
  recipientName: string;
  title: string;
  issuerName: string;
  issuedAt: number;
  templateId?: string;
  templateName?: string;
  isActive: boolean;
  viewCount: number;
  createdAt: string;
}

const STORAGE_KEY = 'serenity_certificates';

export function getAllCertificates(): CertificateRecord[] {
  if (typeof window === 'undefined') return [];
  
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    const certs = data ? JSON.parse(data) : [];
    console.log(`[CertificateStore] getAllCertificates: Found ${certs.length} certificates`);
    return certs;
  } catch (error) {
    console.error('[CertificateStore] Error reading certificates:', error);
    return [];
  }
}

export function getCertificate(id: string): CertificateRecord | null {
  const certificates = getAllCertificates();
  console.log(`[CertificateStore] Looking for certificate: ${id}`);
  console.log(`[CertificateStore] Total certificates in storage: ${certificates.length}`);
  
  const found = certificates.find(c => c.id === id) || null;
  if (found) {
    console.log(`[CertificateStore] Found certificate for: ${found.recipientName}`);
  } else {
    console.log(`[CertificateStore] Certificate NOT FOUND`);
    // Log all available IDs for debugging
    if (certificates.length > 0) {
      console.log(`[CertificateStore] Available IDs: ${certificates.map(c => c.id).join(', ')}`);
    }
  }
  return found;
}

export function storeCertificate(certificate: Omit<CertificateRecord, 'createdAt' | 'viewCount' | 'isActive'>): CertificateRecord {
  const certificates = getAllCertificates();
  
  const newCert: CertificateRecord = {
    ...certificate,
    isActive: true,
    viewCount: 0,
    createdAt: new Date().toISOString(),
  };
  
  certificates.push(newCert);
  
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(certificates));
  }
  
  return newCert;
}

export function storeCertificates(certificates: Omit<CertificateRecord, 'createdAt' | 'viewCount' | 'isActive'>[]): CertificateRecord[] {
  const existingCerts = getAllCertificates();
  
  const newCerts: CertificateRecord[] = certificates.map(cert => ({
    ...cert,
    isActive: true,
    viewCount: 0,
    createdAt: new Date().toISOString(),
  }));
  
  const allCerts = [...existingCerts, ...newCerts];
  
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(allCerts));
    console.log(`[CertificateStore] Stored ${newCerts.length} new certificates. Total: ${allCerts.length}`);
    // Log certificate IDs for debugging
    newCerts.forEach(cert => console.log(`[CertificateStore] Certificate ID: ${cert.id}`));
  }
  
  return newCerts;
}

export function incrementViewCount(id: string): number {
  const certificates = getAllCertificates();
  const index = certificates.findIndex(c => c.id === id);
  
  if (index === -1) return 0;
  
  certificates[index].viewCount++;
  
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(certificates));
  }
  
  return certificates[index].viewCount;
}

export function revokeCertificate(id: string): boolean {
  const certificates = getAllCertificates();
  const index = certificates.findIndex(c => c.id === id);
  
  if (index === -1) return false;
  
  certificates[index].isActive = false;
  
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(certificates));
  }
  
  return true;
}

export function deleteCertificate(id: string): boolean {
  const certificates = getAllCertificates();
  const index = certificates.findIndex(c => c.id === id);
  
  if (index === -1) return false;
  
  certificates.splice(index, 1);
  
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(certificates));
  }
  
  return true;
}

export function clearAllCertificates(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(STORAGE_KEY);
  }
}
