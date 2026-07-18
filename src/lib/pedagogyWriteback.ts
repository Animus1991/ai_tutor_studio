/**
 * Pedagogy writeback — Workspace Debate/Feynman (and peers) → mastery + xAPI + learning events.
 * theory → mechanism → metric → risk (PRODUCT_BLUEPRINT §1)
 */
import { noteConceptActivity } from './workspaceConceptBus';
import { xapi } from './xapiTracker';
import { apiRequest } from './apiClient';
import type { EvidencePrincipleId } from './evidencePrinciples';

export type WritebackSurface = 'feynman' | 'debate' | 'quiz' | 'focus';

export type PedagogyWritebackInput = {
  surface: WritebackSurface;
  concept: string;
  /** 0–1 success / quality signal */
  score01: number;
  gapsCount?: number;
  userId?: string;
  courseTitle?: string;
  principleIds?: EvidencePrincipleId[];
};

export type PedagogyWritebackResult = {
  masteryDelta: number;
  principles: EvidencePrincipleId[];
  xapiLogged: boolean;
};

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

/** Map explanation quality → mastery points (bounded, non-vanity). */
export function scoreToMasteryDelta(surface: WritebackSurface, score01: number): number {
  const s = clamp01(score01);
  if (surface === 'feynman') return Math.max(1, Math.round(s * 10));
  if (surface === 'debate') return Math.max(1, Math.round(s * 6));
  if (surface === 'quiz') return Math.max(1, Math.round(s * 4));
  return Math.max(1, Math.round(s * 2));
}

export function defaultPrinciples(surface: WritebackSurface): EvidencePrincipleId[] {
  switch (surface) {
    case 'feynman':
      return ['feynman', 'retrieval', 'scaffolding'];
    case 'debate':
      return ['retrieval', 'desirable_difficulties', 'cognitive_load'];
    case 'quiz':
      return ['retrieval', 'irt_calibration'];
    case 'focus':
      return ['self_determination', 'cognitive_load'];
    default:
      return ['retrieval'];
  }
}

/**
 * Apply writeback synchronously to local mastery/concept bus; fire-and-forget server events.
 */
export function applyPedagogyWriteback(input: PedagogyWritebackInput): PedagogyWritebackResult {
  const score01 = clamp01(input.score01);
  const principles = input.principleIds?.length
    ? input.principleIds
    : defaultPrinciples(input.surface);
  const masteryDelta = scoreToMasteryDelta(input.surface, score01);

  if (input.surface === 'feynman' || input.surface === 'debate') {
    // Lazy import keeps unit tests free of IndexedDB/zustand persist side-effects.
    void import('../store/useMasteryStore').then(({ useMasteryStore }) => {
      useMasteryStore.getState().updateFeynmanScore(masteryDelta);
    });
  }

  const signal =
    input.surface === 'debate'
      ? 'mapped'
      : score01 >= 0.6
        ? 'explained'
        : 'noted';
  noteConceptActivity(input.concept || input.surface, input.surface === 'debate' ? 'debate' : 'feynman', signal, {
    score01,
    gapsCount: input.gapsCount ?? 0,
    principles,
  });

  const uid = input.userId ?? 'local';
  let xapiLogged = false;
  try {
    xapi.sendStatement({
      actor: { mbox: `mailto:${uid}@users.memora.local`, name: uid },
      verb: {
        id: `https://memora.app/xapi/verbs/${input.surface}-writeback`,
        display: { en: `${input.surface} writeback` },
      },
      object: {
        id: `https://memora.app/concepts/${encodeURIComponent(input.concept || 'general')}`,
        definition: {
          name: { en: input.courseTitle || input.concept || input.surface },
          type: 'http://adlnet.gov/expapi/activities/assessment',
        },
      },
      result: {
        score: { scaled: score01, raw: masteryDelta, min: 0, max: 10 },
        success: score01 >= 0.55,
        completion: true,
      },
    });
    xapiLogged = true;
  } catch {
    xapiLogged = false;
  }

  const kind = input.surface === 'feynman' ? 'feynman_check' : 'agent_turn';
  void apiRequest('/api/learning/events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      kind,
      surface: input.surface,
      domainKey: input.concept?.slice(0, 120) || undefined,
      success: score01 >= 0.55,
      quality: Math.round(score01 * 5),
      mode: input.surface,
      meta: { principles, gapsCount: input.gapsCount ?? 0, masteryDelta },
    }),
  }).catch(() => {
    /* offline / unauth — local mastery remains */
  });

  return { masteryDelta, principles, xapiLogged };
}

/** Convenience: Feynman gaps → score01 */
export function feynmanGapsToScore01(gapsCount: number): number {
  return clamp01(1 - Math.min(5, Math.max(0, gapsCount)) * 0.18);
}

/** Convenience: debate counters produced → modest retrieval credit */
export function debateCountersToScore01(counterCount: number): number {
  return clamp01(0.35 + Math.min(5, Math.max(0, counterCount)) * 0.1);
}
