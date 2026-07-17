/**
 * Pure Study Match domain helpers (no I/O) — unit-tested independently.
 */

export const MATCH_DURATIONS = [15, 20, 25, 30] as const;
export type MatchDuration = (typeof MATCH_DURATIONS)[number];

/** Canonical topic merges so near-synonyms still match. */
export const TOPIC_ALIASES: Record<string, string> = {
  'organic-chemistry': 'organic-chem',
  'org-chem': 'organic-chem',
  'orgeniki-chimeia': 'organic-chem',
  calc: 'calculus',
  'calc-1': 'calculus',
  'calc-2': 'calculus',
  'calculus-1': 'calculus',
  'linear-algebra': 'lin-alg',
  linalg: 'lin-alg',
  bio: 'biology',
  chem: 'chemistry',
  phys: 'physics',
  cs: 'computer-science',
  'comp-sci': 'computer-science',
};

export function normalizeTopicKey(label: string): string {
  return label
    .trim()
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

export function canonicalTopicKey(label: string): string {
  const key = normalizeTopicKey(label);
  return TOPIC_ALIASES[key] ?? key;
}

export function emailDomain(email: string): string {
  const at = email.trim().toLowerCase().lastIndexOf('@');
  return at >= 0 ? email.trim().toLowerCase().slice(at + 1) : '';
}

export type PomodoroPhase = 'focus' | 'break';

export type PomodoroState = {
  phase: PomodoroPhase;
  cycle: number;
  phaseStartedAt: string;
  phaseEndsAt: string;
  focusMin: number;
  breakMin: number;
};

export function buildInitialPomodoro(durationMin: MatchDuration, now = new Date()): PomodoroState {
  const phaseEnds = new Date(now.getTime() + durationMin * 60_000);
  return {
    phase: 'focus',
    cycle: 1,
    phaseStartedAt: now.toISOString(),
    phaseEndsAt: phaseEnds.toISOString(),
    focusMin: durationMin,
    breakMin: 5,
  };
}

/** After focus ends, optional shared break (does not require peer consent). */
export function startBreakPhase(pomo: PomodoroState, now = new Date()): PomodoroState {
  const ends = new Date(now.getTime() + pomo.breakMin * 60_000);
  return {
    ...pomo,
    phase: 'break',
    phaseStartedAt: now.toISOString(),
    phaseEndsAt: ends.toISOString(),
  };
}

export function resumeFocusPhase(
  pomo: PomodoroState,
  focusMin: MatchDuration,
  now = new Date(),
): PomodoroState {
  const ends = new Date(now.getTime() + focusMin * 60_000);
  return {
    ...pomo,
    phase: 'focus',
    cycle: pomo.cycle + 1,
    phaseStartedAt: now.toISOString(),
    phaseEndsAt: ends.toISOString(),
    focusMin,
  };
}

export const STUDY_VIBES = ['quiet', 'balanced', 'chatty'] as const;
export type StudyVibe = (typeof STUDY_VIBES)[number];

export const STUDY_ENERGIES = ['focused', 'steady', 'low_energy'] as const;
export type StudyEnergy = (typeof STUDY_ENERGIES)[number];

export const ENCOURAGE_REACTIONS = ['helpful', 'focus', 'encourage'] as const;
export type EncourageReaction = (typeof ENCOURAGE_REACTIONS)[number];

export type MatchFlexibility = 'prefer_topic' | 'any_study';

export function isValidStudyVibe(v: unknown): v is StudyVibe {
  return typeof v === 'string' && (STUDY_VIBES as readonly string[]).includes(v);
}

export function isValidStudyEnergy(v: unknown): v is StudyEnergy {
  return typeof v === 'string' && (STUDY_ENERGIES as readonly string[]).includes(v);
}

/** Higher score = better candidate. Topic match preferred but not required. */
export function scoreMatchCandidate(input: {
  entrantTopicKey: string;
  otherTopicKey: string;
  entrantFlexibility: MatchFlexibility;
  otherFlexibility: MatchFlexibility;
  entrantVibe: StudyVibe;
  otherVibe: StudyVibe;
  createdAt: string;
}): number {
  let score = 0;
  const sameTopic =
    input.entrantTopicKey &&
    input.otherTopicKey &&
    input.entrantTopicKey === input.otherTopicKey &&
    input.entrantTopicKey !== 'general-study';

  if (sameTopic) score += 100;
  else if (
    input.entrantFlexibility === 'prefer_topic' &&
    input.otherFlexibility === 'prefer_topic' &&
    input.entrantTopicKey !== 'general-study' &&
    input.otherTopicKey !== 'general-study'
  ) {
    // Both wanted a topic match but topics differ — still allowed, lower priority
    score += 10;
  } else {
    score += 40; // open / any-study pairing
  }

  if (input.entrantVibe === input.otherVibe) score += 25;
  else if (
    (input.entrantVibe === 'quiet' && input.otherVibe === 'chatty') ||
    (input.entrantVibe === 'chatty' && input.otherVibe === 'quiet')
  ) {
    score -= 15;
  } else {
    score += 10;
  }

  // Slight FIFO preference among similar scores
  const ageMin = Math.min(
    30,
    Math.max(0, (Date.now() - new Date(input.createdAt).getTime()) / 60_000),
  );
  score += ageMin;
  return score;
}

/** Sliding-window rate limiter (pure, injectable clock). */
export function createRateLimiter(max: number, windowMs: number) {
  const hits = new Map<string, number[]>();
  return {
    allow(key: string, now = Date.now()): boolean {
      const cutoff = now - windowMs;
      const prev = (hits.get(key) ?? []).filter((t) => t > cutoff);
      if (prev.length >= max) {
        hits.set(key, prev);
        return false;
      }
      prev.push(now);
      hits.set(key, prev);
      return true;
    },
    reset() {
      hits.clear();
    },
  };
}

export const PRESENCE_ONLINE_MS = 20_000;

/** After a report, reporter & reported get a short rematch cooldown (anti-abuse). */
export const REPORT_COOLDOWN_MS = 30 * 60_000;

export function isPeerOnline(lastSeenIso: string | undefined, now = Date.now()): boolean {
  if (!lastSeenIso) return false;
  const t = new Date(lastSeenIso).getTime();
  if (Number.isNaN(t)) return false;
  return now - t <= PRESENCE_ONLINE_MS;
}

export function cooldownRemainingMs(
  untilIso: string | undefined,
  now = Date.now(),
): number {
  if (!untilIso) return 0;
  const until = new Date(untilIso).getTime();
  if (Number.isNaN(until)) return 0;
  return Math.max(0, until - now);
}

export function isInCooldown(untilIso: string | undefined, now = Date.now()): boolean {
  return cooldownRemainingMs(untilIso, now) > 0;
}

/** True once when elapsed crosses the halfway mark of a focus phase. */
export function shouldEmitMidpointCheckIn(input: {
  startedAt: string;
  endsAt: string;
  midpointSent: boolean;
  now?: number;
}): boolean {
  if (input.midpointSent) return false;
  const start = new Date(input.startedAt).getTime();
  const end = new Date(input.endsAt).getTime();
  const now = input.now ?? Date.now();
  if (Number.isNaN(start) || Number.isNaN(end) || end <= start) return false;
  const mid = start + (end - start) / 2;
  return now >= mid;
}

export type MatchMetricsSnapshot = {
  queueWaiting: number;
  sessionsActive: number;
  matchesTotal: number;
  reportsTotal: number;
  leavesTotal: number;
  meetCreatedTotal: number;
};

export function emptyMatchMetrics(): MatchMetricsSnapshot {
  return {
    queueWaiting: 0,
    sessionsActive: 0,
    matchesTotal: 0,
    reportsTotal: 0,
    leavesTotal: 0,
    meetCreatedTotal: 0,
  };
}
