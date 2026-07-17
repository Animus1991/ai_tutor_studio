/**
 * Study Match — server-side focus-buddy matchmaking.
 *
 * Safety invariants:
 * - Queue is never listable by clients (Admin / memory only).
 * - Sessions expose buddy display names, never peer emails.
 * - Reports create mutual blocks and end the session.
 * - Meet requires dual consent.
 * - Optional school-domain filter.
 */
import { createHash, randomBytes } from 'node:crypto';
import type { Request, Response } from 'express';
import type { Firestore } from 'firebase-admin/firestore';
import { getAdminFirestore } from '../firebaseAdmin.js';
import { HttpError } from './security.js';
import {
  buildInitialPomodoro,
  canonicalTopicKey,
  cooldownRemainingMs,
  createRateLimiter,
  emailDomain,
  emptyMatchMetrics,
  ENCOURAGE_REACTIONS,
  isInCooldown,
  isPeerOnline,
  isValidStudyEnergy,
  isValidStudyVibe,
  normalizeTopicKey,
  REPORT_COOLDOWN_MS,
  resumeFocusPhase,
  scoreMatchCandidate,
  shouldEmitMidpointCheckIn,
  startBreakPhase,
  type EncourageReaction,
  type MatchDuration,
  type MatchFlexibility,
  type MatchMetricsSnapshot,
  type PomodoroState,
  type StudyEnergy,
  type StudyVibe,
} from './studyMatchCore.js';
import { moderateMatchContent } from './matchModerator.js';

export { canonicalTopicKey, emailDomain, normalizeTopicKey } from './studyMatchCore.js';

const DURATIONS = new Set([15, 20, 25, 30]);
const REPORT_REASONS = new Set([
  'harassment',
  'hate',
  'spam',
  'off_topic',
  'privacy',
  'other',
]);

const enqueueLimiter = createRateLimiter(8, 5 * 60_000);
const chatLimiter = createRateLimiter(40, 60_000);
const heartbeatLimiter = createRateLimiter(60, 60_000);

type AuthUser = { uid: string; claims?: Record<string, unknown> };

export type { MatchDuration };
export type QueueStatus = 'waiting' | 'matched' | 'cancelled';
export type SessionStatus = 'active' | 'ended' | 'reported';

export type QueueEntry = {
  uid: string;
  email: string;
  topicKey: string;
  topicLabel: string;
  durationMin: MatchDuration;
  domainFilter: string;
  flexibility: MatchFlexibility;
  vibe: StudyVibe;
  energy: StudyEnergy;
  sessionGoal: string;
  status: QueueStatus;
  createdAt: string;
  expiresAt: string;
  sessionId: string | null;
};

export type MatchChatMessage = {
  id: string;
  userId: string;
  displayName: string;
  text: string;
  createdAt: string;
  reactions?: Partial<Record<EncourageReaction, string[]>>;
};

export type MatchSession = {
  id: string;
  topicKey: string;
  topicLabel: string;
  topicMatched: boolean;
  durationMin: MatchDuration;
  memberIds: [string, string];
  memberEmails: [string, string];
  roomId: string;
  status: SessionStatus;
  startedAt: string;
  endsAt: string;
  notes: string;
  notesVersion: number;
  messages: MatchChatMessage[];
  meetConsent: Record<string, boolean>;
  meetUrl: string | null;
  domainFilter: string;
  pomodoro: PomodoroState;
  presence: Record<string, string>;
  quietFocus: Record<string, boolean>;
  midpointSent: boolean;
  /** Discrete learning-social signals (not a public profile). */
  vibes: Record<string, StudyVibe>;
  energies: Record<string, StudyEnergy>;
  sessionGoal: string;
  respectVotes: Record<string, boolean>;
  createdAt: string;
  updatedAt: string;
};

// ── In-memory fallback when Admin SDK is unavailable (preview / local) ──
const memoryQueue = new Map<string, QueueEntry>();
const memorySessions = new Map<string, MatchSession>();
const memoryBlocks = new Set<string>();
/** uid → ISO timestamp until which rematch is blocked after a report */
const memoryCooldowns = new Map<string, string>();
const matchMetrics: MatchMetricsSnapshot = emptyMatchMetrics();

function getAuthUser(res: Response): AuthUser {
  const user = res.locals.user as AuthUser | undefined;
  if (!user?.uid) throw new HttpError(401, 'Sign in with a verified Google account to use Study Match');
  return user;
}

function claimEmail(user: AuthUser): string {
  const email = String(user.claims?.email ?? '')
    .trim()
    .toLowerCase();
  if (!email || !email.includes('@')) {
    throw new HttpError(403, 'A verified email is required for Study Match');
  }
  const verified = user.claims?.email_verified;
  if (verified === false) {
    throw new HttpError(403, 'Verify your Google email before joining Study Match');
  }
  return email;
}

export function buddyDisplayName(uid: string): string {
  const h = createHash('sha256').update(uid).digest('hex');
  const code = (parseInt(h.slice(0, 4), 16) % 9000) + 1000;
  return `Buddy-${code}`;
}

function blockKey(a: string, b: string): string {
  return [a, b].sort().join('::');
}

function newId(prefix: string): string {
  return `${prefix}_${randomBytes(12).toString('hex')}`;
}

function roomIdFor(sessionId: string): string {
  return `match-${sessionId}`.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64);
}

export function domainsCompatible(a: QueueEntry, b: QueueEntry): boolean {
  if (a.domainFilter && emailDomain(a.email) !== a.domainFilter) return false;
  if (b.domainFilter && emailDomain(b.email) !== b.domainFilter) return false;
  if (a.domainFilter && emailDomain(b.email) !== a.domainFilter) return false;
  if (b.domainFilter && emailDomain(a.email) !== b.domainFilter) return false;
  return true;
}

async function isBlocked(db: Firestore | null, a: string, b: string): Promise<boolean> {
  const key = blockKey(a, b);
  if (memoryBlocks.has(key)) return true;
  if (!db) return false;
  const snap = await db.collection('matchBlocks').doc(key).get();
  return snap.exists;
}

async function writeBlock(db: Firestore | null, a: string, b: string, reason: string): Promise<void> {
  const key = blockKey(a, b);
  memoryBlocks.add(key);
  if (!db) return;
  await db.collection('matchBlocks').doc(key).set({
    members: [a, b].sort(),
    reason,
    createdAt: new Date().toISOString(),
  });
}

function ensurePomodoro(session: MatchSession): PomodoroState {
  if (session.pomodoro?.phaseEndsAt) return session.pomodoro;
  return buildInitialPomodoro(session.durationMin, new Date(session.startedAt));
}

function toSessionView(session: MatchSession, selfId: string) {
  const peerId = session.memberIds[0] === selfId ? session.memberIds[1] : session.memberIds[0];
  const pomodoro = ensurePomodoro(session);
  const presence = session.presence ?? {};
  const quietFocus = session.quietFocus ?? {};
  return {
    id: session.id,
    topicLabel: session.topicLabel,
    topicKey: session.topicKey,
    durationMin: session.durationMin,
    roomId: session.roomId,
    status: session.status,
    startedAt: session.startedAt,
    endsAt: session.endsAt,
    notes: session.notes,
    notesVersion: session.notesVersion ?? 0,
    messages: (session.messages ?? []).slice(-100),
    meetConsent: session.meetConsent,
    meetUrl: session.meetUrl,
    selfId,
    peerId,
    peerDisplayName: buddyDisplayName(peerId),
    domainFilter: session.domainFilter,
    pomodoro,
    peerOnline: isPeerOnline(presence[peerId]),
    selfOnline: isPeerOnline(presence[selfId]),
    quietFocusSelf: Boolean(quietFocus[selfId]),
    quietFocusPeer: Boolean(quietFocus[peerId]),
    midpointSent: Boolean(session.midpointSent),
    topicMatched: Boolean(session.topicMatched),
    sessionGoal: session.sessionGoal ?? '',
    selfVibe: session.vibes?.[selfId] ?? 'balanced',
    peerVibe: session.vibes?.[peerId] ?? 'balanced',
    selfEnergy: session.energies?.[selfId] ?? 'steady',
    peerEnergy: session.energies?.[peerId] ?? 'steady',
    respectVoted: session.respectVotes?.[selfId] !== undefined,
  };
}

async function setCooldown(db: Firestore | null, uid: string, untilIso: string): Promise<void> {
  memoryCooldowns.set(uid, untilIso);
  if (!db) return;
  await db.collection('matchCooldowns').doc(uid).set({ until: untilIso, updatedAt: new Date().toISOString() });
}

async function getCooldownUntil(db: Firestore | null, uid: string): Promise<string | undefined> {
  const mem = memoryCooldowns.get(uid);
  if (mem) return mem;
  if (!db) return undefined;
  const snap = await db.collection('matchCooldowns').doc(uid).get();
  if (!snap.exists) return undefined;
  const until = String(snap.data()?.until ?? '');
  if (until) memoryCooldowns.set(uid, until);
  return until || undefined;
}

function buildSessionDoc(a: QueueEntry, b: QueueEntry): MatchSession {
  const id = newId('ms');
  const now = new Date();
  const pomo = buildInitialPomodoro(a.durationMin, now);
  const roomId = roomIdFor(id);
  const topicMatched =
    Boolean(a.topicKey) &&
    a.topicKey === b.topicKey &&
    a.topicKey !== 'general-study';
  const topicLabel = topicMatched
    ? a.topicLabel || b.topicLabel
    : a.topicLabel && b.topicLabel && a.topicLabel !== b.topicLabel
      ? `${a.topicLabel} + ${b.topicLabel}`
      : a.topicLabel || b.topicLabel || 'General study';
  const goal = [a.sessionGoal, b.sessionGoal].filter(Boolean).join(' · ').slice(0, 240);
  return {
    id,
    topicKey: topicMatched ? a.topicKey : 'mixed-study',
    topicLabel,
    topicMatched,
    durationMin: a.durationMin,
    memberIds: [a.uid, b.uid],
    memberEmails: [a.email, b.email],
    roomId,
    status: 'active',
    startedAt: now.toISOString(),
    endsAt: pomo.phaseEndsAt,
    notes: '',
    notesVersion: 0,
    messages: [
      {
        id: newId('msg'),
        userId: 'system',
        displayName: 'Memora',
        text: topicMatched
          ? `Focus Pomodoro: ${topicLabel} · ${a.durationMin}′. Same topic match. Camera off. AI safety moderator is on.`
          : `Focus Pomodoro · ${a.durationMin}′. You matched as study buddies (topics may differ). Camera off. AI safety moderator is on.`,
        createdAt: now.toISOString(),
      },
      ...(goal
        ? [
            {
              id: newId('msg'),
              userId: 'system',
              displayName: 'Memora',
              text: `Session intention: ${goal}`,
              createdAt: now.toISOString(),
            },
          ]
        : []),
    ],
    meetConsent: { [a.uid]: false, [b.uid]: false },
    meetUrl: null,
    domainFilter: a.domainFilter || b.domainFilter || '',
    pomodoro: pomo,
    presence: { [a.uid]: now.toISOString(), [b.uid]: now.toISOString() },
    quietFocus: { [a.uid]: false, [b.uid]: false },
    midpointSent: false,
    vibes: { [a.uid]: a.vibe ?? 'balanced', [b.uid]: b.vibe ?? 'balanced' },
    energies: { [a.uid]: a.energy ?? 'steady', [b.uid]: b.energy ?? 'steady' },
    sessionGoal: goal,
    respectVotes: {},
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };
}

async function getQueueEntry(db: Firestore | null, uid: string): Promise<QueueEntry | null> {
  if (db) {
    const snap = await db.collection('matchQueue').doc(uid).get();
    if (!snap.exists) return memoryQueue.get(uid) ?? null;
    return snap.data() as QueueEntry;
  }
  return memoryQueue.get(uid) ?? null;
}

async function setQueueEntry(db: Firestore | null, entry: QueueEntry): Promise<void> {
  memoryQueue.set(entry.uid, entry);
  if (db) await db.collection('matchQueue').doc(entry.uid).set(entry);
}

async function deleteQueueEntry(db: Firestore | null, uid: string): Promise<void> {
  memoryQueue.delete(uid);
  if (db) await db.collection('matchQueue').doc(uid).delete().catch(() => undefined);
}

async function getSession(db: Firestore | null, id: string): Promise<MatchSession | null> {
  if (memorySessions.has(id)) return memorySessions.get(id)!;
  if (!db) return null;
  const snap = await db.collection('matchSessions').doc(id).get();
  if (!snap.exists) return null;
  const data = snap.data() as MatchSession;
  memorySessions.set(id, data);
  return data;
}

async function setSession(db: Firestore | null, session: MatchSession): Promise<void> {
  memorySessions.set(session.id, session);
  if (db) await db.collection('matchSessions').doc(session.id).set(session);
}

async function createCollabRoom(
  db: Firestore | null,
  roomId: string,
  ownerId: string,
  emails: string[],
): Promise<void> {
  if (!db) return;
  await db.collection('rooms').doc(roomId).set({
    ownerId,
    memberEmails: emails.map((e) => e.toLowerCase()),
    createdAt: new Date(),
    matchSession: true,
  });
}

async function listWaitingCandidates(
  db: Firestore | null,
  durationMin: MatchDuration,
): Promise<QueueEntry[]> {
  const now = Date.now();
  let pool: QueueEntry[] = [];
  if (db) {
    try {
      const snap = await db
        .collection('matchQueue')
        .where('status', '==', 'waiting')
        .where('durationMin', '==', durationMin)
        .orderBy('createdAt', 'asc')
        .limit(80)
        .get();
      pool = snap.docs.map((d) => d.data() as QueueEntry);
    } catch {
      const snap = await db.collection('matchQueue').where('status', '==', 'waiting').limit(120).get();
      pool = snap.docs
        .map((d) => d.data() as QueueEntry)
        .filter((e) => e.durationMin === durationMin);
    }
  } else {
    pool = [...memoryQueue.values()].filter(
      (e) => e.status === 'waiting' && e.durationMin === durationMin,
    );
  }
  return pool.filter((e) => new Date(e.expiresAt).getTime() > now);
}

async function pairUsers(
  db: Firestore | null,
  a: QueueEntry,
  b: QueueEntry,
): Promise<MatchSession> {
  const session = buildSessionDoc(a, b);
  await createCollabRoom(db, session.roomId, a.uid, [a.email, b.email]);
  await setSession(db, session);

  const matchedA: QueueEntry = { ...a, status: 'matched', sessionId: session.id };
  const matchedB: QueueEntry = { ...b, status: 'matched', sessionId: session.id };
  await setQueueEntry(db, matchedA);
  await setQueueEntry(db, matchedB);
  matchMetrics.matchesTotal += 1;
  return session;
}

async function tryMatch(db: Firestore | null, entrant: QueueEntry): Promise<MatchSession | null> {
  const candidates = await listWaitingCandidates(db, entrant.durationMin);
  const ranked: QueueEntry[] = [];
  for (const other of candidates) {
    if (other.uid === entrant.uid) continue;
    if (await isBlocked(db, entrant.uid, other.uid)) continue;
    if (!domainsCompatible(entrant, other)) continue;
    ranked.push(other);
  }
  ranked.sort((x, y) => {
    const sy = scoreMatchCandidate({
      entrantTopicKey: entrant.topicKey,
      otherTopicKey: y.topicKey,
      entrantFlexibility: entrant.flexibility ?? 'prefer_topic',
      otherFlexibility: y.flexibility ?? 'prefer_topic',
      entrantVibe: entrant.vibe ?? 'balanced',
      otherVibe: y.vibe ?? 'balanced',
      createdAt: y.createdAt,
    });
    const sx = scoreMatchCandidate({
      entrantTopicKey: entrant.topicKey,
      otherTopicKey: x.topicKey,
      entrantFlexibility: entrant.flexibility ?? 'prefer_topic',
      otherFlexibility: x.flexibility ?? 'prefer_topic',
      entrantVibe: entrant.vibe ?? 'balanced',
      otherVibe: x.vibe ?? 'balanced',
      createdAt: x.createdAt,
    });
    return sy - sx;
  });

  for (const other of ranked) {
    if (db) {
      // Transactional claim — avoids double-pairing under concurrent polls
      try {
        const session = await db.runTransaction(async (tx) => {
          const aRef = db.collection('matchQueue').doc(entrant.uid);
          const bRef = db.collection('matchQueue').doc(other.uid);
          const [aSnap, bSnap] = await Promise.all([tx.get(aRef), tx.get(bRef)]);
          if (!aSnap.exists || !bSnap.exists) return null;
          const a = aSnap.data() as QueueEntry;
          const b = bSnap.data() as QueueEntry;
          if (a.status !== 'waiting' || b.status !== 'waiting') return null;
          if (!domainsCompatible(a, b)) return null;

          const sessionDoc = buildSessionDoc(a, b);
          const now = new Date();

          tx.set(db.collection('matchSessions').doc(sessionDoc.id), sessionDoc);
          tx.set(db.collection('rooms').doc(sessionDoc.roomId), {
            ownerId: a.uid,
            memberEmails: [a.email, b.email],
            createdAt: now,
            matchSession: true,
          });
          tx.set(aRef, { ...a, status: 'matched', sessionId: sessionDoc.id });
          tx.set(bRef, { ...b, status: 'matched', sessionId: sessionDoc.id });
          return sessionDoc;
        });
        if (session) {
          memorySessions.set(session.id, session);
          for (const uid of session.memberIds) {
            const prev = memoryQueue.get(uid) ?? (await getQueueEntry(db, uid));
            if (prev) {
              memoryQueue.set(uid, { ...prev, status: 'matched', sessionId: session.id });
            }
          }
          matchMetrics.matchesTotal += 1;
          return session;
        }
      } catch {
        continue;
      }
      continue;
    }

    const fresh = await getQueueEntry(db, other.uid);
    if (!fresh || fresh.status !== 'waiting') continue;
    return pairUsers(db, entrant, fresh);
  }
  return null;
}

function parseDuration(raw: unknown): MatchDuration {
  const n = Number(raw);
  if (!DURATIONS.has(n)) throw new HttpError(400, 'durationMin must be 15, 20, 25, or 30');
  return n as MatchDuration;
}

// ── Handlers ──────────────────────────────────────────────────────────────

export async function enqueueMatchHandler(req: Request, res: Response): Promise<void> {
  const user = getAuthUser(res);
  const email = claimEmail(user);
  if (!enqueueLimiter.allow(user.uid)) {
    throw new HttpError(429, 'Too many match attempts — wait a few minutes');
  }
  if (req.body?.guidelinesAccepted !== true) {
    throw new HttpError(403, 'Accept community guidelines before joining Study Match');
  }
  // Topic is optional — same subject preferred, not required.
  const topicLabelRaw = String(req.body?.topicLabel ?? '').trim().slice(0, 120);
  const topicLabel = topicLabelRaw || 'General study';
  const topicKey = topicLabelRaw ? canonicalTopicKey(topicLabelRaw) : 'general-study';
  if (!topicKey) throw new HttpError(400, 'Topic could not be normalized');

  const durationMin = parseDuration(req.body?.durationMin);
  const flexibility: MatchFlexibility =
    req.body?.flexibility === 'any_study' ? 'any_study' : 'prefer_topic';
  const vibe: StudyVibe = isValidStudyVibe(req.body?.vibe) ? req.body.vibe : 'balanced';
  const energy: StudyEnergy = isValidStudyEnergy(req.body?.energy)
    ? req.body.energy
    : 'steady';
  let sessionGoal = String(req.body?.sessionGoal ?? '')
    .trim()
    .slice(0, 160);
  if (sessionGoal) {
    const mod = await moderateMatchContent(sessionGoal, 'goal');
    if (!mod.allowed) throw new HttpError(400, mod.reason);
  }

  let domainFilter = String(req.body?.domainFilter ?? '')
    .trim()
    .toLowerCase()
    .slice(0, 120);
  if (domainFilter) {
    if (!/^[a-z0-9]([a-z0-9.-]*[a-z0-9])?$/.test(domainFilter) || !domainFilter.includes('.')) {
      throw new HttpError(400, 'domainFilter must look like uni.edu');
    }
    if (emailDomain(email) !== domainFilter) {
      throw new HttpError(403, `Your email must end with @${domainFilter} to use that filter`);
    }
  }

  const db = await getAdminFirestore();
  const cooldownUntil = await getCooldownUntil(db, user.uid);
  if (isInCooldown(cooldownUntil)) {
    const mins = Math.ceil(cooldownRemainingMs(cooldownUntil) / 60_000);
    throw new HttpError(
      429,
      `Rematch cooldown active after a safety report — try again in ~${mins} min`,
    );
  }
  const existing = await getQueueEntry(db, user.uid);
  if (existing?.status === 'matched' && existing.sessionId) {
    const session = await getSession(db, existing.sessionId);
    if (session && session.status === 'active') {
      res.json({ status: 'matched', session: toSessionView(session, user.uid) });
      return;
    }
  }

  const now = new Date();
  const entry: QueueEntry = {
    uid: user.uid,
    email,
    topicKey,
    topicLabel,
    durationMin,
    domainFilter,
    flexibility,
    vibe,
    energy,
    sessionGoal,
    status: 'waiting',
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + 15 * 60_000).toISOString(),
    sessionId: null,
  };
  await setQueueEntry(db, entry);

  const session = await tryMatch(db, entry);
  if (session) {
    res.json({ status: 'matched', session: toSessionView(session, user.uid) });
    return;
  }

  res.json({
    status: 'waiting',
    topicLabel,
    durationMin,
    queuedAt: entry.createdAt,
  });
}

export async function leaveQueueHandler(_req: Request, res: Response): Promise<void> {
  const user = getAuthUser(res);
  const db = await getAdminFirestore();
  const entry = await getQueueEntry(db, user.uid);
  if (entry?.status === 'waiting') {
    await deleteQueueEntry(db, user.uid);
  } else if (entry?.status === 'matched') {
    // Keep queue marker until session ends — client should call leave session
  } else {
    await deleteQueueEntry(db, user.uid);
  }
  res.json({ ok: true });
}

export async function matchStatusHandler(_req: Request, res: Response): Promise<void> {
  const user = getAuthUser(res);
  const db = await getAdminFirestore();
  const entry = await getQueueEntry(db, user.uid);
  if (!entry) {
    res.json({ status: 'idle' });
    return;
  }
  if (entry.status === 'matched' && entry.sessionId) {
    const session = await getSession(db, entry.sessionId);
    if (session && session.status === 'active') {
      // Auto-end if timer elapsed
      if (new Date(session.endsAt).getTime() <= Date.now()) {
        session.status = 'ended';
        session.updatedAt = new Date().toISOString();
        await setSession(db, session);
        await deleteQueueEntry(db, user.uid);
        res.json({ status: 'idle' });
        return;
      }
      res.json({ status: 'matched', session: toSessionView(session, user.uid) });
      return;
    }
  }
  if (entry.status === 'waiting') {
    if (new Date(entry.expiresAt).getTime() <= Date.now()) {
      await deleteQueueEntry(db, user.uid);
      res.json({ status: 'idle' });
      return;
    }
    // Opportunistic rematch while polling
    const session = await tryMatch(db, entry);
    if (session) {
      res.json({ status: 'matched', session: toSessionView(session, user.uid) });
      return;
    }
    res.json({
      status: 'waiting',
      topicLabel: entry.topicLabel,
      durationMin: entry.durationMin,
      queuedAt: entry.createdAt,
    });
    return;
  }
  res.json({ status: 'idle' });
}

export async function getSessionHandler(req: Request, res: Response): Promise<void> {
  const user = getAuthUser(res);
  const sessionId = String(req.params.sessionId ?? '');
  const db = await getAdminFirestore();
  const session = await getSession(db, sessionId);
  if (!session || !session.memberIds.includes(user.uid)) {
    throw new HttpError(404, 'Session not found');
  }
  if (session.status === 'active' && new Date(session.endsAt).getTime() <= Date.now()) {
    session.status = 'ended';
    session.updatedAt = new Date().toISOString();
    await setSession(db, session);
  }
  res.json(toSessionView(session, user.uid));
}

export async function leaveSessionHandler(req: Request, res: Response): Promise<void> {
  const user = getAuthUser(res);
  const sessionId = String(req.params.sessionId ?? '');
  const db = await getAdminFirestore();
  const session = await getSession(db, sessionId);
  if (!session || !session.memberIds.includes(user.uid)) {
    throw new HttpError(404, 'Session not found');
  }
  const wasActive = session.status === 'active';
  if (wasActive) {
    session.status = 'ended';
    session.updatedAt = new Date().toISOString();
    await setSession(db, session);
    matchMetrics.leavesTotal += 1;
  }
  for (const uid of session.memberIds) {
    await deleteQueueEntry(db, uid);
  }
  const studiedSec = Math.max(
    0,
    Math.floor((Date.now() - new Date(session.startedAt).getTime()) / 1000),
  );
  res.json({
    ok: true,
    summary: {
      topicLabel: session.topicLabel,
      durationMin: session.durationMin,
      studiedSec,
      cycles: session.pomodoro?.cycle ?? 1,
      // Never include peer identity in post-session summary
    },
  });
}

export async function reportSessionHandler(req: Request, res: Response): Promise<void> {
  const user = getAuthUser(res);
  const sessionId = String(req.params.sessionId ?? '');
  const reason = String(req.body?.reason ?? '');
  const note = String(req.body?.note ?? '')
    .trim()
    .slice(0, 280);
  if (!REPORT_REASONS.has(reason)) {
    throw new HttpError(400, 'Invalid report reason');
  }

  const db = await getAdminFirestore();
  const session = await getSession(db, sessionId);
  if (!session || !session.memberIds.includes(user.uid)) {
    throw new HttpError(404, 'Session not found');
  }

  const peerId = session.memberIds.find((id) => id !== user.uid)!;
  await writeBlock(db, user.uid, peerId, reason);
  const until = new Date(Date.now() + REPORT_COOLDOWN_MS).toISOString();
  await setCooldown(db, user.uid, until);
  await setCooldown(db, peerId, until);

  session.status = 'reported';
  session.updatedAt = new Date().toISOString();
  await setSession(db, session);
  matchMetrics.reportsTotal += 1;

  if (db) {
    await db
      .collection('matchSessions')
      .doc(sessionId)
      .collection('reports')
      .add({
        reporterId: user.uid,
        reason,
        note,
        createdAt: new Date().toISOString(),
      });
    // Mirror into room reports for existing triage tooling
    await db
      .collection('rooms')
      .doc(session.roomId)
      .collection('reports')
      .add({
        reporterId: user.uid,
        messageId: `match-session:${sessionId}`,
        reason,
        note,
        createdAt: new Date(),
      });
  }

  for (const uid of session.memberIds) {
    await deleteQueueEntry(db, uid);
  }
  res.json({ ok: true, blocked: true });
}

export async function meetConsentHandler(req: Request, res: Response): Promise<void> {
  const user = getAuthUser(res);
  const sessionId = String(req.params.sessionId ?? '');
  const consent = Boolean(req.body?.consent);
  const db = await getAdminFirestore();
  const session = await getSession(db, sessionId);
  if (!session || !session.memberIds.includes(user.uid)) {
    throw new HttpError(404, 'Session not found');
  }
  if (session.status !== 'active') throw new HttpError(409, 'Session is not active');

  session.meetConsent = { ...session.meetConsent, [user.uid]: consent };
  session.updatedAt = new Date().toISOString();
  await setSession(db, session);
  res.json(toSessionView(session, user.uid));
}

export async function createMeetHandler(req: Request, res: Response): Promise<void> {
  const user = getAuthUser(res);
  const sessionId = String(req.params.sessionId ?? '');
  const db = await getAdminFirestore();
  const session = await getSession(db, sessionId);
  if (!session || !session.memberIds.includes(user.uid)) {
    throw new HttpError(404, 'Session not found');
  }
  if (session.status !== 'active') throw new HttpError(409, 'Session is not active');

  const both =
    session.memberIds.every((id) => session.meetConsent[id] === true);
  if (!both) {
    throw new HttpError(403, 'Both study buddies must opt in before starting Meet');
  }

  if (session.meetUrl) {
    res.json({ meetUrl: session.meetUrl, fallback: false, session: toSessionView(session, user.uid) });
    return;
  }

  const token =
    (typeof req.body?.accessToken === 'string' && req.body.accessToken) ||
    process.env.GOOGLE_ACCESS_TOKEN ||
    '';

  let meetUrl = 'https://meet.google.com/new';
  let fallback = true;
  if (token) {
    try {
      const spaceRes = await fetch('https://meet.googleapis.com/v2/spaces', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });
      if (spaceRes.ok) {
        const space = (await spaceRes.json()) as { meetingUri?: string };
        if (space.meetingUri) {
          meetUrl = space.meetingUri;
          fallback = false;
        }
      }
    } catch {
      /* use fallback */
    }
  }

  session.meetUrl = meetUrl;
  session.updatedAt = new Date().toISOString();
  await setSession(db, session);
  if (!fallback) matchMetrics.meetCreatedTotal += 1;
  res.json({ meetUrl, fallback, session: toSessionView(session, user.uid) });
}

export async function saveNotesHandler(req: Request, res: Response): Promise<void> {
  const user = getAuthUser(res);
  const sessionId = String(req.params.sessionId ?? '');
  const notes = String(req.body?.notes ?? '').slice(0, 20000);
  const expectedVersion =
    req.body?.notesVersion === undefined ? undefined : Number(req.body.notesVersion);
  const db = await getAdminFirestore();
  const session = await getSession(db, sessionId);
  if (!session || !session.memberIds.includes(user.uid)) {
    throw new HttpError(404, 'Session not found');
  }
  if (session.status !== 'active') throw new HttpError(409, 'Session is not active');
  if (notes.trim()) {
    const mod = await moderateMatchContent(notes.slice(0, 2000), 'notes');
    if (!mod.allowed) throw new HttpError(400, mod.reason);
  }
  const currentVersion = session.notesVersion ?? 0;
  if (expectedVersion !== undefined && expectedVersion !== currentVersion) {
    throw new HttpError(409, 'Notes were updated by your buddy — refresh and try again');
  }
  session.notes = notes;
  session.notesVersion = currentVersion + 1;
  session.updatedAt = new Date().toISOString();
  await setSession(db, session);
  res.json({ ok: true, notesVersion: session.notesVersion });
}

export async function postMessageHandler(req: Request, res: Response): Promise<void> {
  const user = getAuthUser(res);
  const sessionId = String(req.params.sessionId ?? '');
  const text = String(req.body?.text ?? '')
    .trim()
    .slice(0, 1000);
  if (!chatLimiter.allow(user.uid)) {
    throw new HttpError(429, 'Slow down — chat rate limit reached');
  }
  const moderation = await moderateMatchContent(text, 'chat');
  if (!moderation.allowed) {
    throw new HttpError(400, moderation.reason);
  }

  const db = await getAdminFirestore();
  const session = await getSession(db, sessionId);
  if (!session || !session.memberIds.includes(user.uid)) {
    throw new HttpError(404, 'Session not found');
  }
  if (session.status !== 'active') throw new HttpError(409, 'Session is not active');

  const msg: MatchChatMessage = {
    id: newId('msg'),
    userId: user.uid,
    displayName: buddyDisplayName(user.uid),
    text,
    createdAt: new Date().toISOString(),
    reactions: {},
  };
  session.messages = [...(session.messages ?? []), msg].slice(-100);
  session.presence = {
    ...(session.presence ?? {}),
    [user.uid]: new Date().toISOString(),
  };
  session.updatedAt = new Date().toISOString();
  await setSession(db, session);
  res.json({ message: msg, session: toSessionView(session, user.uid) });
}

export async function heartbeatHandler(req: Request, res: Response): Promise<void> {
  const user = getAuthUser(res);
  const sessionId = String(req.params.sessionId ?? '');
  if (!heartbeatLimiter.allow(user.uid)) {
    res.json({ ok: true, throttled: true });
    return;
  }
  const db = await getAdminFirestore();
  const session = await getSession(db, sessionId);
  if (!session || !session.memberIds.includes(user.uid)) {
    throw new HttpError(404, 'Session not found');
  }
  if (session.status !== 'active') {
    res.json({ ok: true, session: toSessionView(session, user.uid) });
    return;
  }
  session.presence = {
    ...(session.presence ?? {}),
    [user.uid]: new Date().toISOString(),
  };
  session.pomodoro = ensurePomodoro(session);

  // Midpoint accountability nudge (once per focus phase)
  if (
    session.pomodoro.phase === 'focus' &&
    shouldEmitMidpointCheckIn({
      startedAt: session.pomodoro.phaseStartedAt,
      endsAt: session.pomodoro.phaseEndsAt,
      midpointSent: Boolean(session.midpointSent),
    })
  ) {
    session.midpointSent = true;
    session.messages = [
      ...(session.messages ?? []),
      {
        id: newId('msg'),
        userId: 'system',
        displayName: 'Memora',
        text: `Halfway through this focus block on ${session.topicLabel}. Quick check-in: still on topic?`,
        createdAt: new Date().toISOString(),
      },
    ].slice(-100);
  }

  session.updatedAt = new Date().toISOString();
  await setSession(db, session);
  res.json({ ok: true, session: toSessionView(session, user.uid) });
}

export async function quietFocusHandler(req: Request, res: Response): Promise<void> {
  const user = getAuthUser(res);
  const sessionId = String(req.params.sessionId ?? '');
  const enabled = Boolean(req.body?.enabled);
  const db = await getAdminFirestore();
  const session = await getSession(db, sessionId);
  if (!session || !session.memberIds.includes(user.uid)) {
    throw new HttpError(404, 'Session not found');
  }
  if (session.status !== 'active') throw new HttpError(409, 'Session is not active');
  session.quietFocus = { ...(session.quietFocus ?? {}), [user.uid]: enabled };
  session.updatedAt = new Date().toISOString();
  await setSession(db, session);
  res.json(toSessionView(session, user.uid));
}

export async function matchMetricsHandler(_req: Request, res: Response): Promise<void> {
  // Anonymized ops snapshot — no emails, no uids, no message content.
  getAuthUser(res);
  const waiting = [...memoryQueue.values()].filter((e) => e.status === 'waiting').length;
  const active = [...memorySessions.values()].filter((s) => s.status === 'active').length;
  res.json({
    ...matchMetrics,
    queueWaiting: waiting,
    sessionsActive: active,
    generatedAt: new Date().toISOString(),
  });
}

export async function pomodoroHandler(req: Request, res: Response): Promise<void> {
  const user = getAuthUser(res);
  const sessionId = String(req.params.sessionId ?? '');
  const action = String(req.body?.action ?? '');
  const db = await getAdminFirestore();
  const session = await getSession(db, sessionId);
  if (!session || !session.memberIds.includes(user.uid)) {
    throw new HttpError(404, 'Session not found');
  }
  if (session.status !== 'active') throw new HttpError(409, 'Session is not active');

  const now = new Date();
  const pomo = ensurePomodoro(session);
  if (action === 'start_break') {
    session.pomodoro = startBreakPhase(pomo, now);
    session.endsAt = session.pomodoro.phaseEndsAt;
    session.messages = [
      ...(session.messages ?? []),
      {
        id: newId('msg'),
        userId: 'system',
        displayName: 'Memora',
        text: `Shared ${session.pomodoro.breakMin}′ break started. Stretch, hydrate — then back to ${session.topicLabel}.`,
        createdAt: now.toISOString(),
      },
    ].slice(-100);
  } else if (action === 'start_focus') {
    const focusMin = parseDuration(req.body?.durationMin ?? session.durationMin);
    session.pomodoro = resumeFocusPhase(pomo, focusMin, now);
    session.midpointSent = false;
    session.durationMin = focusMin;
    session.endsAt = session.pomodoro.phaseEndsAt;
    session.messages = [
      ...(session.messages ?? []),
      {
        id: newId('msg'),
        userId: 'system',
        displayName: 'Memora',
        text: `Focus cycle ${session.pomodoro.cycle} · ${focusMin}′ on ${session.topicLabel}.`,
        createdAt: now.toISOString(),
      },
    ].slice(-100);
  } else {
    throw new HttpError(400, 'action must be start_break or start_focus');
  }
  session.presence = {
    ...(session.presence ?? {}),
    [user.uid]: now.toISOString(),
  };
  session.updatedAt = now.toISOString();
  await setSession(db, session);
  res.json(toSessionView(session, user.uid));
}

export async function reactMessageHandler(req: Request, res: Response): Promise<void> {
  const user = getAuthUser(res);
  const sessionId = String(req.params.sessionId ?? '');
  const messageId = String(req.body?.messageId ?? '');
  const kind = String(req.body?.kind ?? '') as EncourageReaction;
  if (!(ENCOURAGE_REACTIONS as readonly string[]).includes(kind)) {
    throw new HttpError(400, 'Invalid reaction');
  }
  const db = await getAdminFirestore();
  const session = await getSession(db, sessionId);
  if (!session || !session.memberIds.includes(user.uid)) {
    throw new HttpError(404, 'Session not found');
  }
  if (session.status !== 'active') throw new HttpError(409, 'Session is not active');

  session.messages = (session.messages ?? []).map((m) => {
    if (m.id !== messageId || m.userId === 'system') return m;
    if (m.userId === user.uid) return m; // no self-react
    const reactions = { ...(m.reactions ?? {}) };
    const list = new Set(reactions[kind] ?? []);
    if (list.has(user.uid)) list.delete(user.uid);
    else list.add(user.uid);
    reactions[kind] = [...list];
    return { ...m, reactions };
  });
  session.updatedAt = new Date().toISOString();
  await setSession(db, session);
  res.json(toSessionView(session, user.uid));
}

/** Private respect vote after session — never a public profile score. */
export async function respectVoteHandler(req: Request, res: Response): Promise<void> {
  const user = getAuthUser(res);
  const sessionId = String(req.params.sessionId ?? '');
  const respectful = Boolean(req.body?.respectful);
  const db = await getAdminFirestore();
  const session = await getSession(db, sessionId);
  if (!session || !session.memberIds.includes(user.uid)) {
    throw new HttpError(404, 'Session not found');
  }
  session.respectVotes = { ...(session.respectVotes ?? {}), [user.uid]: respectful };
  session.updatedAt = new Date().toISOString();
  await setSession(db, session);
  res.json({ ok: true });
}

/** Test helpers (unit tests only). */
export const __test__ = {
  memoryQueue,
  memorySessions,
  memoryBlocks,
  memoryCooldowns,
  matchMetrics,
  domainsCompatible,
  pairUsers,
  normalizeTopicKey,
  buddyDisplayName,
  blockKey,
  setCooldown,
  scoreMatchCandidate,
};
