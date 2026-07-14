import { useState, useEffect } from 'react';
import { Sparkles, Clock, Bell, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { useStore } from '../store/useStore';
import { predictOptimalStudyTime } from '../lib/studySessionAnalytics';
import { isDemoModeActive, loadDemoTasks } from '../lib/demoStorage';

export default function OptimalStudyTimes() {
  const [hasNotified, setHasNotified] = useState(false);
  const studySessionsHistory = useStore((s) => s.studySessionsHistory);
  const [optimalWindow, setOptimalWindow] = useState(() =>
    predictOptimalStudyTime(studySessionsHistory),
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let urgent = 0;
      if (isDemoModeActive()) {
        const tasks = await loadDemoTasks();
        urgent = tasks.filter((t) => t.urgent && !t.completed).length;
      }
      if (!cancelled) {
        setOptimalWindow(
          predictOptimalStudyTime(studySessionsHistory, { upcomingUrgentTasks: urgent }),
        );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [studySessionsHistory]);

  const enableNotifications = () => {
    if ('Notification' in window) {
      Notification.requestPermission().then((permission) => {
        if (permission === 'granted') {
          setHasNotified(true);
          toast.success('Study reminders enabled!');
          setTimeout(() => {
            new Notification('Optimal Study Time Approaching', {
              body: `Your focus is usually best around ${optimalWindow.label}. Ready for a session?`,
            });
          }, 5000);
        } else {
          toast.error('Notification permission denied');
        }
      });
    } else {
      toast.error('Notifications not supported in this browser');
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-indigo-200/60 dark:border-indigo-800/60 rounded-xl p-4 sm:p-5 shadow-sm h-full flex flex-col relative overflow-hidden group">
      <div className="absolute top-0 right-0 p-4 opacity-10">
        <Sparkles className="w-24 h-24 text-indigo-500" />
      </div>

      <div className="flex items-center gap-2 mb-4 relative z-10">
        <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-500 shrink-0">
          <Sparkles className="w-4 h-4" />
        </div>
        <h3 className="text-base font-semibold text-slate-900 dark:text-white tracking-tight">
          Smart Schedule
        </h3>
      </div>

      <div className="flex-1 relative z-10">
        <p className="text-sm text-slate-600 dark:text-slate-300 mb-4">
          Based on your past focus patterns and upcoming deadlines, your next optimal study window is:
        </p>

        <div className="flex items-center gap-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl p-4 border border-indigo-100 dark:border-indigo-800/50 mb-3">
          <Clock className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
          <div>
            <div className="text-xl font-bold text-indigo-900 dark:text-indigo-100">{optimalWindow.label}</div>
            <div className="text-xs font-medium text-indigo-600 dark:text-indigo-400 capitalize">
              {optimalWindow.confidence} confidence · Peak Focus Prediction
            </div>
          </div>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">{optimalWindow.reason}</p>
      </div>

      <button
        onClick={enableNotifications}
        disabled={hasNotified}
        className="w-full relative z-10 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-colors bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-80 disabled:hover:bg-indigo-600 disabled:cursor-not-allowed"
      >
        {hasNotified ? (
          <>
            <CheckCircle2 className="w-4 h-4" /> Reminders Active
          </>
        ) : (
          <>
            <Bell className="w-4 h-4" /> Remind Me Then
          </>
        )}
      </button>
    </div>
  );
}
