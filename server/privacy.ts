/**
 * Privacy spine — export / delete-request (GDPR-oriented).
 * Never returns peer emails or Buddy identity maps.
 */
import type { Request, Response } from 'express';
import { getAdminFirestore } from '../firebaseAdmin.js';
import { claimEmail, getAuthUser } from './authz.js';

export async function privacyExportHandler(_req: Request, res: Response): Promise<void> {
  const user = getAuthUser(res);
  const email = claimEmail(user);
  const db = await getAdminFirestore();

  const payload: Record<string, unknown> = {
    exportedAt: new Date().toISOString(),
    uid: user.uid,
    email,
    note: 'Peer identities from Study Match are never included.',
    library: null as unknown,
    matchQueue: null as unknown,
    matchSessions: [] as unknown[],
    studyCircles: [] as unknown[],
    deletionRequests: [] as unknown[],
  };

  if (!db) {
    payload.warning = 'Firebase Admin unavailable — export contains identity only.';
    res.json(payload);
    return;
  }

  const lib = await db.collection('userLibrary').doc(user.uid).get();
  if (lib.exists) {
    const data = lib.data() ?? {};
    // Strip potentially huge embeddings if present
    payload.library = {
      updatedAt: data.updatedAt ?? null,
      courseCount: Array.isArray(data.courses) ? data.courses.length : null,
      hasCourses: Boolean(data.courses),
    };
  }

  const queue = await db.collection('matchQueue').doc(user.uid).get();
  if (queue.exists) {
    const q = queue.data() ?? {};
    payload.matchQueue = {
      status: q.status ?? null,
      topicLabel: q.topicLabel ?? null,
      durationMin: q.durationMin ?? null,
      createdAt: q.createdAt ?? null,
    };
  }

  const sessions = await db
    .collection('matchSessions')
    .where('memberIds', 'array-contains', user.uid)
    .limit(40)
    .get()
    .catch(() => null);
  if (sessions) {
    payload.matchSessions = sessions.docs.map((d) => {
      const s = d.data();
      return {
        id: d.id,
        topicLabel: s.topicLabel,
        durationMin: s.durationMin,
        status: s.status,
        startedAt: s.startedAt,
        endsAt: s.endsAt,
        topicMatched: s.topicMatched ?? null,
        // Explicitly omit memberEmails, messages content optional summary only
        messageCount: Array.isArray(s.messages) ? s.messages.length : 0,
      };
    });
  }

  const circles = await db
    .collection('studyCircles')
    .where('memberEmails', 'array-contains', email)
    .limit(40)
    .get()
    .catch(() => null);
  if (circles) {
    payload.studyCircles = circles.docs.map((d) => {
      const c = d.data();
      return {
        id: d.id,
        name: c.name,
        topic: c.topic,
        purpose: c.purpose,
        memberCount: Array.isArray(c.memberEmails) ? c.memberEmails.length : 0,
      };
    });
  }

  res.json(payload);
}

export async function privacyDeleteRequestHandler(req: Request, res: Response): Promise<void> {
  const user = getAuthUser(res);
  const email = claimEmail(user);
  const reason = String(req.body?.reason ?? '')
    .trim()
    .slice(0, 500);
  const db = await getAdminFirestore();
  const record = {
    uid: user.uid,
    email,
    reason,
    status: 'queued',
    requestedAt: new Date().toISOString(),
  };

  if (db) {
    await db.collection('privacyDeletionRequests').doc(user.uid).set(record, { merge: true });
  }

  res.status(202).json({
    ok: true,
    status: 'queued',
    message:
      'Deletion request recorded. An operator will purge library, match, and circle memberships per retention policy.',
    persisted: Boolean(db),
  });
}
