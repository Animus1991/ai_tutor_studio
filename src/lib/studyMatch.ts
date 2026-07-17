/**
 * Study Match (Focus Buddy) — client contract.
 * Server-side matchmaking only; no public queue, no stranger DMs after session.
 */
import { apiRequest } from './apiClient';
import { REPORT_REASONS, type ReportReason } from './safeSocial';

export const MATCH_DURATIONS = [15, 20, 25, 30] as const;
export type MatchDuration = (typeof MATCH_DURATIONS)[number];

export const MATCH_REPORT_REASONS = REPORT_REASONS;
export type MatchReportReason = ReportReason;

const TOPIC_ALIASES: Record<string, string> = {
  'organic-chemistry': 'organic-chem',
  'org-chem': 'organic-chem',
  calc: 'calculus',
  'calc-1': 'calculus',
  'linear-algebra': 'lin-alg',
  linalg: 'lin-alg',
  bio: 'biology',
  chem: 'chemistry',
  phys: 'physics',
  cs: 'computer-science',
};

/** Normalize free-text subject into a stable match key. */
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

/** Apply synonym map so near-identical topics still match. */
export function canonicalTopicKey(label: string): string {
  const key = normalizeTopicKey(label);
  return TOPIC_ALIASES[key] ?? key;
}

export function isValidMatchDuration(n: unknown): n is MatchDuration {
  return typeof n === 'number' && (MATCH_DURATIONS as readonly number[]).includes(n);
}

/** Extract registrable school domain from email (e.g. uni.edu). */
export function emailDomain(email: string): string {
  const at = email.trim().toLowerCase().lastIndexOf('@');
  if (at < 0) return '';
  return email.trim().toLowerCase().slice(at + 1).slice(0, 120);
}

export function isValidDomainFilter(domain: string, userEmail: string): boolean {
  const d = domain.trim().toLowerCase();
  if (!d) return true;
  if (!/^[a-z0-9]([a-z0-9.-]*[a-z0-9])?$/.test(d)) return false;
  if (!d.includes('.')) return false;
  return emailDomain(userEmail) === d;
}

/** Privacy-safe buddy label — never the full email. */
export function buddyDisplayName(uid: string): string {
  let h = 0;
  for (let i = 0; i < uid.length; i++) h = (h * 31 + uid.charCodeAt(i)) >>> 0;
  const code = (h % 9000) + 1000;
  return `Buddy-${code}`;
}

export type MatchQueueStatus = 'waiting' | 'matched' | 'cancelled';

export type MatchSessionStatus = 'active' | 'ended' | 'reported';

export type EncourageReaction = 'helpful' | 'focus' | 'encourage';
export type StudyVibe = 'quiet' | 'balanced' | 'chatty';
export type StudyEnergy = 'focused' | 'steady' | 'low_energy';
export type MatchFlexibility = 'prefer_topic' | 'any_study';

export const STUDY_VIBES: StudyVibe[] = ['quiet', 'balanced', 'chatty'];
export const STUDY_ENERGIES: StudyEnergy[] = ['focused', 'steady', 'low_energy'];
export const ENCOURAGE_REACTIONS: EncourageReaction[] = ['helpful', 'focus', 'encourage'];

export type MatchChatMessage = {
  id: string;
  userId: string;
  displayName: string;
  text: string;
  createdAt: string;
  reactions?: Partial<Record<EncourageReaction, string[]>>;
};

export type PomodoroPhase = 'focus' | 'break';

export type PomodoroState = {
  phase: PomodoroPhase;
  cycle: number;
  phaseStartedAt: string;
  phaseEndsAt: string;
  focusMin: number;
  breakMin: number;
};

export type MatchSessionView = {
  id: string;
  topicLabel: string;
  topicKey: string;
  topicMatched?: boolean;
  durationMin: MatchDuration;
  roomId: string;
  status: MatchSessionStatus;
  startedAt: string;
  endsAt: string;
  notes: string;
  messages: MatchChatMessage[];
  meetConsent: Record<string, boolean>;
  meetUrl: string | null;
  selfId: string;
  peerId: string;
  peerDisplayName: string;
  domainFilter: string;
  pomodoro?: PomodoroState;
  peerOnline?: boolean;
  selfOnline?: boolean;
  notesVersion?: number;
  quietFocusSelf?: boolean;
  quietFocusPeer?: boolean;
  midpointSent?: boolean;
  sessionGoal?: string;
  selfVibe?: StudyVibe;
  peerVibe?: StudyVibe;
  selfEnergy?: StudyEnergy;
  peerEnergy?: StudyEnergy;
  respectVoted?: boolean;
};

export type MatchEnqueueResult =
  | { status: 'waiting'; topicLabel: string; durationMin: MatchDuration; queuedAt: string }
  | { status: 'matched'; session: MatchSessionView };

export type MatchStatusResult =
  | { status: 'idle' }
  | { status: 'waiting'; topicLabel: string; durationMin: MatchDuration; queuedAt: string }
  | { status: 'matched'; session: MatchSessionView };

async function parseJson<T>(res: Response): Promise<T> {
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || `Request failed (${res.status})`);
  }
  return data;
}

export async function enqueueMatch(input: {
  topicLabel?: string;
  durationMin: MatchDuration;
  domainFilter?: string;
  guidelinesAccepted?: boolean;
  flexibility?: MatchFlexibility;
  vibe?: StudyVibe;
  energy?: StudyEnergy;
  sessionGoal?: string;
}): Promise<MatchEnqueueResult> {
  const res = await apiRequest('/api/match/enqueue', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      topicLabel: (input.topicLabel ?? '').trim().slice(0, 120),
      durationMin: input.durationMin,
      domainFilter: (input.domainFilter ?? '').trim().toLowerCase().slice(0, 120),
      guidelinesAccepted: input.guidelinesAccepted !== false,
      flexibility: input.flexibility ?? 'prefer_topic',
      vibe: input.vibe ?? 'balanced',
      energy: input.energy ?? 'steady',
      sessionGoal: (input.sessionGoal ?? '').trim().slice(0, 160),
    }),
  });
  return parseJson<MatchEnqueueResult>(res);
}

export async function leaveMatchQueue(): Promise<void> {
  const res = await apiRequest('/api/match/queue', { method: 'DELETE' });
  if (!res.ok && res.status !== 404) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error || 'Could not leave queue');
  }
}

export async function getMatchStatus(): Promise<MatchStatusResult> {
  const res = await apiRequest('/api/match/status');
  return parseJson<MatchStatusResult>(res);
}

export async function getMatchSession(sessionId: string): Promise<MatchSessionView> {
  const res = await apiRequest(`/api/match/session/${encodeURIComponent(sessionId)}`);
  return parseJson<MatchSessionView>(res);
}

export type MatchSessionSummary = {
  topicLabel: string;
  durationMin: number;
  studiedSec: number;
  cycles: number;
};

export async function leaveMatchSession(
  sessionId: string,
): Promise<{ ok: boolean; summary?: MatchSessionSummary }> {
  const res = await apiRequest(`/api/match/session/${encodeURIComponent(sessionId)}/leave`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
  });
  return parseJson(res);
}

export async function reportMatchSession(
  sessionId: string,
  input: { reason: MatchReportReason; note?: string },
): Promise<void> {
  const res = await apiRequest(`/api/match/session/${encodeURIComponent(sessionId)}/report`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      reason: input.reason,
      note: (input.note ?? '').trim().slice(0, 280),
    }),
  });
  await parseJson(res);
}

export async function setMeetConsent(sessionId: string, consent: boolean): Promise<MatchSessionView> {
  const res = await apiRequest(`/api/match/session/${encodeURIComponent(sessionId)}/meet-consent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ consent }),
  });
  return parseJson<MatchSessionView>(res);
}

export async function createMatchMeet(
  sessionId: string,
  accessToken?: string | null,
): Promise<{ meetUrl: string; fallback: boolean; session: MatchSessionView }> {
  const res = await apiRequest(`/api/match/session/${encodeURIComponent(sessionId)}/meet`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ accessToken: accessToken ?? undefined }),
  });
  return parseJson(res);
}

export async function saveMatchNotes(
  sessionId: string,
  notes: string,
  notesVersion?: number,
): Promise<{ ok: boolean; notesVersion: number }> {
  const res = await apiRequest(`/api/match/session/${encodeURIComponent(sessionId)}/notes`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      notes: notes.slice(0, 20000),
      notesVersion,
    }),
  });
  return parseJson(res);
}

export async function setQuietFocus(
  sessionId: string,
  enabled: boolean,
): Promise<MatchSessionView> {
  const res = await apiRequest(`/api/match/session/${encodeURIComponent(sessionId)}/quiet-focus`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ enabled }),
  });
  return parseJson(res);
}

export async function sendMatchMessage(
  sessionId: string,
  text: string,
): Promise<{ message: MatchChatMessage; session: MatchSessionView }> {
  const res = await apiRequest(`/api/match/session/${encodeURIComponent(sessionId)}/message`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: text.trim().slice(0, 1000) }),
  });
  return parseJson(res);
}

export async function reactMatchMessage(
  sessionId: string,
  messageId: string,
  kind: EncourageReaction,
): Promise<MatchSessionView> {
  const res = await apiRequest(`/api/match/session/${encodeURIComponent(sessionId)}/react`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messageId, kind }),
  });
  return parseJson(res);
}

export async function voteMatchRespect(
  sessionId: string,
  respectful: boolean,
): Promise<{ ok: boolean }> {
  const res = await apiRequest(`/api/match/session/${encodeURIComponent(sessionId)}/respect`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ respectful }),
  });
  return parseJson(res);
}

export async function matchHeartbeat(
  sessionId: string,
): Promise<{ ok: boolean; session?: MatchSessionView }> {
  const res = await apiRequest(`/api/match/session/${encodeURIComponent(sessionId)}/heartbeat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
  });
  return parseJson(res);
}

export async function matchPomodoro(
  sessionId: string,
  action: 'start_break' | 'start_focus',
  durationMin?: MatchDuration,
): Promise<MatchSessionView> {
  const res = await apiRequest(`/api/match/session/${encodeURIComponent(sessionId)}/pomodoro`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, durationMin }),
  });
  return parseJson(res);
}

export function secondsRemaining(endsAtIso: string, now = Date.now()): number {
  const ends = new Date(endsAtIso).getTime();
  if (Number.isNaN(ends)) return 0;
  return Math.max(0, Math.floor((ends - now) / 1000));
}

export function formatCountdown(totalSeconds: number): string {
  const s = Math.max(0, totalSeconds);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
}
