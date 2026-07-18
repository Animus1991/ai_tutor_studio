/**
 * Session revocation + device trust spine.
 * JWT signature alone is insufficient after logout-all / compromise.
 */
import type { Request, Response } from 'express';
import type { JWTPayload } from 'jose';
import { getAdminFirestore } from '../firebaseAdmin.js';
import { getAuthUser } from './authz.js';
import { HttpError } from './security.js';
import { validateObject } from './requestSpine.js';

/** In-memory floor: uid → earliest acceptable auth_time (unix seconds). */
const memoryAuthTimeFloor = new Map<string, number>();
/** deviceId → { uid, label, trustedAt } */
const memoryTrustedDevices = new Map<string, { uid: string; label: string; trustedAt: string }>();

export type SessionTrustClaims = JWTPayload & {
  auth_time?: number;
  device_id?: string;
  trusted_device?: boolean;
};

export async function getAuthTimeFloor(uid: string): Promise<number | null> {
  const mem = memoryAuthTimeFloor.get(uid);
  const db = await getAdminFirestore();
  if (!db) return mem ?? null;
  try {
    const snap = await db.collection('revokedSessions').doc(uid).get();
    if (!snap.exists) return mem ?? null;
    const floor = Number(snap.data()?.authTimeFloor ?? 0);
    if (!Number.isFinite(floor) || floor <= 0) return mem ?? null;
    if (mem && mem > floor) return mem;
    return floor;
  } catch {
    return mem ?? null;
  }
}

/** Reject tokens issued before the user's revocation floor. */
export async function assertSessionNotRevoked(
  uid: string,
  claims: SessionTrustClaims,
): Promise<void> {
  const floor = await getAuthTimeFloor(uid);
  if (!floor) return;
  const authTime = Number(claims.auth_time ?? 0);
  // If auth_time missing, fall back to iat
  const issued = authTime > 0 ? authTime : Number(claims.iat ?? 0);
  if (issued > 0 && issued < floor) {
    throw new HttpError(401, 'Session revoked — sign in again');
  }
}

/**
 * Optional device trust: when TRUST_DEVICES=true, require a registered device.
 * Accepts Firebase custom claim `device_id` OR explicit `X-Device-Id` header
 * (clients register via POST /api/auth/trusted-devices).
 */
export async function assertDeviceTrusted(
  uid: string,
  claims: SessionTrustClaims,
  headerDeviceId?: string | null,
): Promise<void> {
  if (process.env.TRUST_DEVICES !== 'true') return;
  const deviceId = String(claims.device_id ?? headerDeviceId ?? '')
    .trim()
    .slice(0, 128);
  if (!deviceId) {
    throw new HttpError(403, 'Trusted device required');
  }
  const mem = memoryTrustedDevices.get(deviceId);
  if (mem?.uid === uid) return;
  const db = await getAdminFirestore();
  if (!db) {
    // Memory-only mode: registration in this process is enough.
    throw new HttpError(403, 'Device not trusted');
  }
  const snap = await db.collection('trustedDevices').doc(deviceId).get();
  if (!snap.exists || snap.data()?.uid !== uid) {
    throw new HttpError(403, 'Device not trusted');
  }
}

/** POST /api/auth/revoke-sessions — invalidate tokens before now for this user. */
export async function revokeSessionsHandler(req: Request, res: Response): Promise<void> {
  const user = getAuthUser(res);
  const floor = Math.floor(Date.now() / 1000);
  const clearDevices = req.body?.clearTrustedDevices === true;
  memoryAuthTimeFloor.set(user.uid, floor);

  let devicesCleared = 0;
  if (clearDevices) {
    for (const [deviceId, row] of [...memoryTrustedDevices.entries()]) {
      if (row.uid === user.uid) {
        memoryTrustedDevices.delete(deviceId);
        devicesCleared += 1;
      }
    }
  }

  const db = await getAdminFirestore();
  if (db) {
    await db.collection('revokedSessions').doc(user.uid).set(
      {
        uid: user.uid,
        authTimeFloor: floor,
        revokedAt: new Date().toISOString(),
        reason: String(req.body?.reason ?? 'user_request').slice(0, 200),
        clearTrustedDevices: clearDevices,
      },
      { merge: true },
    );
    if (clearDevices) {
      const snap = await db.collection('trustedDevices').where('uid', '==', user.uid).get();
      const batch = db.batch();
      snap.docs.forEach((d) => batch.delete(d.ref));
      if (!snap.empty) await batch.commit();
      devicesCleared = Math.max(devicesCleared, snap.size);
    }
    await db.collection('platform_audit').add({
      category: 'session_trust',
      action: 'SESSIONS_REVOKED',
      actorUid: user.uid,
      authTimeFloor: floor,
      devicesCleared,
      at: new Date().toISOString(),
    });
  }
  res.json({
    ok: true,
    authTimeFloor: floor,
    devicesCleared,
    note: 'Existing ID tokens with earlier auth_time are rejected. Sign in again.',
  });
}

/** POST /api/auth/trusted-devices — register current device id (explicit UX). */
export async function registerTrustedDeviceHandler(req: Request, res: Response): Promise<void> {
  const user = getAuthUser(res);
  const body = validateObject(req.body, {
    deviceId: { type: 'string', required: true, maxLength: 128 },
    label: { type: 'string', maxLength: 80 },
  });
  const deviceId = String(body.deviceId).trim();
  const label = body.label ? String(body.label).trim() : 'device';
  const row = { uid: user.uid, label, trustedAt: new Date().toISOString() };
  memoryTrustedDevices.set(deviceId, row);
  const db = await getAdminFirestore();
  if (db) {
    await db.collection('trustedDevices').doc(deviceId).set({ ...row, deviceId }, { merge: true });
    await db.collection('platform_audit').add({
      category: 'session_trust',
      action: 'DEVICE_TRUSTED',
      actorUid: user.uid,
      deviceId,
      at: row.trustedAt,
    });
  }
  res.json({ ok: true, deviceId, label, durable: Boolean(db) });
}

/** GET /api/auth/trusted-devices — list devices for this uid */
export async function listTrustedDevicesHandler(_req: Request, res: Response): Promise<void> {
  const user = getAuthUser(res);
  const fromMemory = [...memoryTrustedDevices.entries()]
    .filter(([, row]) => row.uid === user.uid)
    .map(([deviceId, row]) => ({ deviceId, ...row }));

  const db = await getAdminFirestore();
  if (!db) {
    res.json({ devices: fromMemory, backend: 'memory' });
    return;
  }
  const snap = await db.collection('trustedDevices').where('uid', '==', user.uid).limit(50).get();
  const devices = snap.docs.map((d) => {
    const data = d.data();
    return {
      deviceId: String(data.deviceId ?? d.id),
      uid: String(data.uid ?? user.uid),
      label: String(data.label ?? 'device'),
      trustedAt: String(data.trustedAt ?? ''),
    };
  });
  res.json({ devices: devices.length ? devices : fromMemory, backend: 'firestore' });
}

/** DELETE /api/auth/trusted-devices/:deviceId */
export async function revokeTrustedDeviceHandler(req: Request, res: Response): Promise<void> {
  const user = getAuthUser(res);
  const deviceId = String(req.params.deviceId ?? '').trim().slice(0, 128);
  if (!deviceId) throw new HttpError(400, 'deviceId required');

  const mem = memoryTrustedDevices.get(deviceId);
  if (mem && mem.uid !== user.uid) throw new HttpError(403, 'Not your device');
  memoryTrustedDevices.delete(deviceId);

  const db = await getAdminFirestore();
  if (db) {
    const ref = db.collection('trustedDevices').doc(deviceId);
    const snap = await ref.get();
    if (snap.exists && snap.data()?.uid !== user.uid) {
      throw new HttpError(403, 'Not your device');
    }
    if (snap.exists) await ref.delete();
    await db.collection('platform_audit').add({
      category: 'session_trust',
      action: 'DEVICE_REVOKED',
      actorUid: user.uid,
      deviceId,
      at: new Date().toISOString(),
    });
  }
  res.json({ ok: true, deviceId });
}

export function __resetSessionTrustForTests(): void {
  memoryAuthTimeFloor.clear();
  memoryTrustedDevices.clear();
}
