/**
 * Server social spine — unified reports, triage taxonomy, Collab/Circle Meet dual-consent.
 */
import type { Request, Response } from 'express';
import { getAdminFirestore } from '../firebaseAdmin.js';
import {
  claimEmail,
  evaluateRoomAccess,
  getAuthUser,
  requireRole,
} from './authz.js';
import { HttpError } from './security.js';
import { validateObject } from './requestSpine.js';

export const SOCIAL_SURFACES = ['match', 'circles', 'collab'] as const;
export type SocialSurface = (typeof SOCIAL_SURFACES)[number];

export const REPORT_REASONS = [
  'harassment',
  'hate',
  'spam',
  'off_topic',
  'privacy',
  'other',
] as const;

export const TRIAGE_ACTIONS = [
  'dismiss',
  'warn',
  'cooldown_1h',
  'cooldown_24h',
  'ban_surface',
] as const;

export type TriageAction = (typeof TRIAGE_ACTIONS)[number];

export const MEET_MIN_CONSENTS = 2;

export function meetDualConsentSatisfied(
  meetConsent: Record<string, boolean> | undefined | null,
  requiredMemberIds?: string[],
): boolean {
  const map = meetConsent ?? {};
  if (requiredMemberIds?.length) {
    return requiredMemberIds.every((id) => map[id] === true);
  }
  return Object.values(map).filter(Boolean).length >= MEET_MIN_CONSENTS;
}

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

type SocialReport = {
  id: string;
  surface: SocialSurface;
  reporterId: string;
  targetId: string;
  reason: string;
  note: string;
  roomId: string | null;
  sessionId: string | null;
  status: 'open' | 'triaging' | 'dismissed' | 'actioned';
  triageAction: TriageAction | null;
  createdAt: string;
  updatedAt: string;
};

type CooldownEntry = {
  uid: string;
  surface: SocialSurface;
  until: string;
  action: TriageAction;
};

const memoryReports: SocialReport[] = [];
const memoryCooldowns = new Map<string, CooldownEntry>();

function cooldownKey(uid: string, surface: SocialSurface): string {
  return `${surface}:${uid}`;
}

export function isUserOnCooldown(uid: string, surface: SocialSurface, now = Date.now()): boolean {
  const entry = memoryCooldowns.get(cooldownKey(uid, surface));
  if (!entry) return false;
  return new Date(entry.until).getTime() > now;
}

async function assertRoomMember(req: Request, res: Response, roomId: string): Promise<{ uid: string }> {
  const user = getAuthUser(res);
  const email = claimEmail(user);
  const db = await getAdminFirestore();
  const access = await evaluateRoomAccess({
    db,
    roomId,
    uid: user.uid,
    email,
    requireAuth: true,
  });
  if (!access.allowed) {
    throw new HttpError(403, 'Not a member of this room');
  }
  return { uid: user.uid };
}

/**
 * POST /api/social/report
 * Unified report intake for Match / Circles / Collab.
 */
export async function socialReportHandler(req: Request, res: Response): Promise<void> {
  const user = getAuthUser(res);
  const body = validateObject(req.body, {
    surface: { type: 'string', required: true, enum: [...SOCIAL_SURFACES] },
    targetId: { type: 'string', required: true, maxLength: 128 },
    reason: { type: 'string', required: true, enum: [...REPORT_REASONS] },
    note: { type: 'string', maxLength: 280 },
    roomId: { type: 'string', maxLength: 128 },
    sessionId: { type: 'string', maxLength: 128 },
  });

  const surface = body.surface as SocialSurface;
  if (isUserOnCooldown(user.uid, surface)) {
    throw new HttpError(429, 'You are temporarily restricted from this surface');
  }

  const roomId = body.roomId ? String(body.roomId) : null;
  if (roomId) {
    await assertRoomMember(req, res, roomId);
  }

  const now = new Date().toISOString();
  const report: SocialReport = {
    id: `sr_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    surface,
    reporterId: user.uid,
    targetId: String(body.targetId),
    reason: String(body.reason),
    note: body.note ? String(body.note).trim() : '',
    roomId,
    sessionId: body.sessionId ? String(body.sessionId) : null,
    status: 'open',
    triageAction: null,
    createdAt: now,
    updatedAt: now,
  };

  memoryReports.unshift(report);
  if (memoryReports.length > 500) memoryReports.length = 500;

  const db = await getAdminFirestore();
  if (db) {
    await db.collection('platformSocialReports').doc(report.id).set({
      ...report,
      expireAt: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000),
    });
    if (roomId) {
      await db.collection('rooms').doc(roomId).collection('reports').add({
        reporterId: user.uid,
        messageId: report.targetId,
        reason: report.reason,
        note: report.note,
        surface,
        socialReportId: report.id,
        createdAt: new Date(),
      });
    }
  }

  res.status(201).json({ ok: true, reportId: report.id, persisted: Boolean(db) });
}

/**
 * GET /api/admin/social-reports
 */
export async function listSocialReportsHandler(req: Request, res: Response): Promise<void> {
  const user = getAuthUser(res);
  requireRole(user, ['admin', 'instructor']);

  const status = String(req.query.status ?? 'open');
  const limit = Math.min(Number(req.query.limit) || 50, 200);
  const db = await getAdminFirestore();

  if (db) {
    let q = db.collection('platformSocialReports').orderBy('createdAt', 'desc').limit(limit);
    if (status !== 'all') {
      q = db
        .collection('platformSocialReports')
        .where('status', '==', status)
        .orderBy('createdAt', 'desc')
        .limit(limit);
    }
    try {
      const snap = await q.get();
      res.json({
        reports: snap.docs.map((d) => ({ id: d.id, ...d.data() })),
        backend: 'firestore',
      });
      return;
    } catch {
      // Missing composite index — fall through to memory
    }
  }

  const filtered =
    status === 'all'
      ? memoryReports
      : memoryReports.filter((r) => r.status === status);
  res.json({
    reports: filtered.slice(0, limit),
    backend: db ? 'memory-fallback' : 'memory',
  });
}

/**
 * PATCH /api/admin/social-reports/:reportId
 * Body: { action: TriageAction, note?: string }
 */
export async function triageSocialReportHandler(req: Request, res: Response): Promise<void> {
  const user = getAuthUser(res);
  requireRole(user, ['admin', 'instructor']);

  const reportId = String(req.params.reportId ?? '');
  if (!reportId) throw new HttpError(400, 'reportId required');

  const body = validateObject(req.body, {
    action: { type: 'string', required: true, enum: [...TRIAGE_ACTIONS] },
    note: { type: 'string', maxLength: 280 },
  });
  const action = body.action as TriageAction;
  const now = new Date().toISOString();

  let report = memoryReports.find((r) => r.id === reportId);
  const db = await getAdminFirestore();
  if (!report && db) {
    const snap = await db.collection('platformSocialReports').doc(reportId).get();
    if (snap.exists) {
      report = { id: snap.id, ...(snap.data() as Omit<SocialReport, 'id'>) };
    }
  }
  if (!report) throw new HttpError(404, 'Report not found');

  const nextStatus = action === 'dismiss' ? 'dismissed' : 'actioned';
  report = {
    ...report,
    status: nextStatus,
    triageAction: action,
    updatedAt: now,
  };

  const idx = memoryReports.findIndex((r) => r.id === reportId);
  if (idx >= 0) memoryReports[idx] = report;

  const ms = cooldownMsForAction(action);
  if (ms > 0 && report.targetId) {
    const entry: CooldownEntry = {
      uid: report.targetId,
      surface: report.surface,
      until: new Date(Date.now() + ms).toISOString(),
      action,
    };
    memoryCooldowns.set(cooldownKey(report.targetId, report.surface), entry);
    if (db) {
      await db.collection('socialCooldowns').doc(cooldownKey(report.targetId, report.surface)).set({
        ...entry,
        setBy: user.uid,
        reportId,
        updatedAt: now,
      });
    }
  }

  if (db) {
    await db.collection('platformSocialReports').doc(reportId).set(
      {
        status: report.status,
        triageAction: action,
        triageNote: body.note ? String(body.note) : '',
        triagedBy: user.uid,
        updatedAt: now,
      },
      { merge: true },
    );
  }

  res.json({ ok: true, report });
}

/**
 * POST /api/social/rooms/:roomId/meet-consent
 * Body: { consent: boolean }
 */
export async function roomMeetConsentHandler(req: Request, res: Response): Promise<void> {
  const { uid } = await assertRoomMember(req, res, String(req.params.roomId ?? ''));
  const roomId = String(req.params.roomId ?? '');
  const consent = Boolean(req.body?.consent);
  const db = await getAdminFirestore();
  if (!db) {
    // Preview without Admin: client updates Firestore directly; echo ack.
    res.json({ ok: true, roomId, uid, consent, meetConsent: { [uid]: consent }, backend: 'client' });
    return;
  }

  const ref = db.collection('rooms').doc(roomId);
  const snap = await ref.get();
  const data = (snap.data() ?? {}) as { meetConsent?: Record<string, boolean>; meetUrl?: string };
  const meetConsent = { ...(data.meetConsent ?? {}), [uid]: consent };
  await ref.set({ meetConsent }, { merge: true });
  res.json({
    ok: true,
    roomId,
    uid,
    consent,
    meetConsent,
    dualOk: meetDualConsentSatisfied(meetConsent),
    meetUrl: data.meetUrl ?? null,
    backend: 'firestore',
  });
}

/**
 * POST /api/social/rooms/:roomId/meet
 * Dual-consent gate before creating/returning Meet URL.
 */
export async function roomCreateMeetHandler(req: Request, res: Response): Promise<void> {
  const { uid } = await assertRoomMember(req, res, String(req.params.roomId ?? ''));
  const roomId = String(req.params.roomId ?? '');
  const db = await getAdminFirestore();

  let meetConsent: Record<string, boolean> = {};
  let existingUrl: string | null = null;

  if (db) {
    const snap = await db.collection('rooms').doc(roomId).get();
    const data = (snap.data() ?? {}) as {
      meetConsent?: Record<string, boolean>;
      meetUrl?: string;
    };
    meetConsent = data.meetConsent ?? {};
    existingUrl = data.meetUrl ?? null;
  } else {
    // Without Admin, trust client-supplied snapshot for dual check (demo/preview).
    const clientMap = req.body?.meetConsent;
    if (clientMap && typeof clientMap === 'object') {
      meetConsent = clientMap as Record<string, boolean>;
    }
    meetConsent[uid] = true;
  }

  if (!meetDualConsentSatisfied(meetConsent)) {
    throw new HttpError(403, 'At least two room members must opt in before starting Meet');
  }

  if (existingUrl) {
    res.json({ meetUrl: existingUrl, fallback: false, meetConsent });
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
      /* fallback */
    }
  }

  if (db) {
    await db.collection('rooms').doc(roomId).set({ meetUrl, meetConsent }, { merge: true });
  }

  res.json({ meetUrl, fallback, meetConsent, dualOk: true });
}

/** Test helper — clear memory stores. */
export function __resetSocialPolicyMemoryForTests(): void {
  memoryReports.length = 0;
  memoryCooldowns.clear();
}
