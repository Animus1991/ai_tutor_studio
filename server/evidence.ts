/**
 * Evidence spine — xAPI retention, research export, eval harness API.
 */
import type { Request, Response } from 'express';
import { createHash } from 'node:crypto';
import { getAdminFirestore } from '../firebaseAdmin.js';
import { getAuthUser, requireRole } from './authz.js';
import { HttpError } from './security.js';
import { validateObject } from './requestSpine.js';

export const XAPI_RETENTION_DAYS = 90;
export const XAPI_MAX_PER_USER = 2000;

function anonymizeActor(mbox: string, uid: string): string {
  const raw = `${uid}:${mbox}`;
  return `anon_${createHash('sha256').update(raw).digest('hex').slice(0, 16)}`;
}

function stripPiiFromStatement(statement: Record<string, unknown>, uid: string): Record<string, unknown> {
  const actor = (statement.actor ?? {}) as Record<string, unknown>;
  const mbox = String(actor.mbox ?? '');
  return {
    verb: statement.verb ?? null,
    object: statement.object ?? null,
    result: statement.result ?? null,
    timestamp: statement.timestamp ?? null,
    actor: { id: anonymizeActor(mbox, uid) },
  };
}

/**
 * Persist xAPI statement with TTL. Called from /api/xapi/statements.
 */
export async function persistXapiStatement(
  uid: string | null,
  statement: Record<string, unknown>,
): Promise<{ persisted: boolean; expireAt: string | null }> {
  const db = await getAdminFirestore();
  if (!db || !uid) {
    return { persisted: false, expireAt: null };
  }
  const expireAt = new Date(Date.now() + XAPI_RETENTION_DAYS * 24 * 60 * 60 * 1000);
  const col = db.collection('userXapi').doc(uid).collection('statements');
  await col.add({
    ...stripPiiFromStatement(statement, uid),
    rawVerbId: (statement.verb as { id?: string } | undefined)?.id ?? null,
    createdAt: new Date().toISOString(),
    expireAt,
  });

  // Soft bound: delete oldest beyond cap (best-effort)
  const snap = await col.orderBy('createdAt', 'desc').offset(XAPI_MAX_PER_USER).limit(50).get();
  if (!snap.empty) {
    const batch = db.batch();
    snap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }

  return { persisted: true, expireAt: expireAt.toISOString() };
}

/** POST body handler enrichment — returns JSON instead of empty 204 when ?meta=1 */
export async function xapiStatementsHandler(req: Request, res: Response): Promise<void> {
  const statement = req.body;
  if (!statement || typeof statement !== 'object') {
    throw new HttpError(400, 'xAPI statement object required');
  }

  const uid = (res.locals.user as { uid?: string } | undefined)?.uid ?? null;
  const persist = await persistXapiStatement(uid, statement as Record<string, unknown>);

  // Optional LRS forward (same as before)
  const lrsUrl = process.env.XAPI_LRS_ENDPOINT;
  const lrsKey = process.env.XAPI_LRS_KEY;
  if (lrsUrl && lrsKey) {
    const auth = Buffer.from(`${lrsKey}:`).toString('base64');
    const forward = await fetch(`${lrsUrl.replace(/\/$/, '')}/statements`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${auth}`,
        'X-Experience-API-Version': '1.0.3',
      },
      body: JSON.stringify(statement),
    });
    if (!forward.ok) {
      const detail = await forward.text();
      throw new HttpError(502, `LRS rejected statement: ${detail.slice(0, 200)}`);
    }
  }

  if (String(req.query.meta ?? '') === '1') {
    res.status(202).json({
      ok: true,
      ...persist,
      retentionDays: XAPI_RETENTION_DAYS,
    });
    return;
  }
  res.status(204).end();
}

/**
 * GET /api/research/export
 * Anonymized pedagogy events for researchers (no peer PII, hashed actor).
 */
export async function researchExportHandler(req: Request, res: Response): Promise<void> {
  const user = getAuthUser(res);
  // Self-export always allowed; bulk/admin export requires role
  const scope = String(req.query.scope ?? 'self');
  if (scope === 'tenant') {
    requireRole(user, ['admin', 'instructor']);
  }

  const db = await getAdminFirestore();
  const exportedAt = new Date().toISOString();
  const payload: Record<string, unknown> = {
    exportedAt,
    format: 'memora-research-v1',
    retentionPolicyDays: XAPI_RETENTION_DAYS,
    note: 'Anonymized pedagogy telemetry. No peer identities, emails, or Buddy maps.',
    subject: anonymizeActor(String(user.claims?.email ?? user.uid), user.uid),
    xapi: [] as unknown[],
    learningEvents: [] as unknown[],
    principlesRef: 'PRODUCT_BLUEPRINT.md §1',
  };

  if (!db) {
    payload.warning = 'Admin SDK unavailable — empty research export';
    res.json(payload);
    return;
  }

  const xapiSnap = await db
    .collection('userXapi')
    .doc(user.uid)
    .collection('statements')
    .orderBy('createdAt', 'desc')
    .limit(500)
    .get();
  payload.xapi = xapiSnap.docs.map((d) => {
    const data = d.data();
    return {
      verbId: data.rawVerbId ?? null,
      timestamp: data.timestamp ?? data.createdAt ?? null,
      objectType: (data.object as { definition?: { type?: string } } | undefined)?.definition?.type ?? null,
      success: (data.result as { success?: boolean } | undefined)?.success ?? null,
      score: (data.result as { score?: { scaled?: number } } | undefined)?.score?.scaled ?? null,
    };
  });

  const learnSnap = await db
    .collection('userLearningEvents')
    .doc(user.uid)
    .collection('events')
    .orderBy('at', 'desc')
    .limit(500)
    .get()
    .catch(() => null);

  if (learnSnap) {
    payload.learningEvents = learnSnap.docs.map((d) => {
      const data = d.data();
      return {
        kind: data.kind ?? null,
        surface: data.surface ?? null,
        domainKey: data.domainKey ?? null,
        success: data.success ?? null,
        quality: data.quality ?? null,
        at: data.at ?? null,
      };
    });
  }

  res.json(payload);
}

/**
 * POST /api/evidence/eval
 * Body: { answers: Record<string,string>, courseKey?, mode? }
 * Runs golden-question harness (imported dynamically from built client lib via duplicate server copy).
 */
export async function evidenceEvalHandler(req: Request, res: Response): Promise<void> {
  getAuthUser(res);
  const body = validateObject(req.body, {
    answers: { type: 'object', required: true },
    courseKey: { type: 'string', maxLength: 80 },
    mode: { type: 'string', maxLength: 40 },
  });

  // Inline minimal harness to avoid bundling path issues — mirrors src/lib/evidenceEval fixtures
  const { runEvalHarness, fixtureAnswersForCi } = await import('../src/lib/evidenceEval.js');
  const answers =
    body.answers && Object.keys(body.answers as object).length
      ? (body.answers as Record<string, string>)
      : fixtureAnswersForCi();

  const report = runEvalHarness(answers, {
    courseKey: body.courseKey ? String(body.courseKey) : undefined,
    // AgentModeId string — harness ignores unknown modes via filter equality
    mode: body.mode ? (String(body.mode) as 'socratic') : undefined,
  });
  res.json(report);
}

/** GET /api/evidence/principles */
export async function evidencePrinciplesHandler(_req: Request, res: Response): Promise<void> {
  const { EVIDENCE_PRINCIPLES } = await import('../src/lib/evidencePrinciples.js');
  res.json({ principles: EVIDENCE_PRINCIPLES, source: 'PRODUCT_BLUEPRINT.md §1' });
}

/**
 * POST /api/evidence/transfer
 * Body: { attempts: TransferAttempt[], controlFloor?, minN? }
 * Empty attempts → demo battery that is intentionally not causal-ready.
 */
export async function evidenceTransferHandler(req: Request, res: Response): Promise<void> {
  getAuthUser(res);
  const body = validateObject(req.body ?? {}, {
    attempts: { type: 'array', required: false },
    controlFloor: { type: 'number', required: false },
    minN: { type: 'number', required: false },
  });

  const {
    evaluateTransferBattery,
    defaultTransferItems,
  } = await import('../src/lib/transferTest.js');

  const attempts = Array.isArray(body.attempts) ? body.attempts : [];
  const items = defaultTransferItems();
  const demoAttempts =
    attempts.length > 0
      ? attempts
      : items.map((item) => ({
          itemId: item.id,
          answer: '',
          delayHours: 0,
          assistedStudy: true,
        }));

  const report = evaluateTransferBattery(demoAttempts as never, {
    controlFloor:
      typeof body.controlFloor === 'number' ? body.controlFloor : undefined,
    minN: typeof body.minN === 'number' ? body.minN : undefined,
  });
  res.json(report);
}

/** Shared xAPI TTL purge (admin handler + privacy cron). */
export async function purgeExpiredXapiStatements(opts?: { uidFallback?: string }): Promise<number> {
  const db = await getAdminFirestore();
  if (!db) return 0;

  const now = new Date();
  let deleted = 0;
  try {
    const snap = await db
      .collectionGroup('statements')
      .where('expireAt', '<=', now)
      .limit(200)
      .get();
    const batch = db.batch();
    snap.docs.forEach((d) => {
      batch.delete(d.ref);
      deleted += 1;
    });
    if (deleted) await batch.commit();
  } catch {
    if (!opts?.uidFallback) return 0;
    const snap = await db
      .collection('userXapi')
      .doc(opts.uidFallback)
      .collection('statements')
      .where('expireAt', '<=', now)
      .limit(200)
      .get();
    const batch = db.batch();
    snap.docs.forEach((d) => {
      batch.delete(d.ref);
      deleted += 1;
    });
    if (deleted) await batch.commit();
  }
  return deleted;
}

/** Ops helper: purge expired xAPI (callable from admin). */
export async function purgeExpiredXapiHandler(req: Request, res: Response): Promise<void> {
  const user = getAuthUser(res);
  requireRole(user, ['admin']);
  const db = await getAdminFirestore();
  if (!db) throw new HttpError(503, 'Admin SDK required');
  const deleted = await purgeExpiredXapiStatements({ uidFallback: user.uid });
  res.json({ ok: true, deleted, retentionDays: XAPI_RETENTION_DAYS });
}
