import { Shield, Users, Database, Download } from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import { auditLogger } from '../lib/auditLogger';
import { useState } from 'react';

export default function Admin() {
  const { userRole, hasPermission } = useAuthStore();
  const logs = auditLogger.getRecentLogs(10);
  const [exportFormat, setExportFormat] = useState<'json' | 'csv'>('json');

  const handleExport = () => {
    // Collect data (simulated or from local storage)
    const exportData = {
      auditLogs: auditLogger.getRecentLogs(100),
      appState: JSON.parse(localStorage.getItem('app-storage') || '{}'),
      // In a real app we'd fetch tasks and library from indexedDB/Firebase
    };

    if (exportFormat === 'json') {
      const dataStr = JSON.stringify(exportData, null, 2);
      const blob = new Blob([dataStr], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `memora_export_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } else {
      // Basic CSV export for audit logs
      const csvContent = [
        ['ID', 'Timestamp', 'UserId', 'Action', 'ResourceID'],
        ...exportData.auditLogs.map(log => [
          log.id,
          new Date(log.timestamp).toISOString(),
          log.userId,
          log.action,
          log.resourceId || ''
        ])
      ].map(e => e.join(",")).join("\n");
      
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `memora_logs_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
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
          <h2 className="text-2xl md:text-3xl font-display font-bold text-slate-900 dark:text-white tracking-tight">Admin Dashboard</h2>
          <p className="text-slate-500 dark:text-slate-400 mt-2">Institutional management and compliance monitoring.</p>
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
          <div className="w-px h-6 bg-slate-200 dark:bg-slate-700 mx-1"></div>
          <button 
            onClick={handleExport}
            className="flex items-center gap-2 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 px-3 py-1.5 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors font-semibold text-sm"
          >
            <Download className="w-4 h-4" />
            Export Data
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center mb-4">
            <Users className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
          </div>
          <h3 className="font-bold text-lg mb-1">Total Users</h3>
          <p className="text-2xl md:text-3xl font-display font-bold">1,248</p>
        </div>
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center mb-4">
            <Database className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <h3 className="font-bold text-lg mb-1">Documents Indexed</h3>
          <p className="text-2xl md:text-3xl font-display font-bold">8,592</p>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50">
          <h3 className="font-bold text-slate-900 dark:text-white">Recent Audit Logs (SOC 2)</h3>
        </div>
        <div className="divide-y divide-slate-100 dark:divide-slate-800/50">
          {logs.map((log) => (
            <div key={log.id} className="px-6 py-4 flex items-center justify-between">
              <div>
                <p className="font-semibold text-sm text-slate-900 dark:text-white">{log.action}</p>
                <p className="text-xs text-slate-500 font-mono mt-1">User: {log.userId} | Resource: {log.resourceId || 'N/A'}</p>
              </div>
              <span className="text-xs text-slate-400">{new Date(log.timestamp).toLocaleString()}</span>
            </div>
          ))}
          {logs.length === 0 && (
            <div className="px-6 py-8 text-center text-slate-500">No recent audit logs found.</div>
          )}
        </div>
      </div>
    </div>
  );
}
