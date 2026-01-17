import {
  collection,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  increment,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from './client';
import type { CertificateRecord } from '@/types/fabric.d';

const CERTIFICATES_COLLECTION = 'certificates';

export async function createCertificate(certificate: CertificateRecord): Promise<void> {
  const docRef = doc(db, CERTIFICATES_COLLECTION, certificate.id);
  await setDoc(docRef, {
    ...certificate,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function getCertificate(id: string): Promise<CertificateRecord | null> {
  const docRef = doc(db, CERTIFICATES_COLLECTION, id);
  const docSnap = await getDoc(docRef);
  
  if (!docSnap.exists()) {
    return null;
  }
  
  return docSnap.data() as CertificateRecord;
}

export async function updateCertificate(
  id: string,
  updates: Partial<CertificateRecord>
): Promise<void> {
  const docRef = doc(db, CERTIFICATES_COLLECTION, id);
  await updateDoc(docRef, {
    ...updates,
    updatedAt: serverTimestamp(),
  });
}

export async function incrementViewCount(id: string): Promise<void> {
  const docRef = doc(db, CERTIFICATES_COLLECTION, id);
  await updateDoc(docRef, {
    viewCount: increment(1),
  });
}

export async function deleteCertificate(id: string): Promise<void> {
  const docRef = doc(db, CERTIFICATES_COLLECTION, id);
  await deleteDoc(docRef);
}

export async function getCertificatesByTemplate(
  templateId: string,
  limitCount: number = 100
): Promise<CertificateRecord[]> {
  const q = query(
    collection(db, CERTIFICATES_COLLECTION),
    where('templateId', '==', templateId),
    orderBy('issuedAt', 'desc'),
    limit(limitCount)
  );
  
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map((doc) => doc.data() as CertificateRecord);
}

export async function getCertificatesByRecipient(
  emailHash: string,
  limitCount: number = 100
): Promise<CertificateRecord[]> {
  const q = query(
    collection(db, CERTIFICATES_COLLECTION),
    where('recipientEmailHash', '==', emailHash),
    orderBy('issuedAt', 'desc'),
    limit(limitCount)
  );
  
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map((doc) => doc.data() as CertificateRecord);
}

export async function batchCreateCertificates(
  certificates: CertificateRecord[]
): Promise<void> {
  // Firestore batch writes are limited to 500 operations
  const batchSize = 500;
  
  for (let i = 0; i < certificates.length; i += batchSize) {
    const batch = certificates.slice(i, i + batchSize);
    
    await Promise.all(
      batch.map((cert) => createCertificate(cert))
    );
  }
}
