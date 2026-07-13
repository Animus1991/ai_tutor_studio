import { useEffect, useMemo, useState } from 'react';
import { useLanguage } from '../lib/i18n';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import { Clock, CheckCircle2 } from 'lucide-react';
import { auth, db } from '../lib/firebase';
import { collection, query, getDocs } from 'firebase/firestore';
import localforage from 'localforage';
import { useStore } from '../store/useStore';
import { buildTaskAnalytics } from '../lib/taskAnalytics';
import { isDemoModeActive, loadDemoTasks } from '../lib/demoStorage';

export default function DashboardStats() {
  const { t } = useLanguage();
  const studySessionsHistory = useStore((s) => s.studySessionsHistory);
  const [tasks, setTasks] = useState<Array<{ completed?: boolean; createdAt?: string; completedAt?: string }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTasks = async () => {
      try {
        if (isDemoModeActive()) {
          setTasks(await loadDemoTasks());
          return;
        }

        let tasksData: typeof tasks = [];
        if (auth.currentUser) {
          const q = query(collection(db, 'users', auth.currentUser.uid, 'tasks'));
          const snap = await getDocs(q);
          tasksData = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as typeof tasks;
        }

        const storedTasksStr = await localforage.getItem<string>('memora-tasks');
        if (storedTasksStr) {
          const localTasks = JSON.parse(storedTasksStr);
          tasksData = [...tasksData, ...localTasks];
        }

        setTasks(tasksData);
      } catch (err) {
        console.error('Failed to load tasks for dashboard stats', err);
      } finally {
        setLoading(false);
      }
    };

    void fetchTasks();
  }, []);

  const analyticsData = useMemo(
    () => buildTaskAnalytics(tasks, studySessionsHistory),
    [tasks, studySessionsHistory],
  );

  const avgFocus = Math.round(
    analyticsData.reduce((sum, d) => sum + d.focusTime, 0) / Math.max(analyticsData.length, 1),
  );
  const avgCompletion = Math.round(
    analyticsData.reduce((sum, d) => sum + d.completionRate, 0) / Math.max(analyticsData.length, 1),
  );

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 p-6 rounded-2xl shadow-sm mb-8 transition-colors duration-300 card-hover">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="font-display font-bold text-lg text-slate-900 dark:text-white">
            {t('7-Day Activity Summary', 'Σύνοψη 7 Ημερών')}
          </h3>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-0.5">{t('Study time and task completion progress.', 'Χρόνος μελέτης και πρόοδος εργασιών.')}</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center">
              <Clock className="w-4 h-4 text-indigo-500" />
            </div>
            <div>
              <div className="text-xs text-slate-500 dark:text-slate-400">{t('Avg Time', 'Μέσος Χρόνος')}</div>
              <div className="text-sm font-bold text-slate-900 dark:text-white">
                {loading ? '…' : `${avgFocus}m / day`}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            </div>
            <div>
              <div className="text-xs text-slate-500 dark:text-slate-400">{t('Avg Completion', 'Μέση Ολοκλήρωση')}</div>
              <div className="text-sm font-bold text-slate-900 dark:text-white">
                {loading ? '…' : `${avgCompletion}%`}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="h-64 w-full">
        {loading ? (
          <div className="h-full w-full animate-pulse bg-slate-100 dark:bg-slate-800 rounded-xl" />
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={analyticsData} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="colorFocusTime" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorCompletionRate" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" opacity={0.2} />
              <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} dy={10} />
              <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
              <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
              <Tooltip
                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                wrapperClassName="dark:!bg-slate-800 dark:!text-slate-200 !bg-white !text-slate-900"
              />
              <Legend verticalAlign="top" height={36} />
              <Area
                yAxisId="left"
                type="monotone"
                name="Study Time (mins)"
                dataKey="focusTime"
                stroke="#6366f1"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorFocusTime)"
              />
              <Area
                yAxisId="right"
                type="monotone"
                name="Completion Rate (%)"
                dataKey="completionRate"
                stroke="#10b981"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorCompletionRate)"
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
