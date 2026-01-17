import { fabric } from 'fabric';
import type { CertificateTemplate } from '@/types/fabric';

export const TEMPLATE_IDS = ['classic', 'modern', 'course', 'workshop', 'achievement', 'corporate'] as const;
export type TemplateId = typeof TEMPLATE_IDS[number];

export async function loadTemplate(id: TemplateId): Promise<CertificateTemplate | null> {
  try {
    const response = await fetch(`/templates/${id}.json`);
    if (!response.ok) {
      throw new Error(`Template not found: ${id}`);
    }
    return response.json();
  } catch (error) {
    console.error('Failed to load template:', error);
    return null;
  }
}

export async function applyTemplate(
  canvas: fabric.Canvas,
  template: CertificateTemplate,
  fabricModule: typeof fabric
): Promise<void> {
  // Clear existing objects
  canvas.clear();

  // Set background color
  canvas.backgroundColor = template.canvas.backgroundColor;

  // Load objects
  for (const obj of template.objects) {
    let fabricObj: fabric.Object | null = null;

    switch (obj.type) {
      case 'rect':
        fabricObj = new fabricModule.Rect(obj as fabric.IRectOptions);
        break;

      case 'circle':
        fabricObj = new fabricModule.Circle(obj as fabric.ICircleOptions);
        break;

      case 'line':
        fabricObj = new fabricModule.Line([
          obj.x1 as number || 0, 
          obj.y1 as number || 0, 
          obj.x2 as number || 0, 
          obj.y2 as number || 0
        ], obj as fabric.ILineOptions);
        break;

      case 'textbox':
        fabricObj = new fabricModule.Textbox(obj.text as string || '', obj as fabric.ITextboxOptions);
        break;

      case 'VariableTextbox':
        // Import and create VariableTextbox
        const { createVariableTextbox } = await import('@/lib/fabric/VariableTextbox');
        fabricObj = createVariableTextbox(obj.text as string || '', obj as fabric.ITextboxOptions & { dynamicKey?: string });
        break;

      case 'image':
        // Skip images for now - would need to load async
        break;

      default:
        console.warn('Unknown object type:', obj.type);
    }

    if (fabricObj) {
      canvas.add(fabricObj);
    }
  }

  canvas.renderAll();
}

export function extractTemplate(
  canvas: fabric.Canvas,
  name: string,
  description: string
): CertificateTemplate {
  const objects = canvas.getObjects().map((obj) => {
    const baseProps = obj.toObject();
    
    // Check if it's a VariableTextbox
    if ('dynamicKey' in obj) {
      baseProps.type = 'VariableTextbox';
      baseProps.dynamicKey = (obj as fabric.Object & { dynamicKey?: string }).dynamicKey;
    }
    
    return baseProps;
  });

  // Extract variable keys
  const variables = objects
    .filter((obj) => obj.dynamicKey)
    .map((obj) => obj.dynamicKey);

  return {
    name,
    description,
    category: 'Custom',
    version: '1.0.0',
    canvas: {
      width: canvas.getWidth(),
      height: canvas.getHeight(),
      backgroundColor: canvas.backgroundColor as string || '#ffffff',
    },
    objects,
    variables,
  };
}

export function downloadTemplate(template: CertificateTemplate, filename?: string): void {
  const json = JSON.stringify(template, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = filename || `${template.name.toLowerCase().replace(/\s+/g, '-')}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function importTemplate(file: File): Promise<CertificateTemplate> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const template = JSON.parse(content) as CertificateTemplate;
        
        // Validate required fields
        if (!template.name || !template.canvas || !template.objects) {
          throw new Error('Invalid template format');
        }
        
        resolve(template);
      } catch (error) {
        reject(new Error('Failed to parse template file'));
      }
    };
    
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
}
