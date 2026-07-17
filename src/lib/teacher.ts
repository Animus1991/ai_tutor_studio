// Teacher / Class dashboard client (/api/classes, /api/progress).
export interface ClassSummary {
  id: string;
  name: string;
  teacherName?: string;
  role: 'teacher' | 'student';
  memberCount: number;
  joinCode?: string | null;
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

export interface ClassDetail {
  id: string;
  name: string;
  joinCode?: string | null;
  role: string;
  students: StudentRow[];
  subjects: string[];
  aggregates: { studentCount: number; avgMastery: number; totalDue: number; activeCount: number };
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
    ...init,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { detail?: string }).detail || 'Request failed');
  return data as T;
}

export const listClasses = () => api<{ classes: ClassSummary[] }>('/classes');
export const createClass = (name: string) => api<ClassSummary>('/classes', { method: 'POST', body: JSON.stringify({ name }) });
export const joinClass = (joinCode: string) => api<ClassSummary>('/classes/join', { method: 'POST', body: JSON.stringify({ joinCode }) });
export const classDetail = (id: string) => api<ClassDetail>(`/classes/${id}`);
export const reportProgress = (snapshot: Record<string, unknown>) =>
  api<{ ok: boolean }>('/progress', { method: 'POST', body: JSON.stringify(snapshot) });
