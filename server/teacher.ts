/**
 * Teacher / Classroom institution spine.
 * Class-scoped authZ · DP aggregates · at-risk · Classroom roster consent · assignment maps.
 */
import type { Request, Response } from 'express';
import { randomBytes, createHash } from 'node:crypto';
import { getAdminFirestore } from '../firebaseAdmin.js';
import { HttpError } from './security.js';
import {
  claimEmail,
  claimRole,
  getAuthUser,
  requireRole,
  type AuthUser,
} from './authz.js';
import { validateObject } from './requestSpine.js';
import {
  computeAtRisk,
  computeDpAggregates,
  emailMatchesDomain,
  masteryDistribution,
  normalizeInstitutionDomain,
  studentSafeSelfView,
  type ProgressSignals,
} from './institutionCore.js';

interface Subject {
  name: string;
  mastery: number;
}

function userName(user: AuthUser): string {
  const claims = user.claims ?? {};
  return String(claims.name ?? claims.displayName ?? 'Student');
}

function generateJoinCode(): string {
  return randomBytes(3).toString('hex').toUpperCase();
}

function hashEmail(email: string): string {
  return createHash('sha256').update(email.trim().toLowerCase()).digest('hex').slice(0, 24);
}

async function memberCount(classId: string): Promise<number> {
  const db = await getAdminFirestore();
  if (!db) return 0;
  const snap = await db.collection('classes').doc(classId).collection('members').count().get();
  return snap.data().count;
}

async function assertClassMember(
  classId: string,
  uid: string,
): Promise<{ role: string; classData: Record<string, unknown> }> {
  const db = await getAdminFirestore();
  if (!db) throw new HttpError(503, 'Class dashboard requires Firebase Admin configuration');
  const classRef = db.collection('classes').doc(classId);
  const classSnap = await classRef.get();
  if (!classSnap.exists) throw new HttpError(404, 'Class not found');
  const membership = await classRef.collection('members').doc(uid).get();
  if (!membership.exists) throw new HttpError(403, 'Not a member of this class');
  return {
    role: String(membership.data()?.role ?? 'student'),
    classData: (classSnap.data() ?? {}) as Record<string, unknown>,
  };
}

async function assertClassTeacher(classId: string, uid: string): Promise<Record<string, unknown>> {
  const { role, classData } = await assertClassMember(classId, uid);
  if (role !== 'teacher' && classData.teacherId !== uid) {
    throw new HttpError(403, 'Teacher role required for this action');
  }
  return classData;
}

export async function createClassHandler(req: Request, res: Response): Promise<void> {
  const user = getAuthUser(res);
  const body = validateObject(req.body, {
    name: { type: 'string', required: true, maxLength: 120 },
    institutionDomain: { type: 'string', maxLength: 120 },
  });
  const name = String(body.name).trim();
  if (!name) throw new HttpError(400, 'Class name is required');
  const institutionDomain = normalizeInstitutionDomain(
    body.institutionDomain ? String(body.institutionDomain) : null,
  );

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
    institutionDomain,
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
    institutionDomain,
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
        institutionDomain: cls.institutionDomain ?? null,
      };
    }),
  );

  res.json({ classes: classes.filter(Boolean) });
}

export async function joinClassHandler(req: Request, res: Response): Promise<void> {
  const user = getAuthUser(res);
  const email = claimEmail(user);
  const joinCode = String(req.body?.joinCode ?? '').trim().toUpperCase();
  if (!joinCode) throw new HttpError(400, 'Join code is required');

  const db = await getAdminFirestore();
  if (!db) throw new HttpError(503, 'Class dashboard requires Firebase Admin configuration');

  const snap = await db.collection('classes').where('joinCode', '==', joinCode).limit(1).get();
  if (snap.empty) throw new HttpError(404, 'No class found for that code');

  const classDoc = snap.docs[0];
  const classId = classDoc.id;
  const domain = normalizeInstitutionDomain(
    classDoc.data()?.institutionDomain ? String(classDoc.data()?.institutionDomain) : null,
  );
  if (!emailMatchesDomain(email, domain)) {
    throw new HttpError(403, `This class is restricted to @${domain} accounts`);
  }

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
    institutionDomain: domain,
  });
}

async function loadStudentSignals(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
  classId: string,
  membersSnap: { docs: Array<{ id: string; data: () => Record<string, unknown> }> },
): Promise<
  Array<
    ProgressSignals & {
      name: string;
      email: string;
      subjects: Subject[];
    }
  >
> {
  const students = [];
  for (const memberDoc of membersSnap.docs) {
    if (memberDoc.data().role === 'teacher') continue;
    const studentId = memberDoc.id;
    const classProg = await db.collection('classes').doc(classId).collection('progress').doc(studentId).get();
    const globalProg = await db.collection('studentProgress').doc(studentId).get();
    const prog = {
      ...(globalProg.data() ?? {}),
      ...(classProg.data() ?? {}),
    };
    const subjects = Array.isArray(prog.subjects) ? (prog.subjects as Subject[]) : [];
    students.push({
      userId: studentId,
      name: String(prog.name ?? 'Student'),
      email: String(prog.email ?? ''),
      masteryPct: Number(prog.masteryPct ?? 0),
      cardsDue: Number(prog.cardsDue ?? 0),
      streak: Number(prog.streak ?? 0),
      studyMinutes: Number(prog.studyMinutes ?? 0),
      subjects,
      updatedAt: (prog.updatedAt as string | null) ?? null,
    });
  }
  return students;
}

export async function classDetailHandler(req: Request, res: Response): Promise<void> {
  const user = getAuthUser(res);
  const classId = String(req.params.classId ?? '');
  if (!classId) throw new HttpError(400, 'Class id is required');

  const db = await getAdminFirestore();
  if (!db) throw new HttpError(503, 'Class dashboard requires Firebase Admin configuration');

  const { role, classData } = await assertClassMember(classId, user.uid);
  const isTeacher = role === 'teacher' || classData.teacherId === user.uid;

  const classRef = db.collection('classes').doc(classId);
  const membersSnap = await classRef.collection('members').get();
  const students = await loadStudentSignals(db, classId, membersSnap);

  const signals: ProgressSignals[] = students.map((s) => ({
    userId: s.userId,
    masteryPct: s.masteryPct,
    cardsDue: s.cardsDue,
    streak: s.streak,
    studyMinutes: s.studyMinutes,
    updatedAt: s.updatedAt,
  }));

  const exactCount = students.length;
  const exactAvg = exactCount
    ? Math.round((students.reduce((a, s) => a + s.masteryPct, 0) / exactCount) * 10) / 10
    : 0;
  const exactDue = students.reduce((a, s) => a + s.cardsDue, 0);
  const exactActive = students.filter((s) => s.updatedAt).length;
  const dpAggregates = computeDpAggregates(signals);
  const allSubjects = new Set<string>();
  for (const s of students) {
    for (const sub of s.subjects) {
      if (sub?.name) allSubjects.add(String(sub.name));
    }
  }

  // Students: self only + DP aggregates — no classmate emails / social graph
  if (!isTeacher) {
    const self = students.find((s) => s.userId === user.uid);
    res.json({
      id: classId,
      name: String(classData.name ?? ''),
      joinCode: null,
      role,
      institutionDomain: classData.institutionDomain ?? null,
      students: self
        ? [
            {
              ...studentSafeSelfView(self),
              email: '', // never expose even own email in peer-shaped list
            },
          ]
        : [],
      subjects: [...allSubjects].filter(Boolean).sort(),
      aggregates: {
        studentCount: dpAggregates.studentCount,
        avgMastery: dpAggregates.avgMastery ?? 0,
        totalDue: dpAggregates.totalDue ?? 0,
        activeCount: dpAggregates.activeCount ?? 0,
      },
      dpAggregates,
      masteryDistribution: [],
      atRisk: [],
      peerPiiRedacted: true,
    });
    return;
  }

  const atRisk = computeAtRisk(signals);
  const distribution = masteryDistribution(signals);

  res.json({
    id: classId,
    name: String(classData.name ?? ''),
    joinCode: String(classData.joinCode ?? ''),
    role: 'teacher',
    institutionDomain: classData.institutionDomain ?? null,
    students: students.map((s) => ({
      userId: s.userId,
      name: s.name,
      email: s.email,
      masteryPct: s.masteryPct,
      cardsDue: s.cardsDue,
      streak: s.streak,
      studyMinutes: s.studyMinutes,
      subjects: s.subjects,
      updatedAt: s.updatedAt,
    })),
    subjects: [...allSubjects].filter(Boolean).sort(),
    aggregates: {
      studentCount: exactCount,
      avgMastery: exactAvg,
      totalDue: exactDue,
      activeCount: exactActive,
    },
    dpAggregates,
    masteryDistribution: distribution,
    atRisk: atRisk.map((r) => {
      const st = students.find((s) => s.userId === r.userId);
      return {
        ...r,
        name: st?.name ?? 'Student',
      };
    }),
    peerPiiRedacted: false,
  });
}

export async function reportProgressHandler(req: Request, res: Response): Promise<void> {
  const user = getAuthUser(res);
  const body = validateObject(req.body, {
    masteryPct: { type: 'number', min: 0, max: 100 },
    cardsDue: { type: 'number', min: 0, max: 10000 },
    streak: { type: 'number', min: 0, max: 10000 },
    studyMinutes: { type: 'number', min: 0, max: 1_000_000 },
    decks: { type: 'number', min: 0, max: 10000 },
    subjects: { type: 'array' },
    classId: { type: 'string', maxLength: 128 },
  });

  const db = await getAdminFirestore();
  if (!db) throw new HttpError(503, 'Progress reporting requires Firebase Admin configuration');

  const subjects = Array.isArray(body.subjects)
    ? (body.subjects as Subject[]).slice(0, 50).map((s) => ({
        name: String(s?.name ?? '').slice(0, 80),
        mastery: Math.max(0, Math.min(100, Number(s?.mastery ?? 0))),
      }))
    : [];

  const snapshot = {
    userId: user.uid,
    name: userName(user),
    email: String(user.claims?.email ?? ''),
    masteryPct: Number(body.masteryPct ?? 0),
    cardsDue: Number(body.cardsDue ?? 0),
    streak: Number(body.streak ?? 0),
    studyMinutes: Number(body.studyMinutes ?? 0),
    decks: Number(body.decks ?? 0),
    subjects,
    updatedAt: new Date().toISOString(),
  };

  await db.collection('studentProgress').doc(user.uid).set(snapshot, { merge: true });

  const classId = body.classId ? String(body.classId) : '';
  if (classId) {
    await assertClassMember(classId, user.uid);
    await db
      .collection('classes')
      .doc(classId)
      .collection('progress')
      .doc(user.uid)
      .set(snapshot, { merge: true });
  }

  res.json({ ok: true, classScoped: Boolean(classId) });
}

/**
 * POST /api/classes/:classId/classroom/sync
 * Consent-gated Google Classroom roster sync (teacher only).
 * Body: { accessToken, classroomCourseId, consent: true }
 * Optional demo: { members: [{ email, name }], consent: true } when no token.
 */
export async function syncClassroomRosterHandler(req: Request, res: Response): Promise<void> {
  const user = getAuthUser(res);
  requireRole(user, ['instructor', 'admin']);
  const classId = String(req.params.classId ?? '');
  if (!classId) throw new HttpError(400, 'Class id is required');
  await assertClassTeacher(classId, user.uid);

  const body = validateObject(req.body, {
    consent: { type: 'boolean', required: true },
    accessToken: { type: 'string', maxLength: 8192 },
    classroomCourseId: { type: 'string', maxLength: 128 },
    members: { type: 'array' },
  });
  if (body.consent !== true) {
    throw new HttpError(400, 'Explicit consent is required to sync Classroom roster');
  }

  const db = await getAdminFirestore();
  if (!db) throw new HttpError(503, 'Classroom sync requires Firebase Admin configuration');

  type RosterMember = { email: string; name: string; externalId: string };
  const roster: RosterMember[] = [];

  const token = body.accessToken ? String(body.accessToken) : '';
  const courseId = body.classroomCourseId ? String(body.classroomCourseId) : '';

  if (token && courseId) {
    const url = `https://classroom.googleapis.com/v1/courses/${encodeURIComponent(courseId)}/students?pageSize=100`;
    const resp = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!resp.ok) {
      throw new HttpError(502, `Classroom roster fetch failed (${resp.status})`);
    }
    const data = (await resp.json()) as {
      students?: Array<{
        userId?: string;
        profile?: { name?: { fullName?: string }; emailAddress?: string };
      }>;
    };
    for (const st of data.students ?? []) {
      const email = String(st.profile?.emailAddress ?? '')
        .trim()
        .toLowerCase();
      if (!email) continue;
      roster.push({
        email,
        name: String(st.profile?.name?.fullName ?? email.split('@')[0]),
        externalId: String(st.userId ?? hashEmail(email)),
      });
    }
  } else if (Array.isArray(body.members)) {
    for (const m of body.members.slice(0, 200) as Array<{ email?: string; name?: string }>) {
      const email = String(m.email ?? '')
        .trim()
        .toLowerCase();
      if (!email.includes('@')) continue;
      roster.push({
        email,
        name: String(m.name ?? email.split('@')[0]).slice(0, 80),
        externalId: hashEmail(email),
      });
    }
  } else {
    throw new HttpError(400, 'Provide accessToken+classroomCourseId or demo members[]');
  }

  const now = new Date().toISOString();
  const batch = db.batch();
  const linkRef = db.collection('classes').doc(classId).collection('classroomLink').doc('primary');
  batch.set(linkRef, {
    classroomCourseId: courseId || null,
    consentAt: now,
    consentBy: user.uid,
    scopes: ['classroom.rosters.readonly'],
    rosterCount: roster.length,
    updatedAt: now,
  });

  for (const m of roster) {
    const ref = db.collection('classes').doc(classId).collection('roster').doc(m.externalId);
    batch.set(
      ref,
      {
        emailHash: hashEmail(m.email),
        // Store email only for teacher Admin-SDK paths — never returned to student clients
        email: m.email,
        name: m.name,
        externalId: m.externalId,
        syncedAt: now,
      },
      { merge: true },
    );
  }
  await batch.commit();

  res.json({
    ok: true,
    synced: roster.length,
    classroomCourseId: courseId || null,
    consentAt: now,
    note: 'Roster emails are teacher/Admin-SDK only — never exposed to classmates.',
  });
}

/**
 * POST /api/classes/:classId/assignments/map
 * Map a Classroom (or external) assignment → Memora task/quiz ids.
 */
export async function mapAssignmentHandler(req: Request, res: Response): Promise<void> {
  const user = getAuthUser(res);
  requireRole(user, ['instructor', 'admin']);
  const classId = String(req.params.classId ?? '');
  if (!classId) throw new HttpError(400, 'Class id is required');
  await assertClassTeacher(classId, user.uid);

  const body = validateObject(req.body, {
    externalAssignmentId: { type: 'string', required: true, maxLength: 128 },
    title: { type: 'string', required: true, maxLength: 200 },
    memoraTaskId: { type: 'string', maxLength: 128 },
    memoraQuizId: { type: 'string', maxLength: 128 },
    source: { type: 'string', maxLength: 40 },
  });

  const db = await getAdminFirestore();
  if (!db) throw new HttpError(503, 'Assignment mapping requires Firebase Admin configuration');

  const id = String(body.externalAssignmentId);
  const now = new Date().toISOString();
  const map = {
    externalAssignmentId: id,
    title: String(body.title).trim(),
    memoraTaskId: body.memoraTaskId ? String(body.memoraTaskId) : null,
    memoraQuizId: body.memoraQuizId ? String(body.memoraQuizId) : null,
    source: body.source ? String(body.source) : 'classroom',
    mappedBy: user.uid,
    updatedAt: now,
  };
  await db.collection('classes').doc(classId).collection('assignmentMaps').doc(id).set(map, {
    merge: true,
  });
  res.status(201).json({ ok: true, map });
}

export async function listAssignmentMapsHandler(req: Request, res: Response): Promise<void> {
  const user = getAuthUser(res);
  const classId = String(req.params.classId ?? '');
  if (!classId) throw new HttpError(400, 'Class id is required');
  const { role } = await assertClassMember(classId, user.uid);
  if (role !== 'teacher') {
    throw new HttpError(403, 'Only teachers can list assignment maps');
  }

  const db = await getAdminFirestore();
  if (!db) throw new HttpError(503, 'Assignment maps require Firebase Admin configuration');

  const snap = await db
    .collection('classes')
    .doc(classId)
    .collection('assignmentMaps')
    .limit(100)
    .get();
  res.json({
    maps: snap.docs.map((d) => ({ id: d.id, ...d.data() })),
  });
}

/** Claim role helper for UI — students with instructor claim can teach. */
export function canCreateClass(user: AuthUser): boolean {
  const role = claimRole(user);
  return role === 'instructor' || role === 'admin';
}
