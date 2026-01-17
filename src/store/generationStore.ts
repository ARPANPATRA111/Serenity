import { create } from 'zustand';
import type { GenerationProgress } from '@/types/fabric.d';

export interface GenerationState extends GenerationProgress {
  // Cancellation
  isCancelled: boolean;
  
  // Generated artifacts
  generatedPDFs: Array<{ id: string; blob: Blob; filename: string }>;
  
  // Actions
  startGeneration: (total: number) => void;
  updateProgress: (current: number, status: string) => void;
  addError: (index: number, message: string) => void;
  addGeneratedId: (id: string) => void;
  addGeneratedPDF: (id: string, blob: Blob, filename: string) => void;
  cancelGeneration: () => void;
  reset: () => void;
  complete: () => void;
}

const initialState: GenerationProgress & { isCancelled: boolean; generatedPDFs: Array<{ id: string; blob: Blob; filename: string }> } = {
  current: 0,
  total: 0,
  status: '',
  percentage: 0,
  isGenerating: false,
  errors: [],
  generatedIds: [],
  isCancelled: false,
  generatedPDFs: [],
};

export const useGenerationStore = create<GenerationState>((set, get) => ({
  ...initialState,

  startGeneration: (total) => {
    set({
      current: 0,
      total,
      status: 'Initializing...',
      percentage: 0,
      isGenerating: true,
      errors: [],
      generatedIds: [],
      isCancelled: false,
      generatedPDFs: [],
    });
  },

  updateProgress: (current, status) => {
    const { total } = get();
    set({
      current,
      status,
      percentage: total > 0 ? (current / total) * 100 : 0,
    });
  },

  addError: (index, message) => {
    const { errors } = get();
    set({ errors: [...errors, { index, message }] });
  },

  addGeneratedId: (id) => {
    const { generatedIds } = get();
    set({ generatedIds: [...generatedIds, id] });
  },

  addGeneratedPDF: (id, blob, filename) => {
    const { generatedPDFs } = get();
    set({ generatedPDFs: [...generatedPDFs, { id, blob, filename }] });
  },

  cancelGeneration: () => {
    set({ isCancelled: true, status: 'Cancelled' });
  },

  complete: () => {
    set({
      isGenerating: false,
      status: 'Complete',
      percentage: 100,
    });
  },

  reset: () => set(initialState),
}));
