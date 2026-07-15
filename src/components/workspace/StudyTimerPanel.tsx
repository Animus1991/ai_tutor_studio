import { useState, useEffect, useCallback, useRef } from 'react';
import { Play, Pause, RotateCcw, Coffee, Timer, Target, Bell } from 'lucide-react';
import { useLanguage } from '../../lib/i18n';
import { logActivity } from '../../lib/activity';
import WorkspaceToolHeader from './WorkspaceToolHeader';

type TimerMode = 'pomodoro' | 'short-break' | 'long-break' | 'exam-countdown' | 'stopwatch';

interface ModeConfig {
  label: string;
  labelEl: string;
  duration: number; // seconds, 0 = stopwatch
  icon: typeof Timer;
  color: string;
}

const MODES: Record<TimerMode, ModeConfig> = {
  pomodoro: { label: 'Pomodoro', labelEl: 'Pomodoro', duration: 25 * 60, icon: Timer, color: 'text-indigo-600' },
  'short-break': { label: 'Short Break', labelEl: 'Σύντομο Διάλειμμα', duration: 5 * 60, icon: Coffee, color: 'text-emerald-600' },
  'long-break': { label: 'Long Break', labelEl: 'Μεγάλο Διάλειμμα', duration: 15 * 60, icon: Coffee, color: 'text-purple-600' },
  'exam-countdown': { label: 'Exam Mode', labelEl: 'Λειτουργία Εξέτασης', duration: 90 * 60, icon: Target, color: 'text-rose-600' },
  stopwatch: { label: 'Stopwatch', labelEl: 'Χρονόμετρο', duration: 0, icon: Timer, color: 'text-amber-600' },
};

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function StudyTimerPanel() {
  const { t } = useLanguage();
  const [mode, setMode] = useState<TimerMode>('pomodoro');
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [sessions, setSessions] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);

  const config = MODES[mode];
  const isCountdown = config.duration > 0;
  const remaining = isCountdown ? Math.max(0, config.duration - elapsed) : elapsed;
  const progress = isCountdown && config.duration > 0 ? (elapsed / config.duration) * 100 : 0;
  const isComplete = isCountdown && elapsed >= config.duration;

  const start = useCallback(() => {
    if (isComplete) return;
    setRunning(true);
    startTimeRef.current = Date.now() - elapsed * 1000;
  }, [elapsed, isComplete]);

  const pause = useCallback(() => {
    setRunning(false);
  }, []);

  const reset = useCallback(() => {
    setRunning(false);
    setElapsed(0);
  }, []);

  const switchMode = useCallback((m: TimerMode) => {
    setRunning(false);
    setElapsed(0);
    setMode(m);
  }, []);

  useEffect(() => {
    if (!running) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }
    intervalRef.current = setInterval(() => {
      const now = Date.now();
      const newElapsed = Math.floor((now - startTimeRef.current) / 1000);
      setElapsed(newElapsed);

      if (isCountdown && newElapsed >= config.duration) {
        setRunning(false);
        setSessions((s) => s + 1);
        logActivity(`${config.label} completed`, 'study');
        // Play notification sound if available
        try { new Audio('/notification.mp3').play().catch(() => {}); } catch { /* optional notification sound */ }
      }
    }, 250);

    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [running, isCountdown, config.duration, config.label]);

  // Log session on unmount if running
  useEffect(() => {
    return () => {
      if (elapsed > 30) logActivity(`Study session: ${formatTime(elapsed)}`, 'study');
    };
  }, [elapsed]);

  const Icon = config.icon;

  return (
    <div className="flex flex-col h-full">
      <WorkspaceToolHeader toolId="timer" onReset={reset} />

      <div className="flex-1 flex flex-col items-center justify-center p-8">
        {/* Mode selector */}
        <div className="flex flex-wrap gap-1.5 mb-8 justify-center">
          {(Object.entries(MODES) as [TimerMode, ModeConfig][]).map(([key, cfg]) => (
            <button
              key={key}
              onClick={() => switchMode(key)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all duration-200 ${
                mode === key
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 border border-transparent'
              }`}
            >
              {t(cfg.label, cfg.labelEl)}
            </button>
          ))}
        </div>

        {/* Timer display */}
        <div className="relative w-52 h-52 mb-8">
          {/* Progress ring */}
          {isCountdown && (
            <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" className="text-slate-100 dark:text-slate-800" strokeWidth="4" />
              <circle
                cx="50" cy="50" r="45" fill="none" stroke="currentColor"
                className={config.color}
                strokeWidth="4"
                strokeLinecap="round"
                strokeDasharray={`${2 * Math.PI * 45}`}
                strokeDashoffset={`${2 * Math.PI * 45 * (1 - progress / 100)}`}
                style={{ transition: 'stroke-dashoffset 0.5s ease' }}
              />
            </svg>
          )}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className="w-10 h-10 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center mb-2">
              <Icon className={`w-5 h-5 ${config.color.replace('text-', 'text-')}`} />
            </div>
            <span className={`text-3xl font-display font-bold font-mono tabular-nums tracking-tight ${isComplete ? 'text-emerald-600 animate-pulse' : 'text-slate-900 dark:text-white'}`}>
              {formatTime(isCountdown ? remaining : elapsed)}
            </span>
            <span className="text-xs text-slate-500 mt-1.5 font-medium">{t(config.label, config.labelEl)}</span>
          </div>
        </div>

        {/* Controls */}
        <div className="flex gap-3">
          {!running ? (
            <button
              onClick={start}
              disabled={isComplete}
              className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold disabled:opacity-50 transition-all shadow-sm flex items-center gap-2"
            >
              <Play className="w-4 h-4" /> {t('Start', 'Έναρξη')}
            </button>
          ) : (
            <button
              onClick={pause}
              className="px-6 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-semibold transition-all shadow-sm flex items-center gap-2"
            >
              <Pause className="w-4 h-4" /> {t('Pause', 'Παύση')}
            </button>
          )}
          <button
            onClick={reset}
            className="px-4 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 transition-all"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>

        {/* Stats */}
        <div className="mt-8 flex gap-8 text-center">
          <div>
            <p className="text-2xl font-display font-bold text-slate-900 dark:text-white tabular-nums tracking-tight">{sessions}</p>
            <p className="text-xs text-slate-500 font-medium">{t('Sessions', 'Συνεδρίες')}</p>
          </div>
          <div>
            <p className="text-2xl font-display font-bold text-slate-900 dark:text-white tabular-nums tracking-tight">{formatTime(sessions * 25 * 60)}</p>
            <p className="text-xs text-slate-500 font-medium">{t('Total study', 'Συνολική μελέτη')}</p>
          </div>
        </div>

        {isComplete && (
          <div className="mt-6 flex items-center gap-2 text-emerald-600 dark:text-emerald-400 animate-bounce">
            <div className="w-6 h-6 rounded-lg bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center">
              <Bell className="w-3.5 h-3.5" />
            </div>
            <span className="text-sm font-display font-semibold tracking-tight">{t('Session complete!', 'Η συνεδρία ολοκληρώθηκε!')}</span>
          </div>
        )}
      </div>
    </div>
  );
}
