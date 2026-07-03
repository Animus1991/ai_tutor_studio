import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore } from '../store/useStore';
import { Play, Pause, X } from 'lucide-react';

export default function FocusModeOverlay() {
  const { 
    isFocusMode, 
    toggleFocusMode, 
    timerTimeLeft, 
    timerIsActive, 
    setTimerIsActive,
    timerMode,
    setTimerTimeLeft,
    focusDuration,
    breakDuration
  } = useStore();

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFocusMode) {
        toggleFocusMode();
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isFocusMode, toggleFocusMode]);

  return (
    <AnimatePresence>
      {isFocusMode && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[200] bg-slate-950 flex flex-col items-center justify-center overflow-hidden"
        >
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-black pointer-events-none"></div>
          
          <button
            onClick={toggleFocusMode}
            className="absolute top-6 right-6 p-3 rounded-full bg-white/5 text-white/50 hover:bg-white/10 hover:text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
          
          <div className="relative z-10 flex flex-col items-center gap-12">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              transition={{ delay: 0.1, duration: 0.5 }}
              className="text-center"
            >
              <h2 className="text-2xl font-medium text-white/60 tracking-widest uppercase mb-4">
                {timerMode === 'focus' ? 'Deep Focus' : 'Break Time'}
              </h2>
              <div className="text-[12rem] leading-none font-mono font-bold text-white tracking-tighter tabular-nums drop-shadow-2xl">
                {formatTime(timerTimeLeft)}
              </div>
            </motion.div>
            
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="flex items-center gap-6"
            >
              <button
                onClick={() => setTimerIsActive(!timerIsActive)}
                className="w-20 h-20 rounded-full flex items-center justify-center bg-white text-slate-950 hover:scale-105 transition-transform"
              >
                {timerIsActive ? <Pause className="w-8 h-8 fill-current" /> : <Play className="w-8 h-8 fill-current ml-2" />}
              </button>
              
              <button
                onClick={() => {
                  setTimerIsActive(false);
                  setTimerTimeLeft(timerMode === 'focus' ? focusDuration * 60 : breakDuration * 60);
                }}
                className="px-6 py-3 rounded-full bg-white/10 text-white font-medium hover:bg-white/20 transition-colors"
              >
                Reset Timer
              </button>
            </motion.div>
          </div>
          
          <div className="absolute bottom-12 text-white/40 text-sm font-medium tracking-wide">
            Press <kbd className="font-mono bg-white/10 px-2 py-1 rounded text-white/60 mx-1">Esc</kbd> to exit focus mode
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
