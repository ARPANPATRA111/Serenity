/**
 * Firebase Templates Module
 * 
 * Server-side Firestore operations for template management.
 * Replaces localStorage-based template storage with cloud persistence.
 */

import { getAdminFirestore } from './admin';
import { FieldValue } from 'firebase-admin/firestore';

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
}

export interface UpdateTemplateInput {
  name?: string;
  canvasJSON?: string;
  thumbnail?: string;
  isPublic?: boolean;
  tags?: string[];
}

const COLLECTION = 'templates';

/**
 * Generate a unique template ID
 */
function generateTemplateId(): string {
  return `tpl_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
}

/**
 * Create a new template
 */
export async function createTemplate(input: CreateTemplateInput): Promise<Template> {
  const db = getAdminFirestore();
  const now = new Date().toISOString();
  
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
  };

  await db.collection(COLLECTION).doc(template.id).set(template);
  console.log(`[Firebase Templates] Created template: ${template.name} (${template.id})`);
  
  return template;
}

/**
 * Get a template by ID
 */
export async function getTemplate(id: string): Promise<Template | null> {
  const db = getAdminFirestore();
  const doc = await db.collection(COLLECTION).doc(id).get();
  
  if (!doc.exists) {
    return null;
  }
  
  return doc.data() as Template;
}

/**
 * Update an existing template
 */
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

/**
 * Delete a template
 */
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

/**
 * Get all templates for a specific user
 */
export async function getUserTemplates(userId: string): Promise<Template[]> {
  const db = getAdminFirestore();
  
  try {
    // Simple query without compound ordering to avoid index requirements
    const snapshot = await db
      .collection(COLLECTION)
      .where('userId', '==', userId)
      .get();
    
    // Sort in memory
    return snapshot.docs
      .map(doc => doc.data() as Template)
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  } catch (error) {
    console.error('[Firebase Templates] Error getting user templates:', error);
    return [];
  }
}

/**
 * Get all public templates
 */
export async function getPublicTemplates(limit: number = 50): Promise<Template[]> {
  const db = getAdminFirestore();
  
  try {
    // Simple query without compound ordering to avoid index requirements  
    const snapshot = await db
      .collection(COLLECTION)
      .where('isPublic', '==', true)
      .limit(limit * 2) // Get more to account for sorting
      .get();
    
    // Sort in memory by stars first, then by updatedAt
    return snapshot.docs
      .map(doc => doc.data() as Template)
      .sort((a, b) => {
        if (b.stars !== a.stars) return b.stars - a.stars;
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      })
      .slice(0, limit);
  } catch (error) {
    console.error('[Firebase Templates] Error getting public templates:', error);
    return [];
  }
}

/**
 * Search templates by name or tags
 */
export async function searchTemplates(query: string, publicOnly: boolean = true): Promise<Template[]> {
  const db = getAdminFirestore();
  let baseQuery = db.collection(COLLECTION);
  
  // Firestore doesn't support full-text search, so we'll get templates and filter
  const snapshot = publicOnly 
    ? await baseQuery.where('isPublic', '==', true).get()
    : await baseQuery.get();
  
  const lowerQuery = query.toLowerCase();
  
  return snapshot.docs
    .map(doc => doc.data() as Template)
    .filter(template => 
      template.name.toLowerCase().includes(lowerQuery) ||
      template.tags?.some(tag => tag.toLowerCase().includes(lowerQuery))
    )
    .sort((a, b) => b.stars - a.stars);
}

/**
 * Increment certificate count for a template
 */
export async function incrementCertificateCount(id: string, count: number = 1): Promise<void> {
  const db = getAdminFirestore();
  const docRef = db.collection(COLLECTION).doc(id);
  
  await docRef.update({
    certificateCount: FieldValue.increment(count),
    updatedAt: new Date().toISOString(),
  });
  
  console.log(`[Firebase Templates] Incremented certificate count for ${id} by ${count}`);
}

/**
 * Toggle star on a template
 */
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

/**
 * Check if user has starred a template
 */
export async function hasUserStarredTemplate(templateId: string, userId: string): Promise<boolean> {
  const db = getAdminFirestore();
  const starDoc = await db.collection('template_stars').doc(`${templateId}_${userId}`).get();
  return starDoc.exists;
}

/**
 * Make a template public or private
 */
export async function setTemplateVisibility(id: string, isPublic: boolean): Promise<Template | null> {
  return updateTemplate(id, { isPublic });
}

/**
 * Save or update template (handles both create and update)
 */
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
