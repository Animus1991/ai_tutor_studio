import { Play, Pause } from 'lucide-react';
import { useStore } from '../store/useStore';
import { cn } from '../lib/utils';

export default function CompactPomodoroTimer() {
  const { timerTimeLeft, timerIsActive, timerMode, setTimerIsActive } = useStore();

  const toggleTimer = () => setTimerIsActive(!timerIsActive);
  
  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-200/60 dark:border-slate-700">
      <div className={cn("text-sm font-mono font-bold tracking-tight w-[45px]", timerMode === 'focus' ? "text-indigo-600 dark:text-indigo-400" : "text-amber-500")}>
        {formatTime(timerTimeLeft)}
      </div>
      <div className="w-px h-4 bg-slate-200 dark:bg-slate-700" />
      <button onClick={toggleTimer} className="text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors">
        {timerIsActive ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
      </button>
    </div>
  );
}
