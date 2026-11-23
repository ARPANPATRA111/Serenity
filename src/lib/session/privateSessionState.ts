'use client';

import { useDataSourceStore } from '@/store/dataSourceStore';
import { useEditorStore } from '@/store/editorStore';
import { useGenerationStore } from '@/store/generationStore';
import { clearCoordinatedRequests, clearSessionJson } from '@/lib/api/requestCoordinator';
import { removeAllDrafts } from '@/lib/editor/drafts';

/**
 * localStorage key of the editor's old, unscoped crash draft. Earlier
 * releases wrote it; it is removed on start and whenever the account changes.
 */
export const CANVAS_AUTOSAVE_KEY = 'serenity_canvas_autosave';

/**
 * Clears everything one signed-in session holds in the browser that the next
 * session must not see: the imported spreadsheet (recipient names and
 * emails), generation results, the open template's details and media list,
 * cached API responses, and the unscoped editor draft.
 *
 * Server data is untouched. A generation already running keeps the account
 * token it started with, so its records are still saved to that account; it
 * is asked to stop.
 */
export function clearPrivateSessionState(): void {
  useDataSourceStore.getState().clearDataSource();

  const generation = useGenerationStore.getState();
  if (generation.isGenerating) generation.cancelGeneration();
  else generation.reset();

  useEditorStore.getState().reset();
  clearCoordinatedRequests();
  clearSessionJson();

  if (typeof window !== 'undefined') {
    try {
      window.localStorage.removeItem(CANVAS_AUTOSAVE_KEY);
    } catch {
      // Storage can be unavailable in private browsing.
    }
    // This account's unsaved-design drafts (see drafts.ts).
    removeAllDrafts();
  }
}
