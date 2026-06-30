import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { idbStorage } from '../lib/db';

export interface DocumentState {
  pageNumber: number;
  setPageNumber: (page: number) => void;
  notes: string;
  setNotes: (notes: string) => void;
  metadata: {
    annotations: any[];
    linkedConcepts: string[];
    generatedImages: { url: string; prompt: string }[];
  };
  setMetadata: (metadata: any) => void;
  _hasHydrated: boolean;
  setHasHydrated: (state: boolean) => void;
}

export const useDocumentStore = create<DocumentState>()(
  persist(
    (set) => ({
      pageNumber: 1,
      setPageNumber: (pageNumber) => set({ pageNumber }),
      notes: "<p>Start your notes here...</p>",
      setNotes: (notes) => set({ notes }),
      metadata: {
        annotations: [],
        linkedConcepts: [],
        generatedImages: [],
      },
      setMetadata: (metadata) => set({ metadata }),
      _hasHydrated: false,
      setHasHydrated: (state) => set({ _hasHydrated: state })
    }),
    {
      name: 'document-storage',
      storage: createJSONStorage(() => idbStorage),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true)
      }
    }
  )
);
