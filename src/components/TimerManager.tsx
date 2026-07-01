import { toast } from 'sonner';
import { useEffect, useState } from "react";
import { useStore } from "../store/useStore";
import { Play, Pause, Coffee, Focus, Maximize2, Minimize2, RotateCcw, Settings2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "../lib/utils";

export default function TimerManager() {
  const {
    timerTimeLeft,
    timerIsActive,
    timerMode,
    setTimerTimeLeft,
    setTimerMode,
    setTimerIsActive,
    addPomodoroSession,
    focusDuration,
    breakDuration,
    setFocusDuration,
    setBreakDuration,
  } = useStore();

  const [isExpanded, setIsExpanded] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    if (
      "Notification" in window &&
      Notification.permission !== "granted" &&
      Notification.permission !== "denied"
    ) {
      Notification.requestPermission();
    }
  }, []);

  useEffect(() => {
    let interval: any = null;
    if (timerIsActive && timerTimeLeft > 0) {
      interval = setInterval(() => {
        setTimerTimeLeft((time: number) => time - 1);
      }, 1000);
    } else if (timerIsActive && timerTimeLeft === 0) {
      if (timerMode === "focus") {
        addPomodoroSession(focusDuration);
        setTimerMode("break");
        setTimerTimeLeft(breakDuration * 60);
        if ("Notification" in window && Notification.permission === "granted") {
          new Notification("Focus Session Complete!", {
            body: `Time for a ${breakDuration}-minute break. Great job!`,
          });
        }
      } else {
        setTimerMode("focus");
        setTimerTimeLeft(focusDuration * 60);
        if ("Notification" in window && Notification.permission === "granted") {
          new Notification("Break Complete!", {
            body: "Time to get back to focus.",
          });
        }
      }
      setTimerIsActive(false);
    }
    return () => clearInterval(interval);
  }, [
    timerIsActive,
    timerTimeLeft,
    timerMode,
    addPomodoroSession,
    setTimerTimeLeft,
    setTimerMode,
    setTimerIsActive,
    focusDuration,
    breakDuration,
  ]);

  const toggleTimer = () => setTimerIsActive(!timerIsActive);
  
  const switchMode = (mode: "focus" | "break") => {
    setTimerIsActive(false);
    setTimerMode(mode);
    setTimerTimeLeft(mode === "focus" ? focusDuration * 60 : breakDuration * 60);
  };
  
  const resetTimer = () => {
    setTimerIsActive(false);
    setTimerTimeLeft(timerMode === "focus" ? focusDuration * 60 : breakDuration * 60);
  };

  const handleDurationChange = (type: 'focus' | 'break', value: number) => {
    if (value < 1) return;
    if (type === 'focus') {
      setFocusDuration(value);
      if (timerMode === 'focus' && !timerIsActive) {
        setTimerTimeLeft(value * 60);
      }
    } else {
      setBreakDuration(value);
      if (timerMode === 'break' && !timerIsActive) {
        setTimerTimeLeft(value * 60);
      }
    }
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3 pointer-events-none">
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-3xl shadow-2xl shadow-indigo-500/10 pointer-events-auto flex flex-col w-[260px]"
          >
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-2">
                Session Timer
                <button onClick={() => setShowSettings(!showSettings)} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
                  <Settings2 className="w-3.5 h-3.5" />
                </button>
              </span>
              <div className="flex bg-slate-100 dark:bg-slate-800 rounded-lg p-0.5">
                <button
                  onClick={() => switchMode('focus')}
                  className={cn(
                    "p-1.5 rounded-md transition-colors",
                    timerMode === 'focus' ? "bg-white dark:bg-slate-700 shadow-sm" : "text-slate-500 dark:text-slate-400"
                  )}
                >
                  <Focus className="w-4 h-4 text-indigo-500" />
                </button>
                <button
                  onClick={() => switchMode('break')}
                  className={cn(
                    "p-1.5 rounded-md transition-colors",
                    timerMode === 'break' ? "bg-white dark:bg-slate-700 shadow-sm" : "text-slate-500 dark:text-slate-400"
                  )}
                >
                  <Coffee className="w-4 h-4 text-amber-500" />
                </button>
              </div>
            </div>
            
            {showSettings ? (
              <div className="mb-5 space-y-3 bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-100 dark:border-slate-700/50">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-slate-600 dark:text-slate-300">Focus (min)</label>
                  <input type="number" value={focusDuration} onChange={(e) => handleDurationChange('focus', parseInt(e.target.value) || 25)} className="w-16 px-2 py-1 text-sm bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded text-center focus:outline-none focus:ring-1 focus:ring-indigo-500" />
                </div>
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-slate-600 dark:text-slate-300">Break (min)</label>
                  <input type="number" value={breakDuration} onChange={(e) => handleDurationChange('break', parseInt(e.target.value) || 5)} className="w-16 px-2 py-1 text-sm bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded text-center focus:outline-none focus:ring-1 focus:ring-indigo-500" />
                </div>
                <button
                  onClick={() => {
                    const history = useStore.getState().studySessionsHistory;
                    if (history.length === 0) return toast.success('No history to export');
                    const csvContent = 'Date,Duration(min),Type\n' + history.map(h => `${new Date(h.date).toLocaleString()},${h.duration},${h.type}`).join('\n');
                    const blob = new Blob([csvContent], { type: 'text/csv' });
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = 'study_session_history.csv';
                    a.click();
                  }}
                  className="w-full mt-2 text-xs py-1.5 px-3 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 font-medium rounded hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors"
                >
                  Export History (CSV)
                </button>
              </div>
            ) : (
              <div className="text-5xl font-mono font-bold text-center tracking-tighter mb-5 text-slate-900 dark:text-white">
                {formatTime(timerTimeLeft)}
              </div>
            )}

            <div className="flex items-center gap-3">
              <button
                onClick={toggleTimer}
                className={cn(
                  "flex-1 h-12 rounded-xl flex items-center justify-center font-bold text-white transition-colors",
                  timerIsActive ? "bg-amber-500 hover:bg-amber-600" : "bg-indigo-600 hover:bg-indigo-700"
                )}
              >
                {timerIsActive ? (
                  <><Pause className="w-5 h-5 mr-1 fill-current" /> Pause</>
                ) : (
                  <><Play className="w-5 h-5 mr-1 fill-current" /> Start</>
                )}
              </button>
              <button
                onClick={resetTimer}
                className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
              >
                <RotateCcw className="w-5 h-5" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={cn(
          "h-14 rounded-2xl flex items-center gap-3 px-4 font-mono font-bold shadow-xl border pointer-events-auto transition-all",
          timerIsActive 
            ? "bg-white dark:bg-slate-900 border-indigo-200 dark:border-indigo-500/30 text-indigo-600 dark:text-indigo-400 shadow-indigo-500/20" 
            : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400"
        )}
      >
        <span className="text-lg w-[60px]">{formatTime(timerTimeLeft)}</span>
        <div className="w-px h-5 bg-slate-200 dark:bg-slate-700" />
        {timerMode === 'focus' ? <Focus className="w-5 h-5" /> : <Coffee className="w-5 h-5 text-amber-500" />}
      </button>
    </div>
  );
}
