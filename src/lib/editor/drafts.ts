/**
 * Unsaved-design drafts in this browser's localStorage, scoped to one account
 * and one design (`new` for a design not yet saved). A draft is written only
 * after a real change, offered back with an explicit Restore or Discard, and
 * removed on save. Every draft is removed when the account signs out, so a
 * shared computer never hands one person's design to another.
 */

export const DRAFT_PREFIX = 'serenity_draft:';

export interface Draft {
  canvasJSON: string;
  savedAt: string;
}

export function draftKey(uid: string, templateId: string | null): string {
  return `${DRAFT_PREFIX}${uid}:${templateId ?? 'new'}`;
}

function storage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function writeDraft(key: string, canvasJSON: string, now = new Date()): void {
  try {
    storage()?.setItem(key, JSON.stringify({ canvasJSON, savedAt: now.toISOString() } satisfies Draft));
  } catch {
    // Quota exceeded or storage blocked: drafts are a convenience only.
  }
}

export function readDraft(key: string): Draft | null {
  try {
    const raw = storage()?.getItem(key);
    if (!raw) return null;
    const draft = JSON.parse(raw) as Partial<Draft>;
    if (typeof draft.canvasJSON !== 'string' || typeof draft.savedAt !== 'string') return null;
    return { canvasJSON: draft.canvasJSON, savedAt: draft.savedAt };
  } catch {
    return null;
  }
}

export function removeDraft(key: string): void {
  try {
    storage()?.removeItem(key);
  } catch {
    // ignore
  }
}

/** Removes every account's drafts (sign-out, account switch). */
export function removeAllDrafts(): void {
  const store = storage();
  if (!store) return;
  try {
    const keys: string[] = [];
    for (let index = 0; index < store.length; index += 1) {
      const key = store.key(index);
      if (key?.startsWith(DRAFT_PREFIX)) keys.push(key);
    }
    keys.forEach((key) => store.removeItem(key));
  } catch {
    // ignore
  }
}

/**
 * Whether a draft should be offered: it differs from what is on the canvas,
 * and (for a saved design) it was written after the design was last saved.
 */
export function shouldOfferDraft(draft: Draft | null, currentJSON: string, templateUpdatedAt?: string | null): draft is Draft {
  if (!draft || draft.canvasJSON === currentJSON) return false;
  if (!templateUpdatedAt) return true;
  const savedAt = Date.parse(draft.savedAt);
  const updatedAt = Date.parse(templateUpdatedAt);
  return Number.isNaN(updatedAt) || savedAt > updatedAt;
}
