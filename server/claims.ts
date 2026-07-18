/**
 * Custom claims assignment + break-glass two-person rule stub.
 * Admin SDK setCustomUserClaims — never UI-only roles.
 */
import type { Request, Response } from 'express';
import { getAdminFirestore } from '../firebaseAdmin.js';
import { getAuthUser, requireRole } from './authz.js';
import { HttpError } from './security.js';
import { validateObject } from './requestSpine.js';

const ROLES = ['student', 'instructor', 'admin'] as const;
type ClaimRole = (typeof ROLES)[number];

type BreakGlassRequest = {
  id: string;
  targetUid: string;
  role: ClaimRole;
  reason: string;
  requestedBy: string;
  requestedAt: string;
  approvedBy: string | null;
  approvedAt: string | null;
  status: 'pending' | 'approved' | 'rejected' | 'applied';
};

const memoryBreakGlass: BreakGlassRequest[] = [];

/** Two-person rule: approver must be a different admin than the requester. */
export function assertBreakGlassApprover(requestedBy: string, approverUid: string): void {
  if (!requestedBy || !approverUid) {
    throw new HttpError(400, 'requester and approver required');
  }
  if (requestedBy === approverUid) {
    throw new HttpError(403, 'Two-person rule: requester cannot approve their own request');
  }
}

async function getAdminAuth() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) return null;
  try {
    const { initializeApp, cert, getApps } = await import('firebase-admin/app');
    const { getAuth } = await import('firebase-admin/auth');
    if (getApps().length === 0) {
      initializeApp({ credential: cert(JSON.parse(raw)) });
    }
    return getAuth();
  } catch {
    return null;
  }
}

async function auditClaim(event: Record<string, unknown>): Promise<void> {
  const db = await getAdminFirestore();
  if (!db) return;
  await db.collection('platform_audit').add({
    ...event,
    at: new Date().toISOString(),
    category: 'claims',
  });
}

/**
 * POST /api/admin/claims
 * Body: { uid, role, reason? }
 * When BREAK_GLASS_REQUIRED=true → pending two-person approval.
 */
export async function assignClaimHandler(req: Request, res: Response): Promise<void> {
  const actor = getAuthUser(res);
  requireRole(actor, ['admin']);

  const body = validateObject(req.body, {
    uid: { type: 'string', required: true, maxLength: 128 },
    role: { type: 'string', required: true, enum: [...ROLES] },
    reason: { type: 'string', maxLength: 500 },
  });

  const targetUid = String(body.uid);
  const role = body.role as ClaimRole;
  const reason = body.reason ? String(body.reason) : '';

  if (process.env.BREAK_GLASS_REQUIRED === 'true') {
    const reqRow: BreakGlassRequest = {
      id: `bg_${Date.now().toString(36)}`,
      targetUid,
      role,
      reason,
      requestedBy: actor.uid,
      requestedAt: new Date().toISOString(),
      approvedBy: null,
      approvedAt: null,
      status: 'pending',
    };
    memoryBreakGlass.unshift(reqRow);
    const db = await getAdminFirestore();
    if (db) {
      await db.collection('breakGlassRequests').doc(reqRow.id).set(reqRow);
    }
    await auditClaim({
      action: 'CLAIM_BREAK_GLASS_REQUESTED',
      actorUid: actor.uid,
      targetUid,
      role,
      requestId: reqRow.id,
    });
    res.status(202).json({
      ok: true,
      mode: 'break_glass',
      request: reqRow,
      note: 'Second admin must approve via POST /api/admin/break-glass/:id/approve',
    });
    return;
  }

  const auth = await getAdminAuth();
  if (!auth) {
    throw new HttpError(503, 'FIREBASE_SERVICE_ACCOUNT_JSON required to assign claims');
  }

  const user = await auth.getUser(targetUid);
  const nextClaims = { ...(user.customClaims ?? {}), role };
  await auth.setCustomUserClaims(targetUid, nextClaims);
  await auditClaim({
    action: 'CLAIM_ASSIGNED',
    actorUid: actor.uid,
    targetUid,
    role,
    reason,
  });

  res.json({
    ok: true,
    mode: 'direct',
    uid: targetUid,
    role,
    note: 'User must refresh ID token to see new role.',
  });
}

/** GET /api/admin/break-glass */
export async function listBreakGlassHandler(_req: Request, res: Response): Promise<void> {
  const actor = getAuthUser(res);
  requireRole(actor, ['admin']);
  const db = await getAdminFirestore();
  if (db) {
    try {
      const snap = await db
        .collection('breakGlassRequests')
        .where('status', '==', 'pending')
        .limit(50)
        .get();
      res.json({ requests: snap.docs.map((d) => ({ id: d.id, ...d.data() })) });
      return;
    } catch {
      /* fall through */
    }
  }
  res.json({ requests: memoryBreakGlass.filter((r) => r.status === 'pending') });
}

/**
 * POST /api/admin/break-glass/:id/approve
 * Two-person rule: approver ≠ requester.
 */
export async function approveBreakGlassHandler(req: Request, res: Response): Promise<void> {
  const actor = getAuthUser(res);
  requireRole(actor, ['admin']);
  const id = String(req.params.id ?? '');
  if (!id) throw new HttpError(400, 'request id required');

  let row = memoryBreakGlass.find((r) => r.id === id);
  const db = await getAdminFirestore();
  if (!row && db) {
    const snap = await db.collection('breakGlassRequests').doc(id).get();
    if (snap.exists) row = { id: snap.id, ...(snap.data() as Omit<BreakGlassRequest, 'id'>) };
  }
  if (!row) throw new HttpError(404, 'Break-glass request not found');
  if (row.status !== 'pending') throw new HttpError(409, 'Request is not pending');
  assertBreakGlassApprover(row.requestedBy, actor.uid);

  const auth = await getAdminAuth();
  if (!auth) throw new HttpError(503, 'Admin Auth unavailable');

  const user = await auth.getUser(row.targetUid);
  await auth.setCustomUserClaims(user.uid, { ...(user.customClaims ?? {}), role: row.role });

  row = {
    ...row,
    status: 'applied',
    approvedBy: actor.uid,
    approvedAt: new Date().toISOString(),
  };
  const idx = memoryBreakGlass.findIndex((r) => r.id === id);
  if (idx >= 0) memoryBreakGlass[idx] = row;
  if (db) await db.collection('breakGlassRequests').doc(id).set(row, { merge: true });

  await auditClaim({
    action: 'CLAIM_BREAK_GLASS_APPLIED',
    actorUid: actor.uid,
    requesterUid: row.requestedBy,
    targetUid: row.targetUid,
    role: row.role,
    requestId: id,
  });

  res.json({ ok: true, request: row });
}

export function __resetClaimsMemoryForTests(): void {
  memoryBreakGlass.length = 0;
}
