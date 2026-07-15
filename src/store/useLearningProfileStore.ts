import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { idbStorage } from "../lib/db";
import {
  appendBehaviorEvent,
  applyOverrides,
  applyBehaviorEvent,
  createBehaviorEvent,
  createColdStartProfile,
  deriveAdaptiveParameters,
  type AdaptiveOverrides,
  type BehaviorEventInput,
  type LearningProfile,
} from "../lib/learningProfile";

interface LearningProfileState {
  profile: LearningProfile;
  trackEvent: (input: BehaviorEventInput) => void;
  resetProfile: () => void;
  setOverrides: (overrides: Partial<AdaptiveOverrides>) => void;
  clearOverrides: () => void;
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
      setOverrides: (overrides) =>
        set((state) => {
          const userOverrides = {
            ...(state.profile.userOverrides ?? {}),
            ...overrides,
          };
          return {
            profile: {
              ...state.profile,
              userOverrides,
              parameters: applyOverrides(
                state.profile.parameters,
                userOverrides,
              ),
            },
          };
        }),
      clearOverrides: () =>
        set((state) => {
          const { parameters: _parameters, ...base } = state.profile;
          const profileWithoutOverrides = {
            ...base,
            userOverrides: undefined,
          };
          return {
            profile: {
              ...profileWithoutOverrides,
              parameters: deriveAdaptiveParameters(profileWithoutOverrides),
            },
          };
        }),
    }),
    {
      name: "learning-profile-storage",
      storage: createJSONStorage(() => idbStorage),
      version: 2,
      partialize: (state) => ({ profile: state.profile }),
      merge: (persisted, current) => {
        const saved = (persisted as Partial<LearningProfileState>)?.profile;
        if (!saved) return current;
        const cold = createColdStartProfile();
        const mergedWithoutParameters = {
          ...cold,
          ...saved,
          stats: { ...cold.stats, ...(saved.stats ?? {}) },
          responseTime: saved.responseTime ?? cold.responseTime,
          revisitRate: saved.revisitRate ?? cold.revisitRate,
          dropoffRate: saved.dropoffRate ?? cold.dropoffRate,
          abilityTheta: saved.abilityTheta ?? cold.abilityTheta,
          fatigueIndex: saved.fatigueIndex ?? 0,
          domains: saved.domains ?? {},
        };
        const { parameters: _parameters, ...base } = mergedWithoutParameters;
        return {
          ...current,
          ...(persisted as Partial<LearningProfileState>),
          profile: {
            ...base,
            parameters: deriveAdaptiveParameters(base),
          },
        };
      },
    },
  ),
);
