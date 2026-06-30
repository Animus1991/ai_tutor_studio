import { Activity, BookOpen, CheckSquare, MessageSquare } from 'lucide-react';
import { cn } from '../lib/utils';
import { format, subMinutes } from 'date-fns';

const mockActivities = [
  {
    id: 1,
    type: 'task',
    title: 'Completed "Review Macroeconomics"',
    time: subMinutes(new Date(), 12),
    icon: CheckSquare,
    color: 'text-emerald-500',
    bg: 'bg-emerald-50 dark:bg-emerald-900/20'
  },
  {
    id: 2,
    type: 'agent',
    title: 'Asked AI Tutor about "IS-LM Model"',
    time: subMinutes(new Date(), 45),
    icon: MessageSquare,
    color: 'text-indigo-500',
    bg: 'bg-indigo-50 dark:bg-indigo-900/20'
  },
  {
    id: 3,
    type: 'document',
    title: 'Uploaded "Econ Chapter 4.pdf"',
    time: subMinutes(new Date(), 120),
    icon: BookOpen,
    color: 'text-amber-500',
    bg: 'bg-amber-50 dark:bg-amber-900/20'
  }
];

export default function ActivityFeed() {
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 p-6 rounded-3xl shadow-sm transition-colors duration-300">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center">
          <Activity className="w-5 h-5 text-slate-600 dark:text-slate-400" />
        </div>
        <h3 className="font-display font-bold text-lg text-slate-900 dark:text-white">
          Recent Activity
        </h3>
      </div>
      
      <div className="relative">
        <div className="absolute top-0 bottom-0 left-[19px] w-px bg-slate-200 dark:bg-slate-700" />
        
        <div className="space-y-6">
          {mockActivities.map((activity) => (
            <div key={activity.id} className="relative flex gap-4">
              <div className={cn("w-10 h-10 rounded-full flex items-center justify-center shrink-0 border-4 border-white dark:border-slate-900 z-10", activity.bg)}>
                <activity.icon className={cn("w-4 h-4", activity.color)} />
              </div>
              <div className="pt-2">
                <p className="text-sm font-medium text-slate-900 dark:text-white">{activity.title}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{format(activity.time, "h:mm a")}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
