/**
 * Audited Google Meet/Forms creation linked to room/class ids.
 */
import type { Request, Response } from 'express';
import { getAdminFirestore } from '../firebaseAdmin.js';
import { getAuthUser } from './authz.js';

export async function recordWorkspaceAudit(event: {
  action: 'MEET_CREATED' | 'FORM_CREATED';
  actorUid: string | null;
  roomId?: string | null;
  classId?: string | null;
  resourceId?: string | null;
  resourceUrl?: string | null;
  fallback: boolean;
  demo?: boolean;
}): Promise<void> {
  const db = await getAdminFirestore();
  const row = {
    ...event,
    at: new Date().toISOString(),
    category: 'google_workspace',
  };
  if (db) {
    await db.collection('platform_audit').add(row);
  }
}

/** Enrich Meet handler response with audit — call after creating URL. */
export async function auditMeetFromRequest(
  req: Request,
  res: Response,
  result: { meetUrl: string; fallback: boolean },
): Promise<void> {
  const uid = (res.locals.user as { uid?: string } | undefined)?.uid ?? null;
  const roomId = typeof req.body?.roomId === 'string' ? req.body.roomId.slice(0, 128) : null;
  const classId = typeof req.body?.classId === 'string' ? req.body.classId.slice(0, 128) : null;
  const demo = Boolean(req.body?.demo);
  await recordWorkspaceAudit({
    action: 'MEET_CREATED',
    actorUid: uid,
    roomId,
    classId,
    resourceUrl: result.meetUrl,
    fallback: result.fallback,
    demo,
  });
}

export async function auditFormFromRequest(
  req: Request,
  res: Response,
  result: { formId?: string | null; editUrl?: string | null; fallback: boolean },
): Promise<void> {
  const uid = (res.locals.user as { uid?: string } | undefined)?.uid ?? null;
  const roomId = typeof req.body?.roomId === 'string' ? req.body.roomId.slice(0, 128) : null;
  const classId = typeof req.body?.classId === 'string' ? req.body.classId.slice(0, 128) : null;
  await recordWorkspaceAudit({
    action: 'FORM_CREATED',
    actorUid: uid ?? (getAuthUserSafe(res)),
    roomId,
    classId,
    resourceId: result.formId ?? null,
    resourceUrl: result.editUrl ?? null,
    fallback: result.fallback,
  });
}

function getAuthUserSafe(res: Response): string | null {
  try {
    return getAuthUser(res).uid;
  } catch {
    return null;
  }
}
