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
  profilingEnabled: boolean;
  trackEvent: (input: BehaviorEventInput) => void;
  resetProfile: () => void;
  setProfilingEnabled: (enabled: boolean) => void;
  setOverrides: (overrides: Partial<AdaptiveOverrides>) => void;
  clearOverrides: () => void;
}

export const useLearningProfileStore = create<LearningProfileState>()(
  persist(
    (set, get) => ({
      profile: createColdStartProfile(),
      profilingEnabled: true,
      trackEvent: (input) => {
        if (!get().profilingEnabled) return;
        const event = createBehaviorEvent(input);
        set({ profile: applyBehaviorEvent(get().profile, event) });
        void appendBehaviorEvent(event);
      },
      resetProfile: () => set({ profile: createColdStartProfile() }),
      setProfilingEnabled: (enabled) => set({ profilingEnabled: enabled }),
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
      version: 3,
      partialize: (state) => ({
        profile: state.profile,
        profilingEnabled: state.profilingEnabled,
      }),
      migrate: (persisted, version) => {
        const saved = persisted as Partial<LearningProfileState>;
        if (version < 3) {
          return {
            profile: saved.profile ?? createColdStartProfile(),
            profilingEnabled: saved.profilingEnabled ?? true,
          } as LearningProfileState;
        }
        return saved as LearningProfileState;
      },
      merge: (persisted, current) => {
        const saved = (persisted as Partial<LearningProfileState>)?.profile;
        const profilingEnabled =
          (persisted as Partial<LearningProfileState>)?.profilingEnabled ??
          true;
        if (!saved) {
          return { ...current, profilingEnabled };
        }
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
          profilingEnabled,
          profile: {
            ...base,
            parameters: deriveAdaptiveParameters(base),
          },
        };
      },
    },
  ),
);
