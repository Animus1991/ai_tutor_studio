import { describe, expect, it } from 'vitest';
import { firestoreRoomIdFromYjsDoc, evaluateRoomAccess } from './authz';

describe('authz room mapping', () => {
  it('strips memora-collab prefix for Firestore room ids', () => {
    expect(firestoreRoomIdFromYjsDoc('/memora-collab-abc12345')).toBe('abc12345');
    expect(firestoreRoomIdFromYjsDoc('memora-collab-circle-xyz')).toBe('circle-xyz');
    expect(firestoreRoomIdFromYjsDoc('match-ms_deadbeef')).toBe('match-ms_deadbeef');
  });

  it('allows authenticated users when Admin SDK is unavailable', async () => {
    const r = await evaluateRoomAccess({
      db: null,
      roomId: 'room-12345678',
      uid: 'u1',
      email: 'a@uni.edu',
      requireAuth: true,
    });
    expect(r.allowed).toBe(true);
    if (r.allowed) expect(r.reason).toBe('no_admin');
  });

  it('rejects anonymous when auth is required', async () => {
    const r = await evaluateRoomAccess({
      db: null,
      roomId: 'room-12345678',
      uid: null,
      email: null,
      requireAuth: true,
    });
    expect(r).toEqual({ allowed: false, reason: 'unauthenticated' });
  });

  it('allows anonymous only when auth is optional', async () => {
    const r = await evaluateRoomAccess({
      db: null,
      roomId: 'room-12345678',
      uid: null,
      email: null,
      requireAuth: false,
    });
    expect(r).toEqual({ allowed: true, reason: 'auth_optional' });
  });

  it('rejects missing room docs when auth is required (invite allow-list)', async () => {
    const fakeDb = {
      collection: () => ({
        doc: () => ({
          get: async () => ({ exists: false, data: () => undefined }),
        }),
      }),
    } as never;
    const r = await evaluateRoomAccess({
      db: fakeDb,
      roomId: 'room-12345678',
      uid: 'u1',
      email: 'a@uni.edu',
      requireAuth: true,
    });
    expect(r).toEqual({ allowed: false, reason: 'not_member' });
  });
});
