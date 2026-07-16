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
export type QuestionKind =
  | "recall"
  | "recognition"
  | "cloze"
  | "multiple_choice"
  | "explain"
  | "apply"
  | "transfer";
export type ErrorFamily =
  | "retrieval_gap"
  | "misconception"
  | "procedure"
  | "notation"
  | "careless"
  | "timeout"
  | "abandon"
  | "unknown";

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
  errorFamily?: ErrorFamily;
  questionKind?: QuestionKind;
  domainKey?: string;
  responseTimeMs?: number;
  isRevisit?: boolean;
  abandoned?: boolean;
  itemDifficulty?: number;
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

export interface RunningMoments {
  mean: number;
  variance: number;
  samples: number;
}

export interface AdaptiveOverrides {
  chunkSizeWords?: number;
  feedbackDensity?: AdaptiveParameters["feedbackDensity"];
  retrievalIntervalMultiplier?: number;
  preferredMode?: AdaptiveParameters["suggestedMode"];
}

export interface DomainProfile {
  eventCount: number;
  lastSeen: number;
  retrievalSuccess: RunningStat;
  responseTime: RunningMoments;
  revisitRate: RunningStat;
  dropoffRate: RunningStat;
  abilityTheta: RunningStat;
  errorPatterns: Record<string, ErrorPattern>;
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
  responseTime: RunningMoments;
  revisitRate: RunningStat;
  dropoffRate: RunningStat;
  abilityTheta: RunningStat;
  fatigueIndex: number;
  domains: Record<string, DomainProfile>;
  userOverrides?: AdaptiveOverrides;
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
const moments = (mean = 8_000): RunningMoments => ({
  mean,
  variance: 0,
  samples: 0,
});

export function deriveDomainKey(value: unknown): string {
  const input =
    typeof value === "string" && value.trim()
      ? value.trim().toLocaleLowerCase()
      : "_global";
  let hash = 2_166_136_261;
  for (const character of input.slice(0, 200)) {
    hash ^= character.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 16_777_619);
  }
  return `d:${(hash >>> 0).toString(36)}`;
}

export function normalizeErrorFamily(
  value: unknown,
  abandoned = false,
): ErrorFamily {
  if (abandoned) return "abandon";
  const text = typeof value === "string" ? value.toLowerCase() : "";
  if (/misconcept|conceptual/.test(text)) return "misconception";
  if (/procedure|step|algorithm/.test(text)) return "procedure";
  if (/notation|unit|symbol/.test(text)) return "notation";
  if (/careless|attention/.test(text)) return "careless";
  if (/timeout|slow/.test(text)) return "timeout";
  if (/retrieval|knowledge|recall/.test(text)) return "retrieval_gap";
  return "unknown";
}

const updateMoments = (
  current: RunningMoments,
  observation: number,
): RunningMoments => {
  const value = Math.round(clamp(observation, 500, 120_000) / 250) * 250;
  const samples = current.samples + 1;
  const delta = value - current.mean;
  const mean = current.mean + delta / samples;
  const deltaAfter = value - mean;
  return {
    mean,
    variance:
      samples <= 1
        ? 0
        : (current.samples * current.variance + delta * deltaAfter) / samples,
    samples,
  };
};

export const applyOverrides = (
  parameters: AdaptiveParameters,
  overrides?: AdaptiveOverrides,
): AdaptiveParameters => {
  const chunkSizeWords =
    overrides?.chunkSizeWords === undefined
      ? parameters.chunkSizeWords
      : Math.round(clamp(overrides.chunkSizeWords, 300, 800));
  return {
    ...parameters,
    chunkSizeWords,
    chunkOverlapWords: Math.round(clamp(chunkSizeWords * 0.2, 50, 150)),
    feedbackDensity:
      overrides?.feedbackDensity ?? parameters.feedbackDensity,
    retrievalIntervalMultiplier:
      overrides?.retrievalIntervalMultiplier === undefined
        ? parameters.retrievalIntervalMultiplier
        : clamp(overrides.retrievalIntervalMultiplier, 0.6, 1.6),
    suggestedMode: overrides?.preferredMode ?? parameters.suggestedMode,
  };
};

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
  const fatigueIndex = clamp(profile.fatigueIndex ?? 0, 0, 1);
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

  const derived: AdaptiveParameters = {
    confidence,
    ragTopK: Math.round(clamp(4 + (1 - stats.retrievalSuccess.mean) * confidence * 2, 3, 6)),
    chunkSizeWords: Math.round(chunkSizeWords * (1 - 0.15 * fatigueIndex)),
    chunkOverlapWords: Math.round(
      clamp(chunkSizeWords * (1 - 0.15 * fatigueIndex) * 0.2, 50, 150),
    ),
    retrievalIntervalMultiplier:
      clamp(
        retrievalIntervalMultiplier * (1 - 0.1 * fatigueIndex),
        0.6,
        1.6,
      ),
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
  return applyOverrides(derived, profile.userOverrides);
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
    responseTime: moments(),
    revisitRate: stat(0),
    dropoffRate: stat(0),
    abilityTheta: stat(0),
    fatigueIndex: 0,
    domains: {},
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
  const domainKey =
    input.domainKey?.startsWith("d:")
      ? input.domainKey.slice(0, 32)
      : deriveDomainKey(input.domainKey ?? input.taskType ?? input.surface);
  const responseTimeMs =
    input.responseTimeMs === undefined
      ? undefined
      : Math.round(clamp(input.responseTimeMs, 500, 120_000) / 250) * 250;
  return {
    ...input,
    domainKey,
    responseTimeMs,
    itemDifficulty:
      input.itemDifficulty === undefined
        ? undefined
        : clamp(input.itemDifficulty, -3, 3),
    errorFamily:
      input.errorFamily ??
      normalizeErrorFamily(input.errorType, input.abandoned),
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

const createDomainProfile = (profile: LearningProfile, now: number): DomainProfile => ({
  eventCount: 0,
  lastSeen: now,
  retrievalSuccess: { ...profile.stats.retrievalSuccess },
  responseTime: { ...(profile.responseTime ?? moments()) },
  revisitRate: { ...(profile.revisitRate ?? stat(0)) },
  dropoffRate: { ...(profile.dropoffRate ?? stat(0)) },
  abilityTheta: { ...(profile.abilityTheta ?? stat(0)) },
  errorPatterns: {},
});

const updateAbility = (
  current: RunningStat,
  outcome: number,
  difficulty = 0,
): RunningStat => {
  const probability = 1 / (1 + Math.exp(-(current.mean - difficulty)));
  return {
    mean: clamp(current.mean + 0.12 * (outcome - probability), -3, 3),
    samples: current.samples + 1,
  };
};

export function deriveDomainParameters(
  profile: LearningProfile,
  domainKey?: string,
): AdaptiveParameters {
  if (!domainKey || !profile.domains?.[domainKey]) {
    return profile.parameters;
  }
  const domain = profile.domains[domainKey];
  const confidence = clamp(domain.eventCount / 8, 0, 1);
  const blendedRetrieval: RunningStat = {
    mean:
      profile.stats.retrievalSuccess.mean * (1 - confidence) +
      domain.retrievalSuccess.mean * confidence,
    samples: domain.retrievalSuccess.samples,
  };
  const domainProfile: Omit<LearningProfile, "parameters"> = {
    ...profile,
    eventCount: Math.round(confidence * 40),
    stats: { ...profile.stats, retrievalSuccess: blendedRetrieval },
    responseTime: domain.responseTime,
    revisitRate: domain.revisitRate,
    dropoffRate: domain.dropoffRate,
    abilityTheta: domain.abilityTheta,
    fatigueIndex: profile.fatigueIndex,
  };
  return deriveAdaptiveParameters(domainProfile);
}

export interface ProfileExplanation {
  confidence: number;
  evidenceCount: number;
  domainEvidenceCount: number;
  summary: string;
  drivers: string[];
  activeOverrides: string[];
  privacyNote: string;
}

export interface DomainMasterySummary {
  domainKey: string;
  label: string;
  mastery: number;
  cognitiveLoad: number;
  eventCount: number;
}

export function summarizeProfileDomains(
  profile: LearningProfile,
  limit = 7,
): DomainMasterySummary[] {
  const entries = Object.entries(profile.domains ?? {})
    .map(([domainKey, domain]) => {
      const retrieval = domain.retrievalSuccess.mean;
      const fatigue = profile.fatigueIndex ?? 0;
      const mastery = Math.round(clamp(retrieval * 100, 15, 95));
      const cognitiveLoad = Math.round(
        clamp(55 + fatigue * 25 + (1 - retrieval) * 30, 20, 95),
      );
      return {
        domainKey,
        label: domainKey.replace(/^domain:/, '').slice(0, 14) || 'General',
        mastery,
        cognitiveLoad,
        eventCount: domain.eventCount,
      };
    })
    .sort((a, b) => b.eventCount - a.eventCount)
    .slice(0, limit);

  if (entries.length > 0) return entries;

  const fallbackMastery = Math.round(
    clamp(profile.stats.retrievalSuccess.mean * 100, 20, 85),
  );
  return [
    {
      domainKey: 'general',
      label: 'Overall',
      mastery: fallbackMastery,
      cognitiveLoad: Math.round(
        clamp(60 + (profile.fatigueIndex ?? 0) * 20, 25, 90),
      ),
      eventCount: profile.eventCount,
    },
  ];
}

export function explainLearningProfile(
  profile: LearningProfile,
  domainKey?: string,
): ProfileExplanation {
  const domain = domainKey ? profile.domains?.[domainKey] : undefined;
  const parameters = deriveDomainParameters(profile, domainKey);
  const confidence = domain
    ? clamp(domain.eventCount / 8, 0, 1)
    : parameters.confidence;
  const drivers = [
    `${profile.stats.retrievalSuccess.samples} retrieval observations; estimated success ${Math.round(
      profile.stats.retrievalSuccess.mean * 100,
    )}%`,
    `${profile.responseTime?.samples ?? 0} response-time observations; recent fatigue index ${Math.round(
      (profile.fatigueIndex ?? 0) * 100,
    )}%`,
    `Current chunk target ${parameters.chunkSizeWords} words and review multiplier ${parameters.retrievalIntervalMultiplier.toFixed(
      2,
    )}`,
  ];
  const activeOverrides = Object.keys(profile.userOverrides ?? {});
  return {
    confidence,
    evidenceCount: profile.eventCount,
    domainEvidenceCount: domain?.eventCount ?? 0,
    summary:
      confidence < 0.25
        ? "Personalization remains close to conservative defaults because evidence is limited."
        : "Parameters are adjusted continuously from observed outcomes and remain bounded.",
    drivers,
    activeOverrides,
    privacyNote:
      "The profile stores coarse outcomes and timing buckets, not note text, prompts, filenames, or identity labels.",
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

  let responseTime = profile.responseTime ?? moments();
  let fatigueIndex = clamp(profile.fatigueIndex ?? 0, 0, 1);
  if (event.responseTimeMs !== undefined) {
    const previousMean = responseTime.mean;
    const previousStd = Math.sqrt(Math.max(0, responseTime.variance));
    responseTime = updateMoments(responseTime, event.responseTimeMs);
    const slowdown =
      previousStd > 0
        ? clamp(
            (event.responseTimeMs - previousMean) /
              Math.max(250, previousStd * 2),
            0,
            1,
          )
        : 0;
    fatigueIndex = clamp(0.85 * fatigueIndex + 0.15 * slowdown, 0, 1);
  } else if (event.kind === "focus_session") {
    fatigueIndex *= 0.5;
  }

  const revisitRate = updateStat(
    profile.revisitRate ?? stat(0),
    Number(Boolean(event.isRevisit)),
  );
  const dropoffRate = updateStat(
    profile.dropoffRate ?? stat(0),
    Number(Boolean(event.abandoned)),
  );
  let abilityTheta = profile.abilityTheta ?? stat(0);
  if (retrievalObservation !== undefined) {
    abilityTheta = updateAbility(
      abilityTheta,
      retrievalObservation,
      event.itemDifficulty,
    );
  }

  const hourHistogram = profile.hourHistogram.map((value) => value * 0.95);
  hourHistogram[event.hourOfDay] += 0.05;
  const histogramTotal = hourHistogram.reduce((sum, value) => sum + value, 0);
  const normalizedHistogram = hourHistogram.map(
    (value) => value / histogramTotal,
  );

  const errorPatterns = { ...profile.errorPatterns };
  if (event.errorType || event.errorFamily !== "unknown") {
    const scope =
      event.kind === "flashcard_review"
        ? "flashcard"
        : event.kind === "feynman_check"
          ? "feynman"
          : event.kind.startsWith("task")
            ? "task"
            : "agent";
    const key = `${scope}:${event.errorFamily ?? "unknown"}`.slice(0, 40);
    errorPatterns[key] = {
      count: (errorPatterns[key]?.count ?? 0) + 1,
      lastSeen: event.timestamp,
    };
  }

  const domains = { ...(profile.domains ?? {}) };
  const domainKey = event.domainKey ?? deriveDomainKey(event.taskType ?? event.surface);
  const currentDomain =
    domains[domainKey] ?? createDomainProfile(profile, event.timestamp);
  let domainResponseTime = currentDomain.responseTime;
  if (event.responseTimeMs !== undefined) {
    domainResponseTime = updateMoments(
      domainResponseTime,
      event.responseTimeMs,
    );
  }
  let domainRetrieval = currentDomain.retrievalSuccess;
  let domainAbility = currentDomain.abilityTheta;
  if (retrievalObservation !== undefined) {
    domainRetrieval = updateStat(domainRetrieval, retrievalObservation, 0.1);
    domainAbility = updateAbility(
      domainAbility,
      retrievalObservation,
      event.itemDifficulty,
    );
  }
  const domainErrors = { ...currentDomain.errorPatterns };
  if (event.errorType || event.errorFamily !== "unknown") {
    const key = `${event.questionKind ?? "item"}:${event.errorFamily ?? "unknown"}`.slice(
      0,
      40,
    );
    domainErrors[key] = {
      count: (domainErrors[key]?.count ?? 0) + 1,
      lastSeen: event.timestamp,
    };
  }
  domains[domainKey] = {
    eventCount: currentDomain.eventCount + 1,
    lastSeen: event.timestamp,
    retrievalSuccess: domainRetrieval,
    responseTime: domainResponseTime,
    revisitRate: updateStat(
      currentDomain.revisitRate,
      Number(Boolean(event.isRevisit)),
      0.1,
    ),
    dropoffRate: updateStat(
      currentDomain.dropoffRate,
      Number(Boolean(event.abandoned)),
      0.1,
    ),
    abilityTheta: domainAbility,
    errorPatterns: domainErrors,
  };
  const domainEntries = Object.entries(domains);
  if (domainEntries.length > 12) {
    const [oldestKey] = domainEntries.sort(
      ([, left], [, right]) => left.lastSeen - right.lastSeen,
    )[0];
    delete domains[oldestKey];
  }

  const nextWithoutParameters: Omit<LearningProfile, "parameters"> = {
    ...profile,
    updatedAt: event.timestamp,
    eventCount: profile.eventCount + 1,
    stats,
    hourHistogram: normalizedHistogram,
    errorPatterns,
    responseTime,
    revisitRate,
    dropoffRate,
    abilityTheta,
    fatigueIndex,
    domains,
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
