import { useState } from 'react';
import { useStore } from '../store/useStore';
import { Target, CheckCircle2, Edit2 } from 'lucide-react';
import confetti from 'canvas-confetti';

export default function DailyGoalProgress() {
  const { pomodoroSessions, dailyGoal, setDailyGoal } = useStore();
  const [isEditing, setIsEditing] = useState(false);
  const [newGoal, setNewGoal] = useState(dailyGoal.toString());
  
  // Each pomodoro session is typically 25 minutes of focus
  const currentMinutes = pomodoroSessions * 25;
  const progressPercent = Math.min(Math.round((currentMinutes / dailyGoal) * 100), 100);
  const isCompleted = currentMinutes >= dailyGoal;

  const handleSaveGoal = () => {
    const val = parseInt(newGoal, 10);
    if (!isNaN(val) && val > 0) {
      setDailyGoal(val);
      if (currentMinutes >= val) {
        confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
      }
    }
    setIsEditing(false);
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 p-6 rounded-3xl shadow-sm transition-colors duration-300">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-900/20 flex items-center justify-center">
          {isCompleted ? (
            <CheckCircle2 className="w-5 h-5 text-indigo-500" />
          ) : (
            <Target className="w-5 h-5 text-indigo-500" />
          )}
        </div>
        <div className="flex-1">
          <h3 className="font-display font-bold text-lg text-slate-900 dark:text-white flex items-center gap-2">
            Daily Goal
            {!isEditing && (
              <button onClick={() => setIsEditing(true)} className="text-slate-400 hover:text-slate-600 transition-colors">
                <Edit2 className="w-3 h-3" />
              </button>
            )}
          </h3>
          {isEditing ? (
            <div className="flex items-center gap-2 mt-1">
              <input
                type="number"
                value={newGoal}
                onChange={(e) => setNewGoal(e.target.value)}
                className="w-16 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-2 py-1 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
              <button onClick={handleSaveGoal} className="text-xs font-bold text-indigo-600 dark:text-indigo-400 px-2 py-1 bg-indigo-50 dark:bg-indigo-900/20 rounded">
                Save
              </button>
            </div>
          ) : (
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              {currentMinutes} / {dailyGoal} mins focus time
            </p>
          )}
        </div>
        <div className="text-right">
          <span className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
            {progressPercent}%
          </span>
        </div>
      </div>

      <div className="w-full h-3 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
        <div 
          className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-1000 ease-out"
          style={{ width: `${progressPercent}%` }}
        />
      </div>
      
      {isCompleted && (
        <p className="mt-4 text-sm text-emerald-600 dark:text-emerald-400 font-medium text-center bg-emerald-50 dark:bg-emerald-900/20 py-2 rounded-lg">
          Goal reached! Great work today.
        </p>
      )}
    </div>
  );
}
