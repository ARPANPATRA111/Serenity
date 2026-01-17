import { create } from 'zustand';
import type { ParsedDataSource, DataRow } from '@/types/fabric.d';

export interface DataSourceState {
  dataSource: ParsedDataSource | null;
  headers: string[];
  rows: DataRow[];
  previewRowIndex: number;
  isLoading: boolean;
  error: string | null;
  setDataSource: (source: ParsedDataSource | null) => void;
  setPreviewRowIndex: (index: number) => void;
  clearDataSource: () => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  getPreviewRow: () => DataRow | null;
}

export const useDataSourceStore = create<DataSourceState>((set, get) => ({
  dataSource: null,
  headers: [],
  rows: [],
  previewRowIndex: 0,
  isLoading: false,
  error: null,

  setDataSource: (source) => {
    if (source) {
      set({
        dataSource: source,
        headers: source.headers,
        rows: source.rows,
        previewRowIndex: 0,
        error: null,
      });
    } else {
      get().clearDataSource();
    }
  },

  setPreviewRowIndex: (index) => {
    const { rows } = get();
    if (index >= 0 && index < rows.length) {
      set({ previewRowIndex: index });
    }
  },

  clearDataSource: () => {
    set({
      dataSource: null,
      headers: [],
      rows: [],
      previewRowIndex: 0,
      error: null,
    });
  },

  setLoading: (loading) => set({ isLoading: loading }),

  setError: (error) => set({ error, isLoading: false }),

  getPreviewRow: () => {
    const { rows, previewRowIndex } = get();
    return rows[previewRowIndex] || null;
  },
}));
