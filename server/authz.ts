/**
 * Platform authZ helpers — room/session membership, claim email, role checks.
 */
import type { Response } from 'express';
import type { Firestore } from 'firebase-admin/firestore';
import { HttpError } from './security.js';

export type AuthUser = { uid: string; claims?: Record<string, unknown> };

export function getAuthUser(res: Response): AuthUser {
  const user = res.locals.user as AuthUser | undefined;
  if (!user?.uid) {
    throw new HttpError(401, 'Authentication required');
  }
  return user;
}

export function claimEmail(user: AuthUser): string {
  const email = String(user.claims?.email ?? '')
    .trim()
    .toLowerCase();
  if (!email || !email.includes('@')) {
    throw new HttpError(403, 'A verified email is required');
  }
  if (user.claims?.email_verified === false) {
    throw new HttpError(403, 'Verify your email before continuing');
  }
  return email;
}

export function claimRole(user: AuthUser): 'student' | 'instructor' | 'admin' {
  const role = String(user.claims?.role ?? 'student').toLowerCase();
  if (role === 'admin' || role === 'instructor') return role;
  return 'student';
}

export function requireRole(user: AuthUser, allowed: Array<'student' | 'instructor' | 'admin'>): void {
  const role = claimRole(user);
  if (!allowed.includes(role) && role !== 'admin') {
    throw new HttpError(403, 'Insufficient role for this action');
  }
}

/**
 * Map Yjs document name → Firestore `rooms/{id}`.
 * Collab clients use `memora-collab-{roomId}`; Match/Circles use the room id directly.
 */
export function firestoreRoomIdFromYjsDoc(docName: string): string {
  const raw = docName.replace(/^\/+/, '').trim();
  if (raw.startsWith('memora-collab-')) {
    return raw.slice('memora-collab-'.length).slice(0, 128);
  }
  return raw.slice(0, 128);
}

export type RoomAccessResult =
  | { allowed: true; reason: 'owner' | 'member' | 'new_room' | 'no_admin' | 'auth_optional' }
  | { allowed: false; reason: 'unauthenticated' | 'not_member' | 'invalid_room' };

export async function evaluateRoomAccess(input: {
  db: Firestore | null;
  roomId: string;
  uid: string | null;
  email: string | null;
  /** When true, anonymous access is rejected. */
  requireAuth: boolean;
}): Promise<RoomAccessResult> {
  const roomId = input.roomId.trim();
  if (!roomId || roomId.length < 8) {
    return { allowed: false, reason: 'invalid_room' };
  }
  if (!input.uid) {
    return input.requireAuth
      ? { allowed: false, reason: 'unauthenticated' }
      : { allowed: true, reason: 'auth_optional' };
  }
  if (!input.db) {
    // Preview / single-node without Admin SDK: authenticated users may connect.
    return { allowed: true, reason: 'no_admin' };
  }

  const snap = await input.db.collection('rooms').doc(roomId).get();
  if (!snap.exists) {
    // Under REQUIRE_API_AUTH, room + invite allow-list must exist before Yjs join.
    // Soft/preview mode still allows first-joiner bootstrap.
    if (input.requireAuth) {
      return { allowed: false, reason: 'not_member' };
    }
    return { allowed: true, reason: 'new_room' };
  }
  const data = snap.data() as {
    ownerId?: string;
    memberEmails?: unknown;
  };
  if (data.ownerId === input.uid) {
    return { allowed: true, reason: 'owner' };
  }
  const emails = Array.isArray(data.memberEmails)
    ? data.memberEmails.map((e) => String(e).trim().toLowerCase())
    : [];
  if (input.email && emails.includes(input.email)) {
    return { allowed: true, reason: 'member' };
  }
  return { allowed: false, reason: 'not_member' };
}

export async function assertRoomMember(
  db: Firestore | null,
  roomId: string,
  user: AuthUser,
): Promise<void> {
  const email = claimEmail(user);
  const access = await evaluateRoomAccess({
    db,
    roomId,
    uid: user.uid,
    email,
    requireAuth: true,
  });
  if (!access.allowed) {
    throw new HttpError(403, 'You are not a member of this room');
  }
}
