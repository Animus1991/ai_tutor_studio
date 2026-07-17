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

export type MatchChatMessage = {
  id: string;
  userId: string;
  displayName: string;
  text: string;
  createdAt: string;
};

export type MatchSessionView = {
  id: string;
  topicLabel: string;
  topicKey: string;
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
  topicLabel: string;
  durationMin: MatchDuration;
  domainFilter?: string;
}): Promise<MatchEnqueueResult> {
  const res = await apiRequest('/api/match/enqueue', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      topicLabel: input.topicLabel.trim().slice(0, 120),
      durationMin: input.durationMin,
      domainFilter: (input.domainFilter ?? '').trim().toLowerCase().slice(0, 120),
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

export async function leaveMatchSession(sessionId: string): Promise<void> {
  const res = await apiRequest(`/api/match/session/${encodeURIComponent(sessionId)}/leave`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
  });
  await parseJson(res);
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

export async function saveMatchNotes(sessionId: string, notes: string): Promise<void> {
  const res = await apiRequest(`/api/match/session/${encodeURIComponent(sessionId)}/notes`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ notes: notes.slice(0, 20000) }),
  });
  await parseJson(res);
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
