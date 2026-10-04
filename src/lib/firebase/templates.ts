import { getAdminFirestore } from './admin';
import { FieldValue } from 'firebase-admin/firestore';

export interface CertificateMetadata {
  title: string;
  issuedBy: string;
  description: string;
  category?: string;
  eventId?: string;
}

export interface Template {
  id: string;
  name: string;
  canvasJSON: string;
  thumbnail?: string;
  createdAt: string;
  updatedAt: string;
  certificateCount: number;
  userId?: string;
  isPublic: boolean;
  creatorName?: string;
  creatorEmail?: string;
  stars: number;
  tags?: string[];
  category?: string;
  certificateMetadata?: CertificateMetadata;
  normalizedName?: string;
  schemaVersion?: 2;
  publicationStatus?: 'private' | 'pending_review' | 'public' | 'rejected';
  publicationRequestedAt?: string;
  publishedAt?: string;
  reviewedAt?: string;
  source?: 'user' | 'serenity_curated';
}

export interface CreateTemplateInput {
  name: string;
  canvasJSON: string;
  thumbnail?: string;
  userId?: string;
  isPublic?: boolean;
  creatorName?: string;
  creatorEmail?: string;
  tags?: string[];
  category?: string;
  certificateMetadata?: CertificateMetadata;
}

export interface UpdateTemplateInput {
  name?: string;
  canvasJSON?: string;
  thumbnail?: string;
  isPublic?: boolean;
  tags?: string[];
  category?: string;
  certificateMetadata?: CertificateMetadata;
  normalizedName?: string;
  schemaVersion?: 2;
  publicationStatus?: 'private' | 'pending_review' | 'public' | 'rejected';
  publicationRequestedAt?: string;
  publishedAt?: string;
  reviewedAt?: string;
  source?: 'user' | 'serenity_curated';
}

const COLLECTION = 'templates';

export function normalizeTemplateName(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLocaleLowerCase('en-US');
}

function generateTemplateId(): string {
  return `tpl_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
}

export async function createTemplate(input: CreateTemplateInput): Promise<Template> {
  const db = getAdminFirestore();
  const now = new Date().toISOString();
  
  // Build template object
  const template: Template = {
    id: generateTemplateId(),
    name: input.name,
    canvasJSON: input.canvasJSON,
    thumbnail: input.thumbnail,
    createdAt: now,
    updatedAt: now,
    certificateCount: 0,
    userId: input.userId,
    isPublic: input.isPublic ?? false,
    creatorName: input.creatorName,
    creatorEmail: input.creatorEmail,
    stars: 0,
    tags: input.tags || [],
    category: input.category,
    certificateMetadata: input.certificateMetadata,
    normalizedName: normalizeTemplateName(input.name),
    schemaVersion: 2,
    publicationStatus: input.isPublic ? 'public' : 'private',
    source: 'user',
  };

  // Remove undefined values to avoid Firestore issues
  const cleanedTemplate = Object.fromEntries(
    Object.entries(template).filter(([, v]) => v !== undefined)
  ) as Template;

  await db.collection(COLLECTION).doc(template.id).set(cleanedTemplate);
  
  return template;
}

export async function getTemplate(id: string): Promise<Template | null> {
  const db = getAdminFirestore();
  const doc = await db.collection(COLLECTION).doc(id).get();
  
  if (!doc.exists) {
    return null;
  }
  
  return doc.data() as Template;
}

export async function updateTemplate(id: string, updates: UpdateTemplateInput): Promise<Template | null> {
  const db = getAdminFirestore();
  const docRef = db.collection(COLLECTION).doc(id);
  const doc = await docRef.get();
  
  if (!doc.exists) {
    console.log(`[Firebase Templates] Template not found for update: ${id}`);
    return null;
  }
  
  // Filter out undefined values - Firestore doesn't accept them
  const filteredUpdates: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(updates)) {
    if (value !== undefined) {
      filteredUpdates[key] = value;
    }
  }
  
  const updateData = {
    ...filteredUpdates,
    updatedAt: new Date().toISOString(),
  };
  
  await docRef.update(updateData);
  
  const updated = await docRef.get();
  console.log(`[Firebase Templates] Updated template: ${id}`);
  
  return updated.data() as Template;
}

export async function deleteTemplate(id: string): Promise<boolean> {
  const db = getAdminFirestore();
  const docRef = db.collection(COLLECTION).doc(id);
  const doc = await docRef.get();
  
  if (!doc.exists) {
    return false;
  }
  
  await docRef.delete();
  console.log(`[Firebase Templates] Deleted template: ${id}`);
  
  return true;
}

export async function getUserTemplates(userId: string): Promise<Template[]> {
  const db = getAdminFirestore();
  
  try {
    // Simple query without compound ordering to avoid index requirements
    const snapshot = await db
      .collection(COLLECTION)
      .where('userId', '==', userId)
      .get();
    
    // Sort in memory, exclude canvasJSON for performance
    return snapshot.docs
      .map(doc => {
        const data = doc.data() as Template;
        const { canvasJSON, ...rest } = data;
        return { ...rest, canvasJSON: '' } as Template;
      })
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  } catch (error) {
    console.error('[Firebase Templates] Error getting user templates:', error);
    return [];
  }
}

export async function findTemplateByNormalizedName(
  userId: string,
  name: string,
  excludeId?: string,
): Promise<Template | null> {
  const db = getAdminFirestore();
  const snapshot = await db.collection(COLLECTION)
    .where('userId', '==', userId)
    .where('normalizedName', '==', normalizeTemplateName(name))
    .limit(2)
    .get();

  const document = snapshot.docs.find((candidate) => candidate.id !== excludeId);
  return document ? document.data() as Template : null;
}

export async function getPublicTemplates(limit: number = 50): Promise<Template[]> {
  const db = getAdminFirestore();
  
  try {
    const snapshot = await db
      .collection(COLLECTION)
      .where('isPublic', '==', true)
      .limit(limit)
      .get();
    
    // Sort in memory by stars first, then by updatedAt
    // Exclude canvasJSON to reduce payload size for listing
    return snapshot.docs
      .map(doc => {
        const data = doc.data() as Template;
        // Return template without canvasJSON for listing (it's large)
        const { canvasJSON, ...rest } = data;
        return { ...rest, canvasJSON: '' } as Template;
      })
      .sort((a, b) => {
        if (b.stars !== a.stars) return b.stars - a.stars;
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      });
  } catch (error) {
    console.error('[Firebase Templates] Error getting public templates:', error);
    return [];
  }
}

export async function searchTemplates(query: string, publicOnly: boolean = true): Promise<Template[]> {
  const db = getAdminFirestore();
  const normalizedQuery = normalizeTemplateName(query);
  let firestoreQuery: FirebaseFirestore.Query = db.collection(COLLECTION);
  if (publicOnly) firestoreQuery = firestoreQuery.where('isPublic', '==', true);
  const snapshot = await firestoreQuery
    .orderBy('normalizedName', 'asc')
    .startAt(normalizedQuery)
    .endAt(`${normalizedQuery}\uf8ff`)
    .limit(25)
    .get();

  return snapshot.docs
    .map(doc => {
      const data = doc.data() as Template;
      const { canvasJSON, ...rest } = data;
      return { ...rest, canvasJSON: '' } as Template;
    })
    .sort((a, b) => b.stars - a.stars);
}

export async function incrementCertificateCount(id: string, count: number = 1): Promise<void> {
  const db = getAdminFirestore();
  const docRef = db.collection(COLLECTION).doc(id);
  
  await docRef.update({
    certificateCount: FieldValue.increment(count),
    updatedAt: new Date().toISOString(),
  });
  
  console.log(`[Firebase Templates] Incremented certificate count for ${id} by ${count}`);
}

export async function toggleTemplateStar(templateId: string, userId: string): Promise<{ starred: boolean; stars: number }> {
  const db = getAdminFirestore();
  const templateRef = db.collection(COLLECTION).doc(templateId);
  const starRef = db.collection('template_stars').doc(`${templateId}_${userId}`);
  
  const [templateDoc, starDoc] = await Promise.all([
    templateRef.get(),
    starRef.get(),
  ]);
  
  if (!templateDoc.exists) {
    throw new Error('Template not found');
  }
  
  const isStarred = starDoc.exists;
  
  if (isStarred) {
    // Remove star
    await Promise.all([
      starRef.delete(),
      templateRef.update({ stars: FieldValue.increment(-1) }),
    ]);
  } else {
    // Add star
    await Promise.all([
      starRef.set({ 
        templateId, 
        userId, 
        createdAt: new Date().toISOString() 
      }),
      templateRef.update({ stars: FieldValue.increment(1) }),
    ]);
  }
  
  const updated = await templateRef.get();
  const stars = (updated.data() as Template).stars;
  
  return { starred: !isStarred, stars };
}

export async function hasUserStarredTemplate(templateId: string, userId: string): Promise<boolean> {
  const db = getAdminFirestore();
  const starDoc = await db.collection('template_stars').doc(`${templateId}_${userId}`).get();
  return starDoc.exists;
}

export async function setTemplateVisibility(id: string, isPublic: boolean): Promise<Template | null> {
  return updateTemplate(id, { isPublic });
}

export async function saveOrUpdateTemplate(
  input: CreateTemplateInput & { existingId?: string }
): Promise<Template> {
  const { existingId, ...createInput } = input;
  
  if (existingId) {
    // Check if template exists
    const existing = await getTemplate(existingId);
    
    if (existing) {
      // Build update object, only including defined values
      const updateData: UpdateTemplateInput = {
        name: createInput.name,
        canvasJSON: createInput.canvasJSON,
        thumbnail: createInput.thumbnail,
      };
      
      // Only include isPublic if it's explicitly a boolean
      if (typeof createInput.isPublic === 'boolean') {
        updateData.isPublic = createInput.isPublic;
      }
      
      // Only include tags if defined
      if (createInput.tags !== undefined) {
        updateData.tags = createInput.tags;
      }

      // Include category if defined
      if (createInput.category !== undefined) {
        updateData.category = createInput.category;
      }

      // Include certificateMetadata if defined
      if (createInput.certificateMetadata !== undefined) {
        updateData.certificateMetadata = createInput.certificateMetadata;
      }
      
      // Update existing template
      const updated = await updateTemplate(existingId, updateData);
      
      if (updated) {
        return updated;
      }
    }
  }
  
  // Create new template
  return createTemplate(createInput);
}
