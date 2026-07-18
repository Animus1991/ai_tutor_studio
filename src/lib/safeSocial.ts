/**
 * Student-safe social helpers for Memora.
 * Principles: invite-only, room-scoped, no public feeds/DMs, reportable, learning-purpose only.
 */
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type Firestore,
} from 'firebase/firestore';

export const REPORT_REASONS = [
  'harassment',
  'hate',
  'spam',
  'off_topic',
  'privacy',
  'other',
] as const;

export type ReportReason = (typeof REPORT_REASONS)[number];

export const KUDOS_KINDS = ['helpful', 'clarify', 'encourage'] as const;
export type KudosKind = (typeof KUDOS_KINDS)[number];

export const STUDY_FOCUS_OPTIONS = [
  'focusing',
  'reading',
  'practicing',
  'collaborating',
  'break',
] as const;

export type StudyFocus = (typeof STUDY_FOCUS_OPTIONS)[number];

/** Bump when policy text changes — users must re-accept. */
export const GUIDELINES_VERSION = 'v2';
const GUIDELINES_KEY = `memora-community-guidelines-${GUIDELINES_VERSION}`;
const GUIDELINES_LEGACY_KEYS = ['memora-community-guidelines-v1'];
const KUDOS_RATE_KEY = 'memora-kudos-rate';
const KUDOS_MAX_PER_HOUR = 20;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isValidInviteEmail(email: string): boolean {
  const normalized = normalizeEmail(email);
  return normalized.length <= 254 && EMAIL_RE.test(normalized);
}

/** Deterministic Collab room id for a study circle (must match Firestore isValidId). */
export function circleCollabRoomId(circleId: string): string {
  return `circle-${circleId}`.slice(0, 64);
}

export function hasAcceptedCommunityGuidelines(): boolean {
  try {
    return localStorage.getItem(GUIDELINES_KEY) === '1';
  } catch {
    return false;
  }
}

export function acceptCommunityGuidelines(): void {
  try {
    localStorage.setItem(GUIDELINES_KEY, '1');
    localStorage.setItem(`${GUIDELINES_KEY}:at`, new Date().toISOString());
    localStorage.setItem(`${GUIDELINES_KEY}:version`, GUIDELINES_VERSION);
    for (const legacy of GUIDELINES_LEGACY_KEYS) {
      localStorage.removeItem(legacy);
    }
  } catch {
    /* ignore */
  }
}

export function acceptedGuidelinesVersion(): string | null {
  try {
    if (localStorage.getItem(GUIDELINES_KEY) !== '1') return null;
    return localStorage.getItem(`${GUIDELINES_KEY}:version`) || GUIDELINES_VERSION;
  } catch {
    return null;
  }
}

function kudosRateOk(): boolean {
  try {
    const raw = localStorage.getItem(KUDOS_RATE_KEY);
    const stamps: number[] = raw ? (JSON.parse(raw) as number[]) : [];
    const hourAgo = Date.now() - 60 * 60 * 1000;
    const recent = stamps.filter((t) => t > hourAgo);
    if (recent.length >= KUDOS_MAX_PER_HOUR) return false;
    recent.push(Date.now());
    localStorage.setItem(KUDOS_RATE_KEY, JSON.stringify(recent));
    return true;
  } catch {
    return true;
  }
}

export async function reportRoomMessage(
  db: Firestore,
  roomId: string,
  input: {
    reporterId: string;
    messageId: string;
    reason: ReportReason;
    note?: string;
  },
): Promise<void> {
  const note = (input.note ?? '').trim().slice(0, 280);
  await addDoc(collection(db, 'rooms', roomId, 'reports'), {
    reporterId: input.reporterId,
    messageId: input.messageId,
    reason: input.reason,
    note,
    createdAt: serverTimestamp(),
  });
}

export async function sendKudos(
  db: Firestore,
  roomId: string,
  input: { fromUserId: string; toUserId: string; kind: KudosKind },
): Promise<void> {
  if (input.fromUserId === input.toUserId) {
    throw new Error('Cannot send kudos to yourself');
  }
  if (!kudosRateOk()) {
    throw new Error('Kudos rate limit reached — try again later');
  }
  await addDoc(collection(db, 'rooms', roomId, 'kudos'), {
    fromUserId: input.fromUserId,
    toUserId: input.toUserId,
    kind: input.kind,
    createdAt: serverTimestamp(),
  });
}

export type StudyCircle = {
  id: string;
  name: string;
  topic: string;
  ownerId: string;
  memberEmails: string[];
  purpose: 'learning';
  createdAt?: unknown;
};

export async function createStudyCircle(
  db: Firestore,
  input: { name: string; topic: string; ownerId: string; ownerEmail: string },
): Promise<string> {
  const name = input.name.trim().slice(0, 80);
  const topic = input.topic.trim().slice(0, 120);
  if (!name) throw new Error('Circle name is required');
  const ownerEmail = normalizeEmail(input.ownerEmail);
  if (!isValidInviteEmail(ownerEmail)) {
    throw new Error('A verified Google email is required');
  }

  const circleRef = doc(collection(db, 'studyCircles'));
  const roomId = circleCollabRoomId(circleRef.id);
  const batch = writeBatch(db);
  batch.set(circleRef, {
    name,
    topic,
    ownerId: input.ownerId,
    memberEmails: [ownerEmail],
    purpose: 'learning',
    createdAt: serverTimestamp(),
  });
  // Mirror invite ACL onto the linked Collab room so classmates can join the private link.
  batch.set(doc(db, 'rooms', roomId), {
    ownerId: input.ownerId,
    memberEmails: [ownerEmail],
    createdAt: serverTimestamp(),
  });
  await batch.commit();
  return circleRef.id;
}

export async function listMyStudyCircles(
  db: Firestore,
  email: string,
): Promise<StudyCircle[]> {
  const normalized = normalizeEmail(email);
  const q = query(
    collection(db, 'studyCircles'),
    where('memberEmails', 'array-contains', normalized),
    limit(40),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<StudyCircle, 'id'>) }));
}

export async function inviteToStudyCircle(
  db: Firestore,
  circleId: string,
  email: string,
  memberEmails: string[],
  ownerId: string,
): Promise<string[]> {
  const invitee = normalizeEmail(email);
  if (!isValidInviteEmail(invitee)) {
    throw new Error('Enter a valid email address');
  }
  const next = Array.from(
    new Set([...memberEmails.map(normalizeEmail), invitee]),
  ).slice(0, 40);

  const roomId = circleCollabRoomId(circleId);
  const roomRef = doc(db, 'rooms', roomId);
  const roomSnap = await getDoc(roomRef);

  // Preserve createdAt/name/topic — only expand the invite allow-list.
  await updateDoc(doc(db, 'studyCircles', circleId), { memberEmails: next });

  if (roomSnap.exists()) {
    await updateDoc(roomRef, { memberEmails: next });
  } else {
    await setDoc(roomRef, {
      ownerId,
      memberEmails: next,
      createdAt: serverTimestamp(),
    });
  }
  return next;
}
