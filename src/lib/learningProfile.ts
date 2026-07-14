import localforage from "localforage";

export const LEARNING_PROFILE_VERSION = 1 as const;
export const BEHAVIOR_EVENTS_KEY = "memora-behavior-events";
export const MAX_BEHAVIOR_EVENTS = 500;
export const BEHAVIOR_EVENT_TTL_MS = 90 * 24 * 60 * 60 * 1000;

export type LearningSurface = "agent" | "tasks" | "document" | "dashboard";
export type InteractionChannel =
  | "text"
  | "voice"
  | "visual"
  | "retrieval"
  | "explanation";
export type BehaviorKind =
  | "agent_turn"
  | "task_review"
  | "task_complete"
  | "flashcard_review"
  | "feynman_check"
  | "focus_session";

export interface BehaviorEvent {
  version: 1;
  id: string;
  timestamp: number;
  kind: BehaviorKind;
  surface: LearningSurface;
  channel: InteractionChannel;
  mode?: "socratic" | "direct" | "quiz" | "feynman";
  taskType?: string;
  success?: boolean;
  quality?: number;
  durationSeconds?: number;
  chunkSizeWords?: number;
  errorType?: string;
  hourOfDay: number;
}

export interface RunningStat {
  mean: number;
  samples: number;
}

export interface ErrorPattern {
  count: number;
  lastSeen: number;
}

export interface AdaptiveParameters {
  confidence: number;
  ragTopK: number;
  chunkSizeWords: number;
  chunkOverlapWords: number;
  retrievalIntervalMultiplier: number;
  theoryPracticeRatio: number;
  feedbackDensity: "minimal" | "balanced" | "detailed";
  optimalStudyHour: number;
  suggestedMode: "socratic" | "direct" | "quiz" | "feynman";
}

export interface LearningProfile {
  version: 1;
  updatedAt: number;
  eventCount: number;
  stats: {
    retrievalSuccess: RunningStat;
    theoryEngagement: RunningStat;
    practiceEngagement: RunningStat;
    textEngagement: RunningStat;
    voiceEngagement: RunningStat;
    visualEngagement: RunningStat;
    averageFocusMinutes: RunningStat;
    averageChunkWords: RunningStat;
  };
  hourHistogram: number[];
  errorPatterns: Record<string, ErrorPattern>;
  parameters: AdaptiveParameters;
}

export type BehaviorEventInput = Omit<
  BehaviorEvent,
  "version" | "id" | "timestamp" | "hourOfDay"
> & {
  timestamp?: number;
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const stat = (mean: number): RunningStat => ({ mean, samples: 0 });

const updateStat = (
  current: RunningStat,
  observation: number,
  alpha = 0.08,
): RunningStat => {
  const safeObservation = Number.isFinite(observation)
    ? observation
    : current.mean;
  const boundedResidual = clamp(
    safeObservation - current.mean,
    -Math.max(0.25, Math.abs(current.mean) * 0.75),
    Math.max(0.25, Math.abs(current.mean) * 0.75),
  );
  return {
    mean: current.mean + alpha * boundedResidual,
    samples: current.samples + 1,
  };
};

export function deriveAdaptiveParameters(
  profile: Omit<LearningProfile, "parameters">,
): AdaptiveParameters {
  const { stats, eventCount, hourHistogram } = profile;
  const confidence = clamp(eventCount / 40, 0, 1);
  const empiricalChunk = clamp(
    Math.round(
      stats.averageChunkWords.mean *
        (1 + 0.02 * (stats.averageFocusMinutes.mean - 25)),
    ),
    300,
    800,
  );
  const chunkSizeWords = Math.round(
    500 * (1 - confidence) + empiricalChunk * confidence,
  );
  const observedTheoryRatio = clamp(
    stats.theoryEngagement.mean /
      Math.max(
        0.01,
        stats.theoryEngagement.mean + stats.practiceEngagement.mean,
      ),
    0.25,
    0.75,
  );
  const theoryPracticeRatio =
    0.5 * (1 - confidence) + observedTheoryRatio * confidence;
  const empiricalRetrievalMultiplier = clamp(
    0.65 +
      0.9 * stats.retrievalSuccess.mean +
      0.15 * stats.practiceEngagement.mean,
    0.6,
    1.6,
  );
  const retrievalIntervalMultiplier =
    1 * (1 - confidence) + empiricalRetrievalMultiplier * confidence;
  const observedOptimalHour = hourHistogram.reduce(
    (best, value, hour, values) => (value > values[best] ? hour : best),
    0,
  );

  return {
    confidence,
    ragTopK: Math.round(clamp(4 + (1 - stats.retrievalSuccess.mean) * confidence * 2, 3, 6)),
    chunkSizeWords,
    chunkOverlapWords: Math.round(clamp(chunkSizeWords * 0.2, 50, 150)),
    retrievalIntervalMultiplier,
    theoryPracticeRatio,
    feedbackDensity:
      stats.retrievalSuccess.mean < 0.45
        ? "detailed"
        : stats.retrievalSuccess.mean > 0.8
          ? "minimal"
          : "balanced",
    optimalStudyHour: confidence === 0 ? 19 : observedOptimalHour,
    suggestedMode:
      theoryPracticeRatio > 0.6
        ? "quiz"
        : theoryPracticeRatio < 0.4
          ? "direct"
          : stats.retrievalSuccess.mean < 0.5
            ? "feynman"
            : "socratic",
  };
}

export function createColdStartProfile(now = Date.now()): LearningProfile {
  const profileWithoutParameters: Omit<LearningProfile, "parameters"> = {
    version: LEARNING_PROFILE_VERSION,
    updatedAt: now,
    eventCount: 0,
    stats: {
      retrievalSuccess: stat(0.65),
      theoryEngagement: stat(0.55),
      practiceEngagement: stat(0.45),
      textEngagement: stat(0.7),
      voiceEngagement: stat(0.15),
      visualEngagement: stat(0.25),
      averageFocusMinutes: stat(25),
      averageChunkWords: stat(500),
    },
    hourHistogram: Array.from({ length: 24 }, () => 1 / 24),
    errorPatterns: {},
  };
  return {
    ...profileWithoutParameters,
    parameters: deriveAdaptiveParameters(profileWithoutParameters),
  };
}

export function createBehaviorEvent(
  input: BehaviorEventInput,
  now = input.timestamp ?? Date.now(),
): BehaviorEvent {
  return {
    ...input,
    quality:
      input.quality === undefined ? undefined : clamp(input.quality, 0, 1),
    durationSeconds:
      input.durationSeconds === undefined
        ? undefined
        : Math.round(clamp(input.durationSeconds, 0, 4 * 60 * 60) / 300) * 300,
    version: LEARNING_PROFILE_VERSION,
    id: crypto.randomUUID(),
    timestamp: now,
    hourOfDay: new Date(now).getHours(),
  };
}

export function applyBehaviorEvent(
  profile: LearningProfile,
  event: BehaviorEvent,
): LearningProfile {
  const stats = { ...profile.stats };
  const retrievalObservation =
    event.quality ?? (event.success === undefined ? undefined : Number(event.success));
  if (
    retrievalObservation !== undefined &&
    ["task_review", "flashcard_review", "feynman_check"].includes(event.kind)
  ) {
    stats.retrievalSuccess = updateStat(
      stats.retrievalSuccess,
      retrievalObservation,
    );
  }

  const isTheory = event.mode === "direct" || event.mode === "socratic";
  const isPractice =
    event.mode === "quiz" ||
    event.mode === "feynman" ||
    event.channel === "retrieval" ||
    event.channel === "explanation";
  if (isTheory || isPractice) {
    stats.theoryEngagement = updateStat(stats.theoryEngagement, Number(isTheory));
    stats.practiceEngagement = updateStat(
      stats.practiceEngagement,
      Number(isPractice),
    );
  }

  stats.textEngagement = updateStat(
    stats.textEngagement,
    Number(event.channel === "text"),
  );
  stats.voiceEngagement = updateStat(
    stats.voiceEngagement,
    Number(event.channel === "voice"),
  );
  stats.visualEngagement = updateStat(
    stats.visualEngagement,
    Number(event.channel === "visual"),
  );

  if (event.durationSeconds !== undefined) {
    stats.averageFocusMinutes = updateStat(
      stats.averageFocusMinutes,
      event.durationSeconds / 60,
    );
  }
  if (event.chunkSizeWords !== undefined) {
    stats.averageChunkWords = updateStat(
      stats.averageChunkWords,
      clamp(event.chunkSizeWords, 100, 1_000),
    );
  }

  const hourHistogram = profile.hourHistogram.map((value) => value * 0.95);
  hourHistogram[event.hourOfDay] += 0.05;
  const histogramTotal = hourHistogram.reduce((sum, value) => sum + value, 0);
  const normalizedHistogram = hourHistogram.map(
    (value) => value / histogramTotal,
  );

  const errorPatterns = { ...profile.errorPatterns };
  if (event.errorType) {
    const key = event.errorType.slice(0, 80);
    errorPatterns[key] = {
      count: (errorPatterns[key]?.count ?? 0) + 1,
      lastSeen: event.timestamp,
    };
  }

  const nextWithoutParameters: Omit<LearningProfile, "parameters"> = {
    ...profile,
    updatedAt: event.timestamp,
    eventCount: profile.eventCount + 1,
    stats,
    hourHistogram: normalizedHistogram,
    errorPatterns,
  };
  return {
    ...nextWithoutParameters,
    parameters: deriveAdaptiveParameters(nextWithoutParameters),
  };
}

export async function appendBehaviorEvent(event: BehaviorEvent): Promise<void> {
  const stored = await localforage.getItem<unknown>(BEHAVIOR_EVENTS_KEY);
  const events = Array.isArray(stored)
    ? stored.filter(
        (item): item is BehaviorEvent =>
          Boolean(
            item &&
              typeof item === "object" &&
              "version" in item &&
              item.version === LEARNING_PROFILE_VERSION &&
              "timestamp" in item &&
              typeof item.timestamp === "number",
          ),
      )
    : [];
  const cutoff = Date.now() - BEHAVIOR_EVENT_TTL_MS;
  await localforage.setItem(
    BEHAVIOR_EVENTS_KEY,
    [...events.filter((item) => item.timestamp >= cutoff), event].slice(
      -MAX_BEHAVIOR_EVENTS,
    ),
  );
}
