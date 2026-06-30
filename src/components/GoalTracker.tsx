import { useState } from 'react';
import { useStore } from '../store/useStore';
import { Target, Plus, CheckCircle2, Circle, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../lib/utils';

export default function GoalTracker() {
  const { customGoals, addCustomGoal, toggleCustomGoal, deleteCustomGoal } = useStore();
  const [newGoal, setNewGoal] = useState('');
  const [goalType, setGoalType] = useState<'daily' | 'weekly'>('daily');
  const [isAdding, setIsAdding] = useState(false);

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGoal.trim()) return;
    addCustomGoal(newGoal.trim(), goalType);
    setNewGoal('');
    setIsAdding(false);
  };

  const dailyGoals = customGoals.filter(g => g.type === 'daily');
  const weeklyGoals = customGoals.filter(g => g.type === 'weekly');

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 p-6 rounded-3xl shadow-sm transition-colors duration-300">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-900/20 flex items-center justify-center">
            <Target className="w-5 h-5 text-indigo-500" />
          </div>
          <div>
            <h3 className="font-display font-bold text-lg text-slate-900 dark:text-white">Study Goals</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">Track objectives</p>
          </div>
        </div>
        <button 
          onClick={() => setIsAdding(!isAdding)}
          className="p-2 bg-slate-100 dark:bg-slate-800 rounded-lg text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition-colors"
        >
          {isAdding ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
        </button>
      </div>

      <AnimatePresence>
        {isAdding && (
          <motion.form 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            onSubmit={handleAdd} 
            className="mb-4 overflow-hidden"
          >
            <div className="flex gap-2">
              <input 
                type="text" 
                value={newGoal}
                onChange={e => setNewGoal(e.target.value)}
                placeholder="New goal..." 
                className="flex-1 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                autoFocus
              />
              <select 
                value={goalType} 
                onChange={(e) => setGoalType(e.target.value as 'daily' | 'weekly')}
                className="text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-2 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
              </select>
            </div>
            <button type="submit" className="mt-2 w-full bg-indigo-600 text-white text-xs font-bold py-2 rounded-lg hover:bg-indigo-700 transition-colors">
              Add Goal
            </button>
          </motion.form>
        )}
      </AnimatePresence>

      <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2">
        {dailyGoals.length > 0 && (
          <div>
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Daily</h4>
            <div className="space-y-2">
              {dailyGoals.map(goal => (
                <div key={goal.id} className="group flex items-center justify-between p-2 hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded-lg transition-colors">
                  <div className="flex items-center gap-3">
                    <button onClick={() => toggleCustomGoal(goal.id)} className="text-slate-400 hover:text-indigo-500 transition-colors">
                      {goal.completed ? <CheckCircle2 className="w-5 h-5 text-indigo-500" /> : <Circle className="w-5 h-5" />}
                    </button>
                    <span className={cn("text-sm transition-all", goal.completed ? "text-slate-400 line-through" : "text-slate-700 dark:text-slate-300")}>
                      {goal.text}
                    </span>
                  </div>
                  <button onClick={() => deleteCustomGoal(goal.id)} className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500 transition-all p-1">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {weeklyGoals.length > 0 && (
          <div>
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Weekly</h4>
            <div className="space-y-2">
              {weeklyGoals.map(goal => (
                <div key={goal.id} className="group flex items-center justify-between p-2 hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded-lg transition-colors">
                  <div className="flex items-center gap-3">
                    <button onClick={() => toggleCustomGoal(goal.id)} className="text-slate-400 hover:text-indigo-500 transition-colors">
                      {goal.completed ? <CheckCircle2 className="w-5 h-5 text-indigo-500" /> : <Circle className="w-5 h-5" />}
                    </button>
                    <span className={cn("text-sm transition-all", goal.completed ? "text-slate-400 line-through" : "text-slate-700 dark:text-slate-300")}>
                      {goal.text}
                    </span>
                  </div>
                  <button onClick={() => deleteCustomGoal(goal.id)} className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500 transition-all p-1">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {customGoals.length === 0 && !isAdding && (
          <div className="text-center py-6 text-sm text-slate-400">
            No goals set. Add one to stay focused!
          </div>
        )}
      </div>
    </div>
  );
}
