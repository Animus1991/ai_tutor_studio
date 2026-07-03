import { useState, useEffect } from "react";
import { CheckCircle2, Circle, Clock, ArrowRight, Map } from "lucide-react";

export default function StudyRoadmap() {
  const [loading, setLoading] = useState(true);

  // Mock milestones based on tasks
  const milestones = [
    { id: 1, title: 'Finish Chapter 4 Notes', status: 'completed', time: 'Mon, 10:00 AM' },
    { id: 2, title: 'Complete Practice Problems', status: 'completed', time: 'Tue, 2:30 PM' },
    { id: 3, title: 'Review Flashcards', status: 'active', time: 'Today, 5:00 PM' },
    { id: 4, title: 'Take Practice Quiz', status: 'pending', time: 'Tomorrow, 10:00 AM' },
    { id: 5, title: 'Final Review Session', status: 'pending', time: 'Friday, 1:00 PM' },
  ];

  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(false);
    }, 1200);
    return () => clearTimeout(timer);
  }, []);

  const total = milestones.length;
  const completed = milestones.filter(m => m.status === 'completed').length;
  const progressPercent = Math.round((completed / total) * 100);

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/60 rounded-xl p-5 shadow-sm h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-purple-50 dark:bg-purple-900/30 flex items-center justify-center text-purple-600 dark:text-purple-400">
            <Map className="w-4 h-4" />
          </div>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white tracking-tight">
            Study Roadmap
          </h3>
        </div>
        <span className="text-xs font-medium bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 px-2 py-1 rounded-md">
          {progressPercent}% Complete
        </span>
      </div>

      <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 mb-6 overflow-hidden">
        <div 
          className="h-full bg-purple-500 transition-all duration-1000 ease-out" 
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      <div className="flex-1 overflow-y-auto pr-2 relative">
        {loading ? (
          <div className="space-y-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex gap-4 animate-pulse">
                <div className="w-5 h-5 rounded-full bg-slate-200 dark:bg-slate-700 shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-3/4" />
                  <div className="h-3 bg-slate-100 dark:bg-slate-800 rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-0 relative before:absolute before:inset-0 before:ml-[11px] before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-200 dark:before:via-slate-700 before:to-transparent">
            {milestones.map((milestone, index) => (
              <div key={milestone.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active py-3">
                
                {/* Timeline Icon */}
                <div className="flex items-center justify-center w-6 h-6 rounded-full border-2 border-white dark:border-slate-900 bg-slate-200 dark:bg-slate-700 text-slate-500 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 relative z-10 
                  data-[status=completed]:bg-emerald-500 data-[status=completed]:text-white
                  data-[status=active]:bg-purple-500 data-[status=active]:text-white
                  data-[status=active]:ring-4 data-[status=active]:ring-purple-100 dark:data-[status=active]:ring-purple-900/50"
                  data-status={milestone.status}
                >
                  {milestone.status === 'completed' ? (
                    <CheckCircle2 className="w-3 h-3" />
                  ) : milestone.status === 'active' ? (
                    <ArrowRight className="w-3 h-3" />
                  ) : (
                    <Circle className="w-2 h-2 fill-current" />
                  )}
                </div>

                {/* Card */}
                <div className="w-[calc(100%-2.5rem)] md:w-[calc(50%-1.5rem)] p-3 rounded-lg border border-slate-100 dark:border-slate-700/50 bg-white dark:bg-slate-800/50 shadow-sm transition-all hover:shadow-md">
                  <h4 className="font-semibold text-sm text-slate-900 dark:text-white mb-1">{milestone.title}</h4>
                  <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                    <Clock className="w-3 h-3" />
                    <span>{milestone.time}</span>
                  </div>
                </div>

              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
