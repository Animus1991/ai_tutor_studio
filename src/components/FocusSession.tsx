import { useState, useEffect, useRef } from 'react';
import { Play, Square, Timer } from 'lucide-react';
import localforage from 'localforage';
import { toast } from 'sonner';

export default function FocusSession() {
  const [isActive, setIsActive] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (isActive) {
      intervalRef.current = setInterval(() => {
        setSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isActive]);

  const handleStart = () => {
    setIsActive(true);
    toast.success('Focus session started!');
  };

  const handleStop = async () => {
    setIsActive(false);
    if (seconds > 60) { // Only log if longer than 1 min
      const minutes = Math.floor(seconds / 60);
      try {
        const logs = await localforage.getItem<any[]>('memora-ai-logs') || [];
        logs.push({
          id: Date.now().toString(),
          title: `Completed ${minutes} min Focus Session`,
          time: new Date().toLocaleString(),
          icon: 'Timer'
        });
        await localforage.setItem('memora-ai-logs', logs);
        toast.success(`Session logged! You focused for ${minutes} minutes.`);
      } catch (e) {
        console.error('Failed to save session log', e);
      }
    } else {
       toast.info('Session ended. Too short to log.');
    }
    setSeconds(0);
  };

  const formatTime = (totalSeconds: number) => {
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/60 rounded-xl p-5 shadow-sm flex flex-col justify-between">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
          <Timer className="w-5 h-5" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white tracking-tight">
            Focus Session
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">Track your deep work</p>
        </div>
      </div>
      
      <div className="flex flex-col items-center justify-center flex-1 py-4">
        <div className="text-5xl font-mono font-bold text-slate-900 dark:text-white mb-6">
          {formatTime(seconds)}
        </div>
        
        {!isActive ? (
          <button
            onClick={handleStart}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-3 rounded-xl font-medium transition-colors shadow-sm"
          >
            <Play className="w-5 h-5" />
            Start Focusing
          </button>
        ) : (
          <button
            onClick={handleStop}
            className="flex items-center gap-2 bg-rose-500 hover:bg-rose-600 text-white px-8 py-3 rounded-xl font-medium transition-colors shadow-sm"
          >
            <Square className="w-5 h-5" />
            Stop Session
          </button>
        )}
      </div>
    </div>
  );
}
