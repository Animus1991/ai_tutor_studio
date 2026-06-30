import { Play, Pause, RotateCcw, Coffee, Focus } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore } from '../store/useStore';
import { cn } from '../lib/utils';

export default function PomodoroTimer() {
  const { timerTimeLeft, timerIsActive, timerMode, setTimerIsActive, setTimerMode, setTimerTimeLeft } = useStore();

  const toggleTimer = () => setTimerIsActive(!timerIsActive);
  const resetTimer = () => {
    setTimerIsActive(false);
    setTimerMode('focus');
    setTimerTimeLeft(25 * 60);
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <motion.div 
      initial={{ scale: 0.95, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 p-8 rounded-3xl shadow-sm flex flex-col items-center justify-center relative overflow-hidden group transition-colors duration-300"
    >
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-transparent dark:from-indigo-500/10 pointer-events-none" />
      <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 dark:bg-indigo-500/10 rounded-full blur-3xl -mr-10 -mt-10" />
      
      <AnimatePresence mode="wait">
        <motion.h3 
          key={timerMode}
          initial={{ y: -10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 10, opacity: 0 }}
          className="text-xl font-display font-bold text-slate-900 dark:text-white mb-2 flex items-center gap-2 relative z-10"
        >
          {timerMode === 'focus' ? (
            <><Focus className="w-5 h-5 text-indigo-500" /> Focus Session</>
          ) : (
            <><Coffee className="w-5 h-5 text-amber-500" /> Break Time</>
          )}
        </motion.h3>
      </AnimatePresence>
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-8 relative z-10">Stay on task, build mastery.</p>
      
      <motion.div 
        animate={{ scale: timerIsActive ? 1.05 : 1 }}
        className="text-5xl font-mono font-bold text-slate-900 dark:text-white mb-10 tracking-tighter relative z-10"
      >
        {formatTime(timerTimeLeft)}
      </motion.div>
      
      <div className="flex items-center gap-4 relative z-10">
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={toggleTimer}
          className={cn("w-12 h-12 md:w-14 md:h-14 rounded-2xl flex items-center justify-center text-white transition-all shadow-[0_4px_14px_0_rgba(79,70,229,0.39)] hover:shadow-[0_6px_20px_rgba(79,70,229,0.23)]", timerIsActive ? "bg-amber-500 shadow-amber-500/30 hover:shadow-amber-500/40" : "bg-indigo-600")}
        >
          {timerIsActive ? <Pause className="w-5 h-5 md:w-6 md:h-6 fill-current" /> : <Play className="w-5 h-5 md:w-6 md:h-6 ml-1 fill-current" />}
        </motion.button>
        <motion.button
          whileHover={{ scale: 1.1, rotate: 180 }}
          whileTap={{ scale: 0.9 }}
          onClick={resetTimer}
          className="w-12 h-12 md:w-14 md:h-14 rounded-2xl flex items-center justify-center bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors border border-slate-200/50 dark:border-slate-700/50"
        >
          <RotateCcw className="w-5 h-5 md:w-6 md:h-6" />
        </motion.button>
      </div>
    </motion.div>
  );
}
