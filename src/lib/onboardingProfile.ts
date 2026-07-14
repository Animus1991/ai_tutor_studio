/**
 * Onboarding profile — persists learner preferences and validates wizard steps.
 */

import localforage from 'localforage';

// ── Types ──────────────────────────────────────────────────────────

export type OnboardingRoleId = 'university' | 'highschool' | 'selflearner' | 'tutor' | 'professional';
export type OnboardingGoalId = 'exam' | 'mastery' | 'review' | 'exploration' | 'teaching';
export type OnboardingWizardStep = 'welcome' | 'role' | 'goals' | 'schedule';
export type OnboardingValidationError = 'roleRequired' | 'goalRequired' | 'examDateRequired' | 'examDatePast';

export interface OnboardingProfile {
  completed: boolean;
  role: OnboardingRoleId | null;
  goals: OnboardingGoalId[];
  dailyGoalMinutes: number;
  examDate: string;
  displayName: string;
  completedAt: string;
}

export interface OnboardingDraft {
  step: OnboardingWizardStep;
  selectedRole: OnboardingRoleId | null;
  selectedGoals: OnboardingGoalId[];
  dailyTime: number;
  examDate: string;
  displayName: string;
  savedAt: string;
}

// ── Persistence ────────────────────────────────────────────────────

const PROFILE_KEY = 'memora-onboarding-profile';
const DRAFT_KEY = 'memora-onboarding-draft';

export async function loadOnboardingProfile(): Promise<OnboardingProfile | null> {
  return localforage.getItem<OnboardingProfile>(PROFILE_KEY);
}

export async function saveOnboardingProfile(profile: OnboardingProfile): Promise<void> {
  await localforage.setItem(PROFILE_KEY, profile);
}

export async function hasCompletedOnboarding(): Promise<boolean> {
  const profile = await loadOnboardingProfile();
  return profile?.completed ?? false;
}

export async function loadOnboardingDraft(): Promise<OnboardingDraft | null> {
  return localforage.getItem<OnboardingDraft>(DRAFT_KEY);
}

export async function saveOnboardingDraft(draft: OnboardingDraft): Promise<void> {
  await localforage.setItem(DRAFT_KEY, { ...draft, savedAt: new Date().toISOString() });
}

export async function clearOnboardingDraft(): Promise<void> {
  await localforage.removeItem(DRAFT_KEY);
}

export function isResumedDraft(draft: OnboardingDraft): boolean {
  return draft.step !== 'welcome' || draft.selectedRole !== null || draft.selectedGoals.length > 0;
}

// ── Validation ─────────────────────────────────────────────────────

export function validateOnboardingStep(
  step: OnboardingWizardStep,
  data: { role: OnboardingRoleId | null; goals: OnboardingGoalId[]; examDate: string },
): OnboardingValidationError | null {
  if (step === 'role' && !data.role) return 'roleRequired';
  if (step === 'goals' && data.goals.length === 0) return 'goalRequired';
  if (step === 'schedule' && data.goals.includes('exam')) {
    if (!data.examDate) return 'examDateRequired';
    if (new Date(data.examDate) < new Date()) return 'examDatePast';
  }
  return null;
}
