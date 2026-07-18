/**
 * Shared Observe + Pedagogy beacons for every surface.
 * Fire-and-forget; never blocks the UX path.
 */
import { apiRequest } from './apiClient';
import type { EvidencePrincipleId } from './evidencePrinciples';

export type LearningEventKind =
  | 'agent_turn'
  | 'task_review'
  | 'task_complete'
  | 'flashcard_review'
  | 'feynman_check'
  | 'focus_session'
  | 'rag_grounding';

export type PostLearningEventInput = {
  kind: LearningEventKind;
  surface: string;
  domainKey?: string;
  success?: boolean;
  quality?: number;
  mode?: string;
  meta?: Record<string, unknown>;
  principles?: EvidencePrincipleId[];
};

/** POST /api/learning/events — server TTL 90d when Admin SDK present. */
export function postLearningEvent(input: PostLearningEventInput): void {
  void apiRequest('/api/learning/events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      kind: input.kind,
      surface: input.surface.slice(0, 40),
      domainKey: input.domainKey?.slice(0, 120),
      success: input.success,
      quality: input.quality,
      mode: input.mode?.slice(0, 40),
      meta: {
        ...(input.meta ?? {}),
        principles: input.principles ?? [],
      },
    }),
  }).catch(() => {
    /* offline / unauth */
  });
}

/** Best-effort structured audit beacon (Observe). */
export function postAuditBeacon(
  action: string,
  detail: Record<string, unknown> = {},
): void {
  void apiRequest('/api/audit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: action.slice(0, 80),
      ...detail,
      at: new Date().toISOString(),
    }),
  }).catch(() => {
    /* ignore */
  });
}

/** Privacy TTL helper — ISO expireAt 90 days from now. */
export function privacyExpireAt(days = 90): string {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}
