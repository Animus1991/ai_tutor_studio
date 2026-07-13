import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { idbStorage } from "../lib/db";
import {
  appendBehaviorEvent,
  applyBehaviorEvent,
  createBehaviorEvent,
  createColdStartProfile,
  type BehaviorEventInput,
  type LearningProfile,
} from "../lib/learningProfile";

interface LearningProfileState {
  profile: LearningProfile;
  trackEvent: (input: BehaviorEventInput) => void;
  resetProfile: () => void;
}

export const useLearningProfileStore = create<LearningProfileState>()(
  persist(
    (set, get) => ({
      profile: createColdStartProfile(),
      trackEvent: (input) => {
        const event = createBehaviorEvent(input);
        set({ profile: applyBehaviorEvent(get().profile, event) });
        void appendBehaviorEvent(event);
      },
      resetProfile: () => set({ profile: createColdStartProfile() }),
    }),
    {
      name: "learning-profile-storage",
      storage: createJSONStorage(() => idbStorage),
      version: 1,
      partialize: (state) => ({ profile: state.profile }),
    },
  ),
);
