import { motion } from "framer-motion";
import { Award, Target, Flame, CheckCircle, Star } from "lucide-react";
import { cn } from "../lib/utils";

export function UserAchievements() {
  const achievements = [
    {
      id: "streak-7",
      title: "7-Day Streak",
      icon: Flame,
      color: "text-orange-500",
      bg: "bg-orange-50 dark:bg-orange-900/30",
      border: "border-orange-200 dark:border-orange-800/50",
      achieved: true,
    },
    {
      id: "tasks-10",
      title: "10 Tasks Completed",
      icon: CheckCircle,
      color: "text-emerald-500",
      bg: "bg-emerald-50 dark:bg-emerald-900/30",
      border: "border-emerald-200 dark:border-emerald-800/50",
      achieved: true,
    },
    {
      id: "mastery-50",
      title: "50% Mastery",
      icon: Target,
      color: "text-indigo-500",
      bg: "bg-indigo-50 dark:bg-indigo-900/30",
      border: "border-indigo-200 dark:border-indigo-800/50",
      achieved: false,
    },
    {
      id: "scholar",
      title: "Scholar",
      icon: Star,
      color: "text-amber-500",
      bg: "bg-amber-50 dark:bg-amber-900/30",
      border: "border-amber-200 dark:border-amber-800/50",
      achieved: false,
    }
  ];

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/60 rounded-3xl p-6 sm:p-8 shadow-sm h-full flex flex-col">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-900/30 flex items-center justify-center text-amber-500 shrink-0">
          <Award className="w-5 h-5" />
        </div>
        <h3 className="text-xl font-display font-bold text-slate-900 dark:text-white tracking-tight">
          Achievements
        </h3>
      </div>
      
      <div className="grid grid-cols-2 gap-4">
        {achievements.map((achievement) => (
          <div
            key={achievement.id}
            className={cn(
              "p-4 rounded-2xl border flex flex-col items-center justify-center text-center gap-2 transition-all duration-300",
              achievement.achieved 
                ? cn(achievement.bg, achievement.border) 
                : "bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-800 grayscale opacity-60"
            )}
          >
            <achievement.icon className={cn("w-8 h-8", achievement.achieved ? achievement.color : "text-slate-400")} strokeWidth={1.5} />
            <span className={cn(
              "text-xs font-semibold leading-tight",
              achievement.achieved ? "text-slate-900 dark:text-white" : "text-slate-500"
            )}>
              {achievement.title}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
