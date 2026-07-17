/**
 * Unified social policy for Circles · Match · Collab.
 * Single safety envelope: invite/match scoped, dual Meet consent, report taxonomy, no public discovery.
 */
import { REPORT_REASONS, type ReportReason, GUIDELINES_VERSION } from './safeSocial';
import { moderatePlatformText, localModerateText } from './platformModeration';

export const SOCIAL_SURFACES = ['match', 'circles', 'collab'] as const;
export type SocialSurface = (typeof SOCIAL_SURFACES)[number];

export const TRIAGE_STATUSES = [
  'open',
  'triaging',
  'dismissed',
  'actioned',
] as const;
export type TriageStatus = (typeof TRIAGE_STATUSES)[number];

export const TRIAGE_ACTIONS = [
  'dismiss',
  'warn',
  'cooldown_1h',
  'cooldown_24h',
  'ban_surface',
] as const;
export type TriageAction = (typeof TRIAGE_ACTIONS)[number];

export type SocialCapability =
  | 'chat'
  | 'notes'
  | 'whiteboard'
  | 'meet'
  | 'kudos'
  | 'report'
  | 'invite'
  | 'match_bridge';

/** Capability matrix — keep in sync with SAFE_SOCIAL.md */
export const SURFACE_CAPABILITIES: Record<SocialSurface, readonly SocialCapability[]> = {
  match: ['chat', 'notes', 'whiteboard', 'meet', 'report'],
  circles: ['invite', 'match_bridge', 'report'],
  collab: ['chat', 'notes', 'whiteboard', 'meet', 'kudos', 'report', 'invite'],
} as const;

export function surfaceAllows(surface: SocialSurface, capability: SocialCapability): boolean {
  return SURFACE_CAPABILITIES[surface].includes(capability);
}

/** Meet requires at least two distinct consenting members (Match dual-consent reused). */
export const MEET_MIN_CONSENTS = 2;

export function meetDualConsentSatisfied(
  meetConsent: Record<string, boolean> | undefined | null,
  opts?: { requiredMemberIds?: string[] },
): boolean {
  const map = meetConsent ?? {};
  if (opts?.requiredMemberIds?.length) {
    return opts.requiredMemberIds.every((id) => map[id] === true);
  }
  const yes = Object.values(map).filter(Boolean).length;
  return yes >= MEET_MIN_CONSENTS;
}

export function countMeetConsents(meetConsent: Record<string, boolean> | undefined | null): number {
  return Object.values(meetConsent ?? {}).filter(Boolean).length;
}

export function isValidReportReason(reason: string): reason is ReportReason {
  return (REPORT_REASONS as readonly string[]).includes(reason);
}

export function isValidTriageAction(action: string): action is TriageAction {
  return (TRIAGE_ACTIONS as readonly string[]).includes(action);
}

/** Cooldown duration (ms) for triage actions applied to a reported uid. */
export function cooldownMsForAction(action: TriageAction): number {
  switch (action) {
    case 'cooldown_1h':
      return 60 * 60 * 1000;
    case 'cooldown_24h':
      return 24 * 60 * 60 * 1000;
    case 'ban_surface':
      return 30 * 24 * 60 * 60 * 1000;
    default:
      return 0;
  }
}

/** Circle → Study Match bridge (topic prefills lobby; same safety envelope). */
export function circleToMatchPath(topic: string, circleId?: string): string {
  const params = new URLSearchParams();
  const t = topic.trim().slice(0, 120);
  if (t) params.set('topic', t);
  params.set('from', 'circle');
  if (circleId) params.set('circle', circleId.slice(0, 64));
  return `/match?${params.toString()}`;
}

export function parseMatchBridgeQuery(search: string): {
  topic: string;
  fromCircle: boolean;
  circleId: string | null;
} {
  const q = new URLSearchParams(search.startsWith('?') ? search : `?${search}`);
  return {
    topic: (q.get('topic') ?? '').trim().slice(0, 120),
    fromCircle: q.get('from') === 'circle',
    circleId: q.get('circle')?.slice(0, 64) ?? null,
  };
}

export type SocialPolicyChecklist = {
  guidelinesVersion: string;
  inviteOnly: true;
  noPublicDiscovery: true;
  noStrangerDms: true;
  meetDualConsent: true;
  peerDisplay: 'Buddy-####' | 'room-display-name';
  reportReasons: readonly ReportReason[];
};

export function socialPolicySnapshot(surface: SocialSurface): SocialPolicyChecklist {
  return {
    guidelinesVersion: GUIDELINES_VERSION,
    inviteOnly: true,
    noPublicDiscovery: true,
    noStrangerDms: true,
    meetDualConsent: true,
    peerDisplay: surface === 'match' ? 'Buddy-####' : 'room-display-name',
    reportReasons: REPORT_REASONS,
  };
}

/** Board sticky / whiteboard text — local then server moderation. */
export async function moderateBoardText(text: string): Promise<{
  allowed: boolean;
  reason: string;
}> {
  const local = localModerateText(text);
  if (!local.allowed) return local;
  const remote = await moderatePlatformText(text, 'board');
  return { allowed: remote.allowed, reason: remote.reason };
}
