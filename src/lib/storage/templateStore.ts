export interface SavedTemplate {
  id: string;
  name: string;
  canvasJSON: string;
  thumbnail?: string;
  createdAt: string;
  updatedAt: string;
  certificateCount: number;
  userId?: string;
}

const TEMPLATES_KEY = 'serenity_templates';

function generateTemplateId(): string {
  return `tpl_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
}

export function getAllTemplates(): SavedTemplate[] {
  if (typeof window === 'undefined') return [];
  
  try {
    const data = localStorage.getItem(TEMPLATES_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export function getUserTemplates(userId: string): SavedTemplate[] {
  const templates = getAllTemplates();
  return templates.filter(t => t.userId === userId);
}

export function getTemplate(id: string): SavedTemplate | null {
  const templates = getAllTemplates();
  return templates.find(t => t.id === id) || null;
}

export function saveTemplate(
  name: string,
  canvasJSON: string,
  thumbnail?: string,
  userId?: string,
  existingId?: string
): SavedTemplate {
  const templates = getAllTemplates();
  const now = new Date().toISOString();
  
  // First check if existingId was provided
  if (existingId) {
    const index = templates.findIndex(t => t.id === existingId);
    if (index !== -1) {
      templates[index] = {
        ...templates[index],
        name,
        canvasJSON,
        thumbnail: thumbnail || templates[index].thumbnail,
        updatedAt: now,
      };
      
      if (typeof window !== 'undefined') {
        localStorage.setItem(TEMPLATES_KEY, JSON.stringify(templates));
      }
      
      return templates[index];
    }
  }
  
  // Check if template with same name already exists for this user
  const existingIndex = templates.findIndex(t => t.name === name && t.userId === userId);
  if (existingIndex !== -1) {
    // Update existing template with same name
    templates[existingIndex] = {
      ...templates[existingIndex],
      canvasJSON,
      thumbnail: thumbnail || templates[existingIndex].thumbnail,
      updatedAt: now,
    };
    
    if (typeof window !== 'undefined') {
      localStorage.setItem(TEMPLATES_KEY, JSON.stringify(templates));
    }
    
    console.log(`[TemplateStore] Updated existing template: ${name}`);
    return templates[existingIndex];
  }
  
  // Create new template
  const newTemplate: SavedTemplate = {
    id: generateTemplateId(),
    name,
    canvasJSON,
    thumbnail,
    createdAt: now,
    updatedAt: now,
    certificateCount: 0,
    userId,
  };
  
  templates.push(newTemplate);
  
  if (typeof window !== 'undefined') {
    localStorage.setItem(TEMPLATES_KEY, JSON.stringify(templates));
  }
  
  console.log(`[TemplateStore] Created new template: ${name}`);
  return newTemplate;
}

export function autoSaveTemplate(
  name: string,
  canvasJSON: string,
  thumbnail?: string,
  userId?: string,
  generatedCount: number = 1
): SavedTemplate {
  const templates = getAllTemplates();
  const now = new Date().toISOString();
  
  // Check if template with same name exists for this user
  const existingIndex = templates.findIndex(
    t => t.name === name && t.userId === userId
  );
  
  if (existingIndex !== -1) {
    // Update existing template
    templates[existingIndex] = {
      ...templates[existingIndex],
      canvasJSON,
      thumbnail: thumbnail || templates[existingIndex].thumbnail,
      updatedAt: now,
      certificateCount: templates[existingIndex].certificateCount + generatedCount,
    };
    
    if (typeof window !== 'undefined') {
      localStorage.setItem(TEMPLATES_KEY, JSON.stringify(templates));
    }
    
    return templates[existingIndex];
  }
  
  // Create new template
  const newTemplate: SavedTemplate = {
    id: generateTemplateId(),
    name,
    canvasJSON,
    thumbnail,
    createdAt: now,
    updatedAt: now,
    certificateCount: generatedCount,
    userId,
  };
  
  templates.push(newTemplate);
  
  if (typeof window !== 'undefined') {
    localStorage.setItem(TEMPLATES_KEY, JSON.stringify(templates));
  }
  
  return newTemplate;
}

export function deleteTemplate(id: string): boolean {
  const templates = getAllTemplates();
  const index = templates.findIndex(t => t.id === id);
  
  if (index === -1) return false;
  
  templates.splice(index, 1);
  
  if (typeof window !== 'undefined') {
    localStorage.setItem(TEMPLATES_KEY, JSON.stringify(templates));
  }
  
  return true;
}

export function renameTemplate(id: string, newName: string): boolean {
  const templates = getAllTemplates();
  const index = templates.findIndex(t => t.id === id);
  
  if (index === -1) return false;
  
  templates[index].name = newName;
  templates[index].updatedAt = new Date().toISOString();
  
  if (typeof window !== 'undefined') {
    localStorage.setItem(TEMPLATES_KEY, JSON.stringify(templates));
  }
  
  return true;
}

export function clearAllTemplates(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(TEMPLATES_KEY);
  }
}

export function exportTemplate(id: string): string | null {
  const template = getTemplate(id);
  if (!template) return null;
  
  return JSON.stringify(template, null, 2);
}

export function importTemplate(jsonString: string, userId?: string): SavedTemplate | null {
  try {
    const data = JSON.parse(jsonString);
    
    if (!data.name || !data.canvasJSON) {
      throw new Error('Invalid template format');
    }
    
    return saveTemplate(
      data.name,
      data.canvasJSON,
      data.thumbnail,
      userId
    );
  } catch {
    return null;
  }
}
