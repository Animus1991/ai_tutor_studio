// Teacher / Class dashboard client (/api/classes, /api/progress) — institution spine.
import { apiRequest } from './apiClient';
import { errorFromResponse } from './apiErrors';

export interface ClassSummary {
  id: string;
  name: string;
  teacherName?: string;
  role: 'teacher' | 'student';
  memberCount: number;
  joinCode?: string | null;
  institutionDomain?: string | null;
}

export interface StudentRow {
  userId: string;
  name: string;
  email: string;
  masteryPct: number;
  cardsDue: number;
  streak: number;
  studyMinutes: number;
  subjects: { name: string; mastery: number }[];
  updatedAt?: string | null;
}

export interface DpAggregates {
  studentCount: number;
  avgMastery: number | null;
  totalDue: number | null;
  activeCount: number | null;
  suppressed: boolean;
  epsilon: number;
  kAnonymity: number;
  note: string;
}

export interface AtRiskRow {
  userId: string;
  name?: string;
  score: number;
  reasons: string[];
  explain: string;
}

export interface MasteryBucket {
  label: string;
  min: number;
  max: number;
  count: number;
}

export interface ClassDetail {
  id: string;
  name: string;
  joinCode?: string | null;
  role: string;
  institutionDomain?: string | null;
  students: StudentRow[];
  subjects: string[];
  aggregates: { studentCount: number; avgMastery: number; totalDue: number; activeCount: number };
  dpAggregates?: DpAggregates;
  masteryDistribution?: MasteryBucket[];
  atRisk?: AtRiskRow[];
  peerPiiRedacted?: boolean;
}

export interface AssignmentMap {
  id?: string;
  externalAssignmentId: string;
  title: string;
  memoraTaskId?: string | null;
  memoraQuizId?: string | null;
  source?: string;
  updatedAt?: string;
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await apiRequest(`/api${path}`, {
    headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
    ...init,
  });
  if (!response.ok) throw await errorFromResponse(response);
  return response.json() as Promise<T>;
}

export const listClasses = () => api<{ classes: ClassSummary[] }>('/classes');
export const createClass = (name: string, institutionDomain?: string) =>
  api<ClassSummary>('/classes', {
    method: 'POST',
    body: JSON.stringify({ name, institutionDomain: institutionDomain || undefined }),
  });
export const joinClass = (joinCode: string) =>
  api<ClassSummary>('/classes/join', { method: 'POST', body: JSON.stringify({ joinCode }) });
export const classDetail = (id: string) => api<ClassDetail>(`/classes/${id}`);
export const reportProgress = (snapshot: Record<string, unknown>) =>
  api<{ ok: boolean; classScoped?: boolean }>('/progress', {
    method: 'POST',
    body: JSON.stringify(snapshot),
  });

export const syncClassroomRoster = (
  classId: string,
  input: {
    consent: true;
    accessToken?: string;
    classroomCourseId?: string;
    members?: { email: string; name?: string }[];
  },
) =>
  api<{ ok: boolean; synced: number; consentAt: string }>(
    `/classes/${encodeURIComponent(classId)}/classroom/sync`,
    { method: 'POST', body: JSON.stringify(input) },
  );

export const mapAssignment = (
  classId: string,
  input: {
    externalAssignmentId: string;
    title: string;
    memoraTaskId?: string;
    memoraQuizId?: string;
    source?: string;
  },
) =>
  api<{ ok: boolean; map: AssignmentMap }>(
    `/classes/${encodeURIComponent(classId)}/assignments/map`,
    { method: 'POST', body: JSON.stringify(input) },
  );

export const listAssignmentMaps = (classId: string) =>
  api<{ maps: AssignmentMap[] }>(`/classes/${encodeURIComponent(classId)}/assignments`);
