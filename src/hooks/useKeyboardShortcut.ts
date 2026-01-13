/**
 * useKeyboardShortcut Hook
 * 
 * Handle keyboard shortcuts with proper cleanup.
 */

'use client';

import { useEffect, useCallback } from 'react';

type ModifierKey = 'ctrl' | 'shift' | 'alt' | 'meta';

interface ShortcutOptions {
  modifiers?: ModifierKey[];
  preventDefault?: boolean;
  enabled?: boolean;
}

export function useKeyboardShortcut(
  key: string,
  callback: () => void,
  options: ShortcutOptions = {}
): void {
  const {
    modifiers = [],
    preventDefault = true,
    enabled = true,
  } = options;

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!enabled) return;

      // Check modifiers
      const ctrlMatch = modifiers.includes('ctrl') === (event.ctrlKey || event.metaKey);
      const shiftMatch = modifiers.includes('shift') === event.shiftKey;
      const altMatch = modifiers.includes('alt') === event.altKey;

      // Check if all conditions match
      if (event.key.toLowerCase() === key.toLowerCase() && ctrlMatch && shiftMatch && altMatch) {
        if (preventDefault) {
          event.preventDefault();
        }
        callback();
      }
    },
    [key, callback, modifiers, preventDefault, enabled]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}

// Common shortcuts
export function useUndoShortcut(callback: () => void, enabled = true): void {
  useKeyboardShortcut('z', callback, { modifiers: ['ctrl'], enabled });
}

export function useRedoShortcut(callback: () => void, enabled = true): void {
  useKeyboardShortcut('z', callback, { modifiers: ['ctrl', 'shift'], enabled });
}

export function useSaveShortcut(callback: () => void, enabled = true): void {
  useKeyboardShortcut('s', callback, { modifiers: ['ctrl'], enabled });
}

export function useDeleteShortcut(callback: () => void, enabled = true): void {
  useKeyboardShortcut('Delete', callback, { enabled });
}

export function useEscapeShortcut(callback: () => void, enabled = true): void {
  useKeyboardShortcut('Escape', callback, { preventDefault: false, enabled });
}
