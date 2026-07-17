/**
 * Server-authoritative learning events (bounded, no vanity gamification).
 * Complements client learningProfile localforage store.
 */
import type { Request, Response } from 'express';
import { getAdminFirestore } from '../firebaseAdmin.js';
import { getAuthUser } from './authz.js';
import { HttpError } from './security.js';
import { validateObject } from './requestSpine.js';

const KINDS = [
  'agent_turn',
  'task_review',
  'task_complete',
  'flashcard_review',
  'feynman_check',
  'focus_session',
  'rag_grounding',
] as const;

type LearningKind = (typeof KINDS)[number];

export async function postLearningEventHandler(req: Request, res: Response): Promise<void> {
  const user = getAuthUser(res);
  const body = validateObject(req.body, {
    kind: { type: 'string', required: true, enum: [...KINDS] },
    surface: { type: 'string', required: true, maxLength: 40 },
    domainKey: { type: 'string', maxLength: 120 },
    success: { type: 'boolean' },
    quality: { type: 'number', min: 0, max: 5 },
    mode: { type: 'string', maxLength: 40 },
    meta: { type: 'object' },
  });

  const kind = body.kind as LearningKind;
  const event = {
    uid: user.uid,
    kind,
    surface: String(body.surface),
    domainKey: body.domainKey ? String(body.domainKey) : null,
    success: typeof body.success === 'boolean' ? body.success : null,
    quality: typeof body.quality === 'number' ? body.quality : null,
    mode: body.mode ? String(body.mode) : null,
    meta: body.meta && typeof body.meta === 'object' ? body.meta : {},
    at: new Date().toISOString(),
  };

  const db = await getAdminFirestore();
  if (db) {
    const col = db.collection('userLearningEvents').doc(user.uid).collection('events');
    // Bound: keep only recent window via TTL field for ops jobs
    await col.add({
      ...event,
      expireAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
    });
  }

  res.status(202).json({
    ok: true,
    persisted: Boolean(db),
    event: { kind: event.kind, surface: event.surface, at: event.at },
  });
}

export async function getLearningSummaryHandler(_req: Request, res: Response): Promise<void> {
  const user = getAuthUser(res);
  const db = await getAdminFirestore();
  if (!db) {
    res.json({
      backend: 'none',
      counts: {},
      note: 'Admin SDK required for server learning summaries',
    });
    return;
  }

  const snap = await db
    .collection('userLearningEvents')
    .doc(user.uid)
    .collection('events')
    .orderBy('at', 'desc')
    .limit(200)
    .get()
    .catch(() => null);

  if (!snap) {
    throw new HttpError(500, 'Failed to read learning events');
  }

  const counts: Record<string, number> = {};
  for (const d of snap.docs) {
    const k = String(d.data().kind ?? 'unknown');
    counts[k] = (counts[k] ?? 0) + 1;
  }

  res.json({
    backend: 'firestore',
    counts,
    recent: snap.docs.slice(0, 20).map((d) => {
      const data = d.data();
      return {
        id: d.id,
        kind: data.kind,
        surface: data.surface,
        domainKey: data.domainKey,
        at: data.at,
      };
    }),
  });
}
