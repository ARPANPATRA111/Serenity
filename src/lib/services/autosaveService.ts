export interface AutosaveData {
  canvasJSON: string;
  templateId: string | null;
  templateName: string;
  savedAt: string;
  userId: string;
}

export class AutosaveService {
  static async save(
    userId: string,
    canvasJSON: string,
    templateId?: string | null,
    templateName?: string
  ): Promise<boolean> {
    try {
      const response = await fetch('/api/autosave', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': userId,
        },
        body: JSON.stringify({
          canvasJSON,
          templateId,
          templateName,
        }),
      });

      const data = await response.json();
      return data.success;
    } catch (error) {
      console.error('[AutosaveService] Save error:', error);
      return false;
    }
  }

  static async load(userId: string): Promise<AutosaveData | null> {
    try {
      const response = await fetch('/api/autosave', {
        method: 'GET',
        headers: {
          'x-user-id': userId,
        },
      });

      const data = await response.json();
      if (data.success && data.autosave) {
        return data.autosave as AutosaveData;
      }
      return null;
    } catch (error) {
      console.error('[AutosaveService] Load error:', error);
      return null;
    }
  }

  static async clear(userId: string): Promise<boolean> {
    try {
      const response = await fetch('/api/autosave', {
        method: 'DELETE',
        headers: {
          'x-user-id': userId,
        },
      });

      const data = await response.json();
      return data.success;
    } catch (error) {
      console.error('[AutosaveService] Clear error:', error);
      return false;
    }
  }

  static async hasAutosave(userId: string): Promise<boolean> {
    const autosave = await this.load(userId);
    return autosave !== null;
  }
}
