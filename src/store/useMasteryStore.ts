import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { idbStorage } from '../lib/db';

export interface MasteryState {
  flashcardReviews: number;
  feynmanScore: number;
  totalStudyTime: number; // in seconds
  addFlashcardReview: () => void;
  updateFeynmanScore: (score: number) => void;
  addStudyTime: (seconds: number) => void;
  getOverallMastery: () => number;
}

export const useMasteryStore = create<MasteryState>()(
  persist(
    (set, get) => ({
      flashcardReviews: 0,
      feynmanScore: 0,
      totalStudyTime: 0,
      
      addFlashcardReview: () => set((state) => ({ flashcardReviews: state.flashcardReviews + 1 })),
      updateFeynmanScore: (score) => set((state) => ({ feynmanScore: state.feynmanScore + score })),
      addStudyTime: (seconds) => set((state) => ({ totalStudyTime: state.totalStudyTime + seconds })),
      
      getOverallMastery: () => {
        const state = get();
        // A simple heuristic for overall mastery 0-100
        const flashcardPoints = Math.min(state.flashcardReviews * 2, 40);
        const feynmanPoints = Math.min(state.feynmanScore, 40);
        const timePoints = Math.min(Math.floor(state.totalStudyTime / 3600) * 5, 20); // 5 points per hour up to 20
        return Math.min(100, flashcardPoints + feynmanPoints + timePoints);
      }
    }),
    {
      name: 'mastery-storage',
      storage: createJSONStorage(() => idbStorage),
    }
  )
);
