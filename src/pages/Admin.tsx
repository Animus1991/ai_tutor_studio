import { Shield, Users, Database, Download, Activity, Search, Flag, KeyRound } from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import { auditLogger, type AuditAction, type AuditEvent } from '../lib/auditLogger';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { buildAdminMetrics, fetchServerAdminMetrics, fetchTenantMetrics, type AdminMetrics, type ServerAdminMetrics, type TenantMetrics } from '../lib/adminMetrics';
import { apiRequest } from '../lib/apiClient';
import { TRIAGE_ACTIONS, type TriageAction } from '../lib/socialPolicy';
import { toast } from 'sonner';

type SocialReportRow = {
  id: string;
  surface?: string;
  reason?: string;
  note?: string;
  reporterId?: string;
  targetId?: string;
  status?: string;
  roomId?: string | null;
  createdAt?: string;
  triageAction?: string | null;
};

type BreakGlassRow = {
  id: string;
  targetUid: string;
  role: string;
  reason?: string;
  requestedBy: string;
  requestedAt: string;
  status: string;
};

const ALL_ACTIONS: AuditAction[] = [
  'USER_LOGIN',
  'USER_LOGOUT',
  'DOCUMENT_UPLOADED',
  'DOCUMENT_DELETED',
  'ROLE_CHANGED',
  'PII_DETECTED',
  'ROOM_JOINED',
  'PERFORMANCE_METRIC',
  'APP_ACCESSED',
];

export default function Admin() {
  const { hasPermission } = useAuthStore();
  const [metrics, setMetrics] = useState<AdminMetrics | null>(null);
  const [serverMetrics, setServerMetrics] = useState<ServerAdminMetrics | null>(null);
  const [tenantMetrics, setTenantMetrics] = useState<TenantMetrics | null>(null);
  const [logs, setLogs] = useState<AuditEvent[]>([]);
  const [actionFilter, setActionFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [exportFormat, setExportFormat] = useState<'json' | 'csv'>('json');
  const [socialReports, setSocialReports] = useState<SocialReportRow[]>([]);
  const [socialBackend, setSocialBackend] = useState<string>('');
  const [triageBusyId, setTriageBusyId] = useState<string | null>(null);
  const [claimUid, setClaimUid] = useState('');
  const [claimRole, setClaimRole] = useState<'student' | 'instructor' | 'admin'>('instructor');
  const [claimReason, setClaimReason] = useState('');
  const [claimBusy, setClaimBusy] = useState(false);
  const [breakGlass, setBreakGlass] = useState<BreakGlassRow[]>([]);
  const [breakGlassBusyId, setBreakGlassBusyId] = useState<string | null>(null);

  const loadSocialReports = async () => {
    try {
      const res = await apiRequest('/api/admin/social-reports?status=open&limit=40');
      if (!res.ok) {
        setSocialReports([]);
        return;
      }
      const data = (await res.json()) as { reports?: SocialReportRow[]; backend?: string };
      setSocialReports(data.reports ?? []);
      setSocialBackend(data.backend ?? '');
    } catch {
      setSocialReports([]);
    }
  };

  const loadBreakGlass = async () => {
    try {
      const res = await apiRequest('/api/admin/break-glass');
      if (!res.ok) {
        setBreakGlass([]);
        return;
      }
      const data = (await res.json()) as { requests?: BreakGlassRow[] };
      setBreakGlass(data.requests ?? []);
    } catch {
      setBreakGlass([]);
    }
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [m, serverLogs, serverM, tenantM] = await Promise.all([
        buildAdminMetrics(),
        auditLogger.fetchServerLogs(100),
        fetchServerAdminMetrics(),
        fetchTenantMetrics(),
      ]);
      if (cancelled) return;
      setMetrics(m);
      setServerMetrics(serverM);
      setTenantMetrics(tenantM);
      setLogs(auditLogger.mergeLogs(auditLogger.getRecentLogs(200), serverLogs));
      await Promise.all([loadSocialReports(), loadBreakGlass()]);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleTriage = async (reportId: string, action: TriageAction) => {
    setTriageBusyId(reportId);
    try {
      const res = await apiRequest(`/api/admin/social-reports/${encodeURIComponent(reportId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        toast.error(err.error || 'Triage failed — admin/instructor role required');
        return;
      }
      toast.success(`Report ${action}`);
      await loadSocialReports();
    } catch {
      toast.error('Triage request failed');
    } finally {
      setTriageBusyId(null);
    }
  };

  const handleAssignClaim = async () => {
    const uid = claimUid.trim();
    if (!uid) {
      toast.error('Target Firebase UID required');
      return;
    }
    setClaimBusy(true);
    try {
      const res = await apiRequest('/api/admin/claims', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid, role: claimRole, reason: claimReason.trim() || undefined }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        mode?: string;
        note?: string;
      };
      if (!res.ok) {
        toast.error(data.error || 'Claim assignment failed — admin role + Admin SDK required');
        return;
      }
      toast.success(
        data.mode === 'break_glass'
          ? 'Break-glass request queued — second admin must approve'
          : data.note || `Role ${claimRole} assigned`,
      );
      setClaimUid('');
      setClaimReason('');
      await loadBreakGlass();
    } catch {
      toast.error('Claim request failed');
    } finally {
      setClaimBusy(false);
    }
  };

  const handleApproveBreakGlass = async (id: string) => {
    setBreakGlassBusyId(id);
    try {
      const res = await apiRequest(`/api/admin/break-glass/${encodeURIComponent(id)}/approve`, {
        method: 'POST',
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        toast.error(data.error || 'Approval failed (two-person rule)');
        return;
      }
      toast.success('Break-glass claim applied');
      await loadBreakGlass();
    } catch {
      toast.error('Break-glass approve failed');
    } finally {
      setBreakGlassBusyId(null);
    }
  };

  const filteredLogs = useMemo(
    () => auditLogger.filterLogs(logs, { action: actionFilter, query: search, limit: 50 }),
    [logs, actionFilter, search],
  );

  const handleResearchExport = async () => {
    try {
      const res = await apiRequest('/api/research/export');
      if (!res.ok) {
        toast.error('Research export failed — sign in required');
        return;
      }
      const data = await res.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `memora_research_${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Anonymized research export downloaded');
    } catch {
      toast.error('Research export failed');
    }
  };

  const handleRunEvalHarness = async () => {
    try {
      const res = await apiRequest('/api/evidence/eval', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers: {} }),
      });
      if (!res.ok) {
        toast.error('Eval harness requires auth');
        return;
      }
      const report = (await res.json()) as { passRate?: number; passed?: number; total?: number };
      toast.success(
        `Eval harness: ${report.passed}/${report.total} passed (${Math.round((report.passRate ?? 0) * 100)}%)`,
      );
    } catch {
      toast.error('Eval harness failed');
    }
  };

  const handleExport = () => {
    const exportData = {
      auditLogs: filteredLogs,
      metrics,
      exportedAt: new Date().toISOString(),
    };

    if (exportFormat === 'json') {
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `memora_admin_${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } else {
      const csvContent = [
        ['ID', 'Timestamp', 'UserId', 'Action', 'ResourceID'],
        ...filteredLogs.map((log) => [
          log.id,
          new Date(log.timestamp).toISOString(),
          log.userId,
          log.action,
          log.resourceId || '',
        ]),
      ]
        .map((e) => e.join(','))
        .join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `memora_logs_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  if (!hasPermission('view_analytics')) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-slate-500">
        <Shield className="w-12 h-12 mb-4 text-slate-300" />
        <h2 className="text-xl font-bold">Access Denied</h2>
        <p>You do not have permission to view this page.</p>
      </div>
    );
  }

  return (
    <div className="pb-20">
      <header className="mb-6 md:mb-10 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl md:text-3xl font-display font-bold text-slate-900 dark:text-white tracking-tight">
            Admin Dashboard
          </h2>
          <p className="text-slate-500 dark:text-slate-400 mt-2">
            Live metrics from your library, sessions, and audit trail.
          </p>
        </div>

        <div className="flex items-center gap-2 bg-white dark:bg-slate-900 p-1.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <select
            value={exportFormat}
            onChange={(e) => setExportFormat(e.target.value as 'json' | 'csv')}
            className="bg-transparent text-sm font-medium focus:outline-none pl-2 pr-1 text-slate-700 dark:text-slate-300"
          >
            <option value="json">JSON</option>
            <option value="csv">CSV (Logs)</option>
          </select>
          <div className="w-px h-6 bg-slate-200 dark:bg-slate-700 mx-1" />
          <button
            type="button"
            onClick={() => void handleResearchExport()}
            className="flex items-center gap-2 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 px-3 py-1.5 rounded-lg hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition-colors font-semibold text-sm"
            title="Anonymized xAPI + learning events"
          >
            Research
          </button>
          <button
            type="button"
            onClick={() => void handleRunEvalHarness()}
            className="flex items-center gap-2 bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 px-3 py-1.5 rounded-lg hover:bg-amber-100 dark:hover:bg-amber-900/50 transition-colors font-semibold text-sm"
            title="Golden-question evaluation harness"
          >
            Eval
          </button>
          <button
            onClick={handleExport}
            className="flex items-center gap-2 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 px-3 py-1.5 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors font-semibold text-sm"
          >
            <Download className="w-4 h-4" />
            Export
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        <MetricCard
          icon={<Users className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />}
          iconBg="bg-indigo-50 dark:bg-indigo-900/30"
          label="Library Courses"
          value={metrics?.coursesCount ?? '—'}
        />
        <MetricCard
          icon={<Database className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />}
          iconBg="bg-emerald-50 dark:bg-emerald-900/30"
          label="Documents Indexed"
          value={metrics?.documentsIndexed ?? '—'}
        />
        <MetricCard
          icon={<Activity className="w-5 h-5 text-sky-600 dark:text-sky-400" />}
          iconBg="bg-sky-50 dark:bg-sky-900/30"
          label="Audit Events (24h)"
          value={metrics?.auditEvents24h ?? '—'}
        />
        <MetricCard
          icon={<Shield className="w-5 h-5 text-purple-600 dark:text-purple-400" />}
          iconBg="bg-purple-50 dark:bg-purple-900/30"
          label="Study Sessions (7d)"
          value={metrics?.studySessions7d ?? '—'}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <MetricCard
          icon={<Users className="w-5 h-5 text-amber-600 dark:text-amber-400" />}
          iconBg="bg-amber-50 dark:bg-amber-900/30"
          label="Active Users (local audit, 7d)"
          value={metrics?.activeUsers7d ?? '—'}
        />
        <MetricCard
          icon={<Users className="w-5 h-5 text-rose-600 dark:text-rose-400" />}
          iconBg="bg-rose-50 dark:bg-rose-900/30"
          label="Server Users (audit, 7d)"
          value={serverMetrics?.uniqueUsers7d ?? '—'}
        />
        <MetricCard
          icon={<Activity className="w-5 h-5 text-slate-600 dark:text-slate-400" />}
          iconBg="bg-slate-100 dark:bg-slate-800"
          label="Server Audit Buffer"
          value={serverMetrics?.serverAuditTotal ?? '—'}
        />
      </div>

      {tenantMetrics && (
        <div className="mb-8">
          <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400 mb-3 uppercase tracking-wide">
            Firestore platform (multi-tenant)
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard
              icon={<Database className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />}
              iconBg="bg-indigo-50 dark:bg-indigo-900/30"
              label="Platform audit events"
              value={tenantMetrics.platformAuditTotal}
            />
            <MetricCard
              icon={<Users className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />}
              iconBg="bg-emerald-50 dark:bg-emerald-900/30"
              label="Platform users (7d)"
              value={tenantMetrics.platformUsers7d}
            />
            <MetricCard
              icon={<Activity className="w-5 h-5 text-sky-600 dark:text-sky-400" />}
              iconBg="bg-sky-50 dark:bg-sky-900/30"
              label="Total tasks (all tenants)"
              value={tenantMetrics.totalTasks}
            />
            <MetricCard
              icon={<Shield className="w-5 h-5 text-purple-600 dark:text-purple-400" />}
              iconBg="bg-purple-50 dark:bg-purple-900/30"
              label="Total courses (all tenants)"
              value={tenantMetrics.totalCourses}
            />
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden mb-8">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Flag className="w-4 h-4 text-rose-500" />
              Social moderation triage
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Match · Circles · Collab reports (cooldown / ban taxonomy)
              {socialBackend ? ` · ${socialBackend}` : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={() => void loadSocialReports()}
            className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700"
          >
            Refresh
          </button>
        </div>
        <div className="divide-y divide-slate-100 dark:divide-slate-800/50 max-h-[360px] overflow-y-auto">
          {socialReports.map((r) => (
            <div key={r.id} className="px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="font-semibold text-sm text-slate-900 dark:text-white">
                  [{r.surface ?? '—'}] {r.reason ?? 'report'}
                </p>
                <p className="text-xs text-slate-500 font-mono mt-1 truncate">
                  target: {r.targetId || 'n/a'} · room: {r.roomId || 'n/a'}
                  {r.note ? ` · ${r.note}` : ''}
                </p>
              </div>
              <div className="flex flex-wrap gap-1.5 shrink-0">
                {TRIAGE_ACTIONS.map((action) => (
                  <button
                    key={action}
                    type="button"
                    disabled={triageBusyId === r.id}
                    onClick={() => void handleTriage(r.id, action)}
                    className="text-[11px] font-semibold px-2 py-1 rounded-md border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50"
                  >
                    {action}
                  </button>
                ))}
              </div>
            </div>
          ))}
          {socialReports.length === 0 && (
            <div className="px-6 py-8 text-center text-slate-500 text-sm">
              No open social reports (or Admin SDK / role unavailable).
            </div>
          )}
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden mb-8">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-amber-500" />
              Claims & break-glass
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Custom claims via Admin SDK · two-person rule when BREAK_GLASS_REQUIRED=true
            </p>
          </div>
          <button
            type="button"
            onClick={() => void loadBreakGlass()}
            className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700"
          >
            Refresh
          </button>
        </div>
        <div className="px-6 py-4 grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-3">
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide">
              Assign role claim
            </label>
            <input
              type="text"
              value={claimUid}
              onChange={(e) => setClaimUid(e.target.value)}
              placeholder="Target Firebase UID"
              className="w-full text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 font-mono"
            />
            <div className="flex flex-wrap gap-2">
              <select
                value={claimRole}
                onChange={(e) => setClaimRole(e.target.value as 'student' | 'instructor' | 'admin')}
                className="text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-2"
              >
                <option value="student">student</option>
                <option value="instructor">instructor</option>
                <option value="admin">admin</option>
              </select>
              <input
                type="text"
                value={claimReason}
                onChange={(e) => setClaimReason(e.target.value)}
                placeholder="Reason (audited)"
                className="flex-1 min-w-[10rem] text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2"
              />
            </div>
            <button
              type="button"
              disabled={claimBusy}
              onClick={() => void handleAssignClaim()}
              className="min-h-11 px-4 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold disabled:opacity-50"
            >
              {claimBusy ? 'Submitting…' : 'Assign / request claim'}
            </button>
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
              Pending break-glass ({breakGlass.length})
            </p>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {breakGlass.map((bg) => (
                <div
                  key={bg.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-lg border border-slate-100 dark:border-slate-800"
                >
                  <div className="min-w-0 text-xs">
                    <p className="font-semibold text-slate-900 dark:text-white font-mono truncate">
                      {bg.targetUid} → {bg.role}
                    </p>
                    <p className="text-slate-500 mt-0.5 truncate">
                      by {bg.requestedBy}
                      {bg.reason ? ` · ${bg.reason}` : ''}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={breakGlassBusyId === bg.id}
                    onClick={() => void handleApproveBreakGlass(bg.id)}
                    className="text-[11px] font-semibold px-2 py-1 rounded-md border border-amber-300 text-amber-800 dark:text-amber-200 dark:border-amber-700 disabled:opacity-50"
                  >
                    Approve (2nd admin)
                  </button>
                </div>
              ))}
              {breakGlass.length === 0 && (
                <p className="text-sm text-slate-500 py-4 text-center">No pending break-glass requests.</p>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h3 className="font-bold text-slate-900 dark:text-white">Audit Logs</h3>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search logs…"
                className="pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
              />
            </div>
            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1.5"
            >
              <option value="all">All actions</option>
              {ALL_ACTIONS.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="divide-y divide-slate-100 dark:divide-slate-800/50 max-h-[420px] overflow-y-auto">
          {filteredLogs.map((log) => (
            <div key={log.id} className="px-6 py-4 flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="font-semibold text-sm text-slate-900 dark:text-white">{log.action}</p>
                <p className="text-xs text-slate-500 font-mono mt-1 truncate">
                  User: {log.userId} | Resource: {log.resourceId || 'N/A'}
                </p>
              </div>
              <span className="text-xs text-slate-400 shrink-0">
                {new Date(log.timestamp).toLocaleString()}
              </span>
            </div>
          ))}
          {filteredLogs.length === 0 && (
            <div className="px-6 py-8 text-center text-slate-500">No audit logs match your filters.</div>
          )}
        </div>
      </div>
    </div>
  );
}

function MetricCard({
  icon,
  iconBg,
  label,
  value,
}: {
  icon: ReactNode;
  iconBg: string;
  label: string;
  value: string | number;
}) {
  return (
    <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
      <div className={`w-10 h-10 rounded-xl ${iconBg} flex items-center justify-center mb-4`}>{icon}</div>
      <h3 className="font-bold text-sm text-slate-500 dark:text-slate-400 mb-1">{label}</h3>
      <p className="text-2xl md:text-3xl font-display font-bold text-slate-900 dark:text-white">{value}</p>
    </div>
  );
}
