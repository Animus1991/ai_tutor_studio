import type { Request, Response } from 'express';
import { randomBytes } from 'node:crypto';
import { getAdminFirestore } from '../firebaseAdmin.js';
import { HttpError } from './security.js';

type AuthUser = { uid: string; claims?: Record<string, unknown> };

interface Subject {
  name: string;
  mastery: number;
}

interface ProgressBody {
  masteryPct?: number;
  cardsDue?: number;
  streak?: number;
  studyMinutes?: number;
  decks?: number;
  subjects?: Subject[];
}

function getAuthUser(res: Response): AuthUser {
  const user = res.locals.user as AuthUser | undefined;
  if (!user?.uid) throw new HttpError(401, 'Authentication required');
  return user;
}

function userName(user: AuthUser): string {
  const claims = user.claims ?? {};
  return String(claims.name ?? claims.displayName ?? 'Student');
}

function userEmail(user: AuthUser): string {
  const claims = user.claims ?? {};
  return String(claims.email ?? '');
}

function generateJoinCode(): string {
  return randomBytes(3).toString('hex').toUpperCase();
}

async function memberCount(classId: string): Promise<number> {
  const db = await getAdminFirestore();
  if (!db) return 0;
  const snap = await db.collection('classes').doc(classId).collection('members').count().get();
  return snap.data().count;
}

export async function createClassHandler(req: Request, res: Response): Promise<void> {
  const user = getAuthUser(res);
  const name = String(req.body?.name ?? '').trim();
  if (!name || name.length > 120) {
    throw new HttpError(400, 'Class name is required (max 120 characters)');
  }

  const db = await getAdminFirestore();
  if (!db) throw new HttpError(503, 'Class dashboard requires Firebase Admin configuration');

  let joinCode = generateJoinCode();
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const existing = await db.collection('classes').where('joinCode', '==', joinCode).limit(1).get();
    if (existing.empty) break;
    joinCode = generateJoinCode();
  }

  const classRef = db.collection('classes').doc();
  const now = new Date().toISOString();
  await classRef.set({
    name,
    teacherId: user.uid,
    teacherName: userName(user),
    joinCode,
    createdAt: now,
  });
  await classRef.collection('members').doc(user.uid).set({
    userId: user.uid,
    role: 'teacher',
    joinedAt: now,
  });
  await db.collection('users').doc(user.uid).collection('classMemberships').doc(classRef.id).set({
    classId: classRef.id,
    role: 'teacher',
    joinedAt: now,
  });

  res.json({
    id: classRef.id,
    name,
    joinCode,
    memberCount: 1,
    role: 'teacher',
  });
}

export async function listClassesHandler(_req: Request, res: Response): Promise<void> {
  const user = getAuthUser(res);
  const db = await getAdminFirestore();
  if (!db) throw new HttpError(503, 'Class dashboard requires Firebase Admin configuration');

  const memberships = await db
    .collection('users')
    .doc(user.uid)
    .collection('classMemberships')
    .get();

  const classes = await Promise.all(
    memberships.docs.map(async (memberDoc) => {
      const classId = memberDoc.id;
      const classRef = db.collection('classes').doc(classId);
      const cls = (await classRef.get()).data();
      if (!cls) return null;
      const isTeacher = memberDoc.data().role === 'teacher';
      return {
        id: classId,
        name: String(cls.name ?? ''),
        teacherName: String(cls.teacherName ?? ''),
        role: String(memberDoc.data().role ?? 'student'),
        memberCount: await memberCount(classId),
        joinCode: isTeacher ? String(cls.joinCode ?? '') : null,
      };
    }),
  );

  res.json({ classes: classes.filter(Boolean) });
}

export async function joinClassHandler(req: Request, res: Response): Promise<void> {
  const user = getAuthUser(res);
  const joinCode = String(req.body?.joinCode ?? '').trim().toUpperCase();
  if (!joinCode) throw new HttpError(400, 'Join code is required');

  const db = await getAdminFirestore();
  if (!db) throw new HttpError(503, 'Class dashboard requires Firebase Admin configuration');

  const snap = await db.collection('classes').where('joinCode', '==', joinCode).limit(1).get();
  if (snap.empty) throw new HttpError(404, 'No class found for that code');

  const classDoc = snap.docs[0];
  const classId = classDoc.id;
  const memberRef = classDoc.ref.collection('members').doc(user.uid);
  const existing = await memberRef.get();
  if (!existing.exists) {
    await memberRef.set({
      userId: user.uid,
      role: 'student',
      joinedAt: new Date().toISOString(),
    });
    await db.collection('users').doc(user.uid).collection('classMemberships').doc(classId).set({
      classId,
      role: 'student',
      joinedAt: new Date().toISOString(),
    });
  }

  res.json({
    id: classId,
    name: String(classDoc.data()?.name ?? ''),
    role: 'student',
    memberCount: await memberCount(classId),
  });
}

export async function classDetailHandler(req: Request, res: Response): Promise<void> {
  const user = getAuthUser(res);
  const classId = String(req.params.classId ?? '');
  if (!classId) throw new HttpError(400, 'Class id is required');

  const db = await getAdminFirestore();
  if (!db) throw new HttpError(503, 'Class dashboard requires Firebase Admin configuration');

  const classRef = db.collection('classes').doc(classId);
  const classSnap = await classRef.get();
  if (!classSnap.exists) throw new HttpError(404, 'Class not found');

  const membership = await classRef.collection('members').doc(user.uid).get();
  if (!membership.exists) throw new HttpError(403, 'Not a member of this class');

  const isTeacher = membership.data()?.role === 'teacher';
  const membersSnap = await classRef.collection('members').get();
  const students = [];
  let totalMastery = 0;
  let totalDue = 0;
  let active = 0;
  const allSubjects = new Set<string>();

  for (const memberDoc of membersSnap.docs) {
    if (memberDoc.data().role === 'teacher') continue;
    const studentId = memberDoc.id;
    const progSnap = await db.collection('studentProgress').doc(studentId).get();
    const prog = progSnap.data() ?? {};
    const subjects = Array.isArray(prog.subjects) ? prog.subjects as Subject[] : [];
    for (const s of subjects) {
      if (s?.name) allSubjects.add(String(s.name));
    }
    const mastery = Number(prog.masteryPct ?? 0);
    const due = Number(prog.cardsDue ?? 0);
    totalMastery += mastery;
    totalDue += due;
    if (prog.updatedAt) active += 1;
    students.push({
      userId: studentId,
      name: String(prog.name ?? 'Student'),
      email: String(prog.email ?? ''),
      masteryPct: mastery,
      cardsDue: due,
      streak: Number(prog.streak ?? 0),
      studyMinutes: Number(prog.studyMinutes ?? 0),
      subjects,
      updatedAt: prog.updatedAt ?? null,
    });
  }

  const count = students.length;
  res.json({
    id: classId,
    name: String(classSnap.data()?.name ?? ''),
    joinCode: isTeacher ? String(classSnap.data()?.joinCode ?? '') : null,
    role: membership.data()?.role ?? 'student',
    students,
    subjects: [...allSubjects].filter(Boolean).sort(),
    aggregates: {
      studentCount: count,
      avgMastery: count ? Math.round((totalMastery / count) * 10) / 10 : 0,
      totalDue,
      activeCount: active,
    },
  });
}

export async function reportProgressHandler(req: Request, res: Response): Promise<void> {
  const user = getAuthUser(res);
  const body = req.body as ProgressBody;
  const db = await getAdminFirestore();
  if (!db) throw new HttpError(503, 'Progress reporting requires Firebase Admin configuration');

  const snapshot = {
    userId: user.uid,
    name: userName(user),
    email: userEmail(user),
    masteryPct: Number(body.masteryPct ?? 0),
    cardsDue: Number(body.cardsDue ?? 0),
    streak: Number(body.streak ?? 0),
    studyMinutes: Number(body.studyMinutes ?? 0),
    decks: Number(body.decks ?? 0),
    subjects: Array.isArray(body.subjects) ? body.subjects.slice(0, 50) : [],
    updatedAt: new Date().toISOString(),
  };

  await db.collection('studentProgress').doc(user.uid).set(snapshot, { merge: true });
  res.json({ ok: true });
}
