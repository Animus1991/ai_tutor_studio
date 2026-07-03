import { useState, useEffect } from 'react';
import { Target, Settings, Check } from 'lucide-react';
import localforage from 'localforage';
import { toast } from 'sonner';

export default function DailyGoalRing() {
  const [targetHours, setTargetHours] = useState(4);
  const [currentHours, setCurrentHours] = useState(2.5);
  const [isEditing, setIsEditing] = useState(false);
  const [tempHours, setTempHours] = useState(targetHours);

  useEffect(() => {
    localforage.getItem<number>('memora-daily-goal').then(val => {
      if (val) setTargetHours(val);
    });
  }, []);

  const handleSave = () => {
    setTargetHours(tempHours);
    localforage.setItem('memora-daily-goal', tempHours);
    setIsEditing(false);
    toast.success('Daily goal updated!');
  };

  const progress = Math.min((currentHours / targetHours) * 100, 100);
  const strokeWidth = 8;
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/60 rounded-xl p-4 sm:p-5 shadow-sm flex flex-col justify-between relative print-break-inside-avoid">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-900/30 flex items-center justify-center text-amber-500 shrink-0">
            <Target className="w-4 h-4" />
          </div>
          <h3 className="text-base font-semibold text-slate-900 dark:text-white tracking-tight">
            Daily Goal
          </h3>
        </div>
        {!isEditing && (
          <button onClick={() => setIsEditing(true)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 no-print">
            <Settings className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="flex items-center justify-center relative my-2">
        <svg width="100" height="100" className="transform -rotate-90">
          <circle
            cx="50"
            cy="50"
            r={radius}
            stroke="currentColor"
            strokeWidth={strokeWidth}
            fill="transparent"
            className="text-slate-100 dark:text-slate-800"
          />
          <circle
            cx="50"
            cy="50"
            r={radius}
            stroke="currentColor"
            strokeWidth={strokeWidth}
            fill="transparent"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            className="text-amber-500 transition-all duration-1000 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-lg font-bold text-slate-900 dark:text-white">{progress.toFixed(0)}%</span>
        </div>
      </div>

      {isEditing ? (
        <div className="flex items-center gap-2 mt-2 no-print">
          <input 
            type="number" 
            min="0.5" 
            max="24" 
            step="0.5"
            value={tempHours}
            onChange={(e) => setTempHours(Number(e.target.value))}
            className="w-16 px-2 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-sm text-center"
          />
          <span className="text-xs text-slate-500">hrs</span>
          <button onClick={handleSave} className="p-1.5 bg-indigo-100 text-indigo-600 rounded hover:bg-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-400">
            <Check className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <div className="text-center mt-1">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
            <span className="text-slate-900 dark:text-white font-semibold">{currentHours}h</span> / {targetHours}h today
          </p>
        </div>
      )}
    </div>
  );
}
