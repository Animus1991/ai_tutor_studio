/**
 * Quiz IRT (Item Response Theory) — Rasch 1PL adaptive scoring.
 *
 * Tracks learner ability (θ) per workspace scope, estimates item difficulty,
 * and provides human-readable readiness / confidence metrics.
 */

import localforage from 'localforage';

// ── Types ──────────────────────────────────────────────────────────

export type QuizIrtState = {
  ability: number;
  responses: number;
  correct: number;
  lastUpdated: string;
};

export type QuizIrtDisplay = {
  ability: number;
  difficulty: number;
  targetDifficulty: number;
  passProbability: number;
};

export type QuizIrtConfidenceTier = 'unknown' | 'low' | 'medium' | 'high';

export type QuizIrtConfidenceBand = {
  pointPct: number;
  lowPct: number;
  highPct: number;
  tier: QuizIrtConfidenceTier;
  bandLabel: string;
  rangeLabel: string;
};

export type QuizIrtLearnerCopy = {
  readinessLabel: string;
  difficultyLabel: string;
  probabilityLabel: string;
  hint: string;
};

// ── Persistence ────────────────────────────────────────────────────

const IRT_STORE_KEY = 'memora-quiz-irt';

let irtCache: Record<string, QuizIrtState> | null = null;

async function loadAll(): Promise<Record<string, QuizIrtState>> {
  if (irtCache) return irtCache;
  irtCache = (await localforage.getItem<Record<string, QuizIrtState>>(IRT_STORE_KEY)) ?? {};
  return irtCache;
}

async function saveAll(data: Record<string, QuizIrtState>): Promise<void> {
  irtCache = data;
  await localforage.setItem(IRT_STORE_KEY, data);
}

export async function loadQuizIrt(scopeKey: string): Promise<QuizIrtState> {
  const all = await loadAll();
  return all[scopeKey] ?? { ability: 0, responses: 0, correct: 0, lastUpdated: '' };
}

export async function saveQuizIrt(scopeKey: string, state: QuizIrtState): Promise<void> {
  const all = await loadAll();
  all[scopeKey] = state;
  await saveAll(all);
}

// ── IRT Math ───────────────────────────────────────────────────────

/** P(correct | θ, b) — Rasch 1PL logistic model. */
export function probabilityCorrect(ability: number, difficulty: number): number {
  const x = ability - difficulty;
  return 1 / (1 + Math.exp(-x));
}

/** Heuristic item difficulty from question structure. */
export function estimateQuizDifficulty(optionCount: number): number {
  if (optionCount >= 5) return 1.4;
  if (optionCount >= 4) return 1.0;
  if (optionCount >= 3) return 0.8;
  return 0.6;
}

/**
 * Target difficulty for adaptive selection — zone of proximal development (~65% P).
 * Blends calibrated ability with concept mastery.
 */
export function targetQuizDifficulty(ability: number, conceptMastery = 50): number {
  const masteryNorm = (conceptMastery - 50) / 25;
  const blended = ability * 0.65 + masteryNorm * 0.35;
  return blended + 0.35;
}

/**
 * Update learner ability after a response (online EAP-style delta rule).
 * Nudges ability toward mastery bus when sample is small.
 */
export function updateQuizAbility(
  state: QuizIrtState,
  difficulty: number,
  correct: boolean,
  conceptMastery = 50,
): QuizIrtState {
  const p = probabilityCorrect(state.ability, difficulty);
  const residual = (correct ? 1 : 0) - p;
  const learningRate = state.responses < 5 ? 0.55 : 0.35;
  let ability = state.ability + learningRate * residual;

  // Cold-start prior from concept mastery bus
  if (state.responses < 3) {
    const masteryPrior = (conceptMastery - 50) / 30;
    ability = ability * 0.7 + masteryPrior * 0.3;
  }

  return {
    ability: Math.max(-3, Math.min(3, ability)),
    responses: state.responses + 1,
    correct: state.correct + (correct ? 1 : 0),
    lastUpdated: new Date().toISOString(),
  };
}

/** Record a quiz response and persist updated IRT state. */
export async function recordQuizResponse(
  scopeKey: string,
  optionCount: number,
  correct: boolean,
  conceptMastery = 50,
): Promise<QuizIrtState> {
  const prev = await loadQuizIrt(scopeKey);
  const difficulty = estimateQuizDifficulty(optionCount);
  const next = updateQuizAbility(prev, difficulty, correct, conceptMastery);
  await saveQuizIrt(scopeKey, next);
  return next;
}

// ── Display helpers ────────────────────────────────────────────────

export function buildQuizIrtDisplay(
  optionCount: number,
  ability: number,
  conceptMastery = 50,
): QuizIrtDisplay {
  const difficulty = estimateQuizDifficulty(optionCount);
  return {
    ability,
    difficulty,
    targetDifficulty: targetQuizDifficulty(ability, conceptMastery),
    passProbability: probabilityCorrect(ability, difficulty),
  };
}

/** Visual confidence band for pass probability — narrows as responses accumulate. */
export function buildQuizIrtConfidenceBand(
  irt: QuizIrtDisplay,
  responseCount: number,
  isGreek: boolean,
): QuizIrtConfidenceBand {
  const pointPct = Math.round(irt.passProbability * 100);
  const margin =
    responseCount === 0 ? 25 : responseCount < 3 ? 18 : responseCount < 8 ? 12 : 8;
  const lowPct = Math.max(0, pointPct - margin);
  const highPct = Math.min(100, pointPct + margin);

  const tier: QuizIrtConfidenceTier =
    responseCount === 0
      ? 'unknown'
      : pointPct < 40
        ? 'low'
        : pointPct < 70
          ? 'medium'
          : 'high';

  const bandLabel =
    tier === 'unknown'
      ? isGreek ? 'Εκτιμώμενο εύρος (βαθμονόμηση…)' : 'Estimated range (calibrating…)'
      : tier === 'low'
        ? isGreek ? 'Χαμηλή πιθανότητα επιτυχίας' : 'Low success likelihood'
        : tier === 'medium'
          ? isGreek ? 'Μέτρια πιθανότητα επιτυχίας' : 'Moderate success likelihood'
          : isGreek ? 'Υψηλή πιθανότητα επιτυχίας' : 'High success likelihood';

  const rangeLabel = isGreek
    ? `${lowPct}–${highPct}% εκτιμώμενη επιτυχία`
    : `${lowPct}–${highPct}% estimated success`;

  return { pointPct, lowPct, highPct, tier, bandLabel, rangeLabel };
}

/** User-facing quiz metrics — replaces raw θ/b/P values. */
export function formatQuizIrtForLearner(
  irt: QuizIrtDisplay,
  isGreek: boolean,
  responseCount = 0,
): QuizIrtLearnerCopy {
  const pct = Math.round(irt.passProbability * 100);

  const readinessLabel = responseCount === 0
    ? (isGreek ? 'Ετοιμότητα: Άγνωστη' : 'Readiness: Unknown')
    : irt.ability < -0.5
      ? (isGreek ? 'Ετοιμότητα: Χαμηλή' : 'Readiness: Low')
      : irt.ability < 0.5
        ? (isGreek ? 'Ετοιμότητα: Μέτρια' : 'Readiness: Moderate')
        : (isGreek ? 'Ετοιμότητα: Καλή' : 'Readiness: Good');

  const difficultyLabel = irt.difficulty < 1.2
    ? (isGreek ? 'Δυσκολία: Βασική' : 'Difficulty: Basic')
    : irt.difficulty < 2
      ? (isGreek ? 'Δυσκολία: Μέτρια' : 'Difficulty: Medium')
      : (isGreek ? 'Δυσκολία: Υψηλή' : 'Difficulty: Hard');

  const probabilityLabel = isGreek
    ? `Πιθανότητα σωστής: ~${pct}%`
    : `Estimated success: ~${pct}%`;

  const hint = responseCount === 0
    ? (isGreek ? 'Η εκτίμηση βελτιώνεται μετά την πρώτη απάντηση.' : 'Estimates improve after your first answer.')
    : '';

  return { readinessLabel, difficultyLabel, probabilityLabel, hint };
}
