/**
 * Automated privacy deletion drain + retention purge helpers.
 * Processes queued privacyDeletionRequests and expired xAPI / Yjs snapshots.
 */
import type { Request, Response } from 'express';
import type { Firestore } from 'firebase-admin/firestore';
import { getAdminFirestore } from '../firebaseAdmin.js';
import { getAuthUser, requireRole } from './authz.js';
import { HttpError } from './security.js';
import { compactExpiredYjsSnapshots } from './yjsSnapshotStore.js';
import { purgeExpiredXapiStatements } from './evidence.js';

export type PurgeResult = {
  deletionsProcessed: number;
  deletionsFailed: number;
  xapiPurged: number;
  yjsCompacted: number;
  at: string;
};

async function purgeUserCollections(db: Firestore, uid: string): Promise<void> {
  const deleteLimited = async (colPath: string) => {
    const snap = await db.collection(colPath).limit(200).get();
    if (snap.empty) return;
    const batch = db.batch();
    snap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
  };

  await deleteLimited(`users/${uid}/library`);
  await deleteLimited(`userLearningEvents/${uid}/events`);

  try {
    await db.collection('matchQueue').doc(uid).delete();
  } catch {
    /* ignore */
  }

  const devices = await db.collection('trustedDevices').where('uid', '==', uid).limit(50).get();
  if (!devices.empty) {
    const batch = db.batch();
    devices.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }
}

export async function runPrivacyPurgeJob(limit = 20): Promise<PurgeResult> {
  const db = await getAdminFirestore();
  let deletionsProcessed = 0;
  let deletionsFailed = 0;
  let xapiPurged = 0;

  if (db) {
    const snap = await db
      .collection('privacyDeletionRequests')
      .where('status', '==', 'queued')
      .limit(Math.min(50, Math.max(1, limit)))
      .get();

    for (const doc of snap.docs) {
      const uid = String(doc.data()?.uid ?? doc.id);
      try {
        await purgeUserCollections(db, uid);
        await doc.ref.set(
          {
            status: 'completed',
            completedAt: new Date().toISOString(),
          },
          { merge: true },
        );
        await db.collection('platform_audit').add({
          category: 'privacy',
          action: 'DELETION_PURGED',
          actorUid: uid,
          at: new Date().toISOString(),
        });
        deletionsProcessed += 1;
      } catch (e) {
        deletionsFailed += 1;
        await doc.ref.set(
          {
            status: 'failed',
            error: String((e as Error).message ?? e).slice(0, 200),
            failedAt: new Date().toISOString(),
          },
          { merge: true },
        );
      }
    }

    xapiPurged = await purgeExpiredXapiStatements();
  }

  const yjsCompacted = compactExpiredYjsSnapshots();

  return {
    deletionsProcessed,
    deletionsFailed,
    xapiPurged,
    yjsCompacted,
    at: new Date().toISOString(),
  };
}

/** POST /api/admin/privacy/purge — admin-triggered drain */
export async function privacyPurgeHandler(req: Request, res: Response): Promise<void> {
  const user = getAuthUser(res);
  requireRole(user, ['admin']);
  const limit = Number(req.body?.limit ?? 20);
  const result = await runPrivacyPurgeJob(limit);
  res.json({ ok: true, ...result });
}

/** Cron/tick endpoint — X-Purge-Key or admin when REQUIRE_API_AUTH */
export async function privacyPurgeTickHandler(req: Request, res: Response): Promise<void> {
  if (process.env.PRIVACY_PURGE_CRON_KEY) {
    const key = String(req.header('x-purge-key') ?? '');
    if (key !== process.env.PRIVACY_PURGE_CRON_KEY) {
      throw new HttpError(401, 'Invalid purge key');
    }
  } else if (process.env.REQUIRE_API_AUTH === 'true') {
    const user = getAuthUser(res);
    requireRole(user, ['admin']);
  }
  const result = await runPrivacyPurgeJob(10);
  res.json({ ok: true, ...result });
}
