import { auditLogger, type AuditEvent } from './auditLogger';
import { loadLibrary } from './libraryStorage';
import { useStore } from '../store/useStore';

export interface AdminMetrics {
  coursesCount: number;
  documentsIndexed: number;
  auditEvents24h: number;
  studySessions7d: number;
  xpTotal: number;
  xapiStatements: number;
  uniqueAuditActions: number;
  activeUsers7d: number;
}

export interface ServerAdminMetrics {
  serverAuditTotal: number;
  serverAudit24h: number;
  uniqueActions: number;
  uniqueUsers7d: number;
}

export interface TenantMetrics {
  platformAuditTotal: number;
  platformUsers7d: number;
  totalTasks: number;
  totalCourses: number;
  firestoreEnabled: boolean;
}

function countAuditLast24h(events: AuditEvent[]): number {
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  return events.filter((e) => new Date(e.timestamp).getTime() >= cutoff).length;
}

function countSessionsLast7d(history: { date: string }[]): number {
  const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
  return history.filter((s) => new Date(s.date).getTime() >= cutoff).length;
}

function countUniqueUsersLast7d(events: AuditEvent[]): number {
  const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const users = new Set(
    events
      .filter((e) => new Date(e.timestamp).getTime() >= cutoff)
      .map((e) => e.userId),
  );
  return users.size;
}

export async function fetchServerAdminMetrics(): Promise<ServerAdminMetrics | null> {
  try {
    const res = await fetch('/api/admin/metrics');
    if (!res.ok) return null;
    return (await res.json()) as ServerAdminMetrics;
  } catch {
    return null;
  }
}

export async function fetchTenantMetrics(): Promise<TenantMetrics | null> {
  try {
    const res = await fetch('/api/admin/tenant-metrics');
    if (!res.ok) return null;
    const data = (await res.json()) as TenantMetrics;
    return data.firestoreEnabled ? data : null;
  } catch {
    return null;
  }
}

export async function buildAdminMetrics(): Promise<AdminMetrics> {
  const lib = await loadLibrary();
  const auditEvents = auditLogger.getRecentLogs(500);
  const { xp, studySessionsHistory } = useStore.getState();

  let xapiStatements = 0;
  try {
    const raw = localStorage.getItem('memora-xapi-statements');
    xapiStatements = raw ? JSON.parse(raw).length : 0;
  } catch {
    xapiStatements = 0;
  }

  const uniqueActions = new Set(auditEvents.map((e) => e.action));

  return {
    coursesCount: lib.courses.length,
    documentsIndexed: lib.uploadedFiles.length,
    auditEvents24h: countAuditLast24h(auditEvents),
    studySessions7d: countSessionsLast7d(studySessionsHistory ?? []),
    xpTotal: xp,
    xapiStatements,
    uniqueAuditActions: uniqueActions.size,
    activeUsers7d: countUniqueUsersLast7d(auditEvents),
  };
}
