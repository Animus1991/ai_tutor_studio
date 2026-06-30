import { useState, useEffect } from "react";
import { X, CheckCircle2, Award, Clock, FileText, Zap } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { format, subMinutes } from "date-fns";

const mockActivities = [
  {
    id: 1,
    type: "milestone",
    title: "7 Day Streak! 🔥",
    description: "You've studied for 7 consecutive days.",
    timestamp: new Date(),
    icon: Award,
    color: "text-amber-500",
    bg: "bg-amber-50 dark:bg-amber-900/30",
  },
  {
    id: 2,
    type: "task",
    title: "Completed 'Read Chapter 4'",
    description: "Biology 101",
    timestamp: subMinutes(new Date(), 45),
    icon: CheckCircle2,
    color: "text-emerald-500",
    bg: "bg-emerald-50 dark:bg-emerald-900/30",
  },
  {
    id: 3,
    type: "focus",
    title: "Completed Pomodoro Session",
    description: "25 minutes of deep work",
    timestamp: subMinutes(new Date(), 120),
    icon: Clock,
    color: "text-indigo-500",
    bg: "bg-indigo-50 dark:bg-indigo-900/30",
  },
  {
    id: 4,
    type: "note",
    title: "Generated flashcards",
    description: "From 'Photosynthesis Summary'",
    timestamp: subMinutes(new Date(), 180),
    icon: Zap,
    color: "text-sky-500",
    bg: "bg-sky-50 dark:bg-sky-900/30",
  },
];

interface ActivityDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ActivityDrawer({ isOpen, onClose }: ActivityDrawerProps) {
  // In a real app, you would fetch activities from Firestore/localStorage here
  const [activities] = useState(mockActivities);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/20 dark:bg-slate-900/60 backdrop-blur-sm z-40"
            onClick={onClose}
          />
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed top-0 right-0 bottom-0 w-full md:w-96 bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 z-50 flex flex-col shadow-2xl"
          >
            <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-slate-800">
              <h2 className="font-display font-bold text-lg text-slate-900 dark:text-white flex items-center gap-2">
                <Clock className="w-5 h-5 text-indigo-500" />
                Recent Activity
              </h2>
              <button
                onClick={onClose}
                className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {activities.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-500 dark:text-slate-400 space-y-3">
                  <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center">
                    <Clock className="w-8 h-8 opacity-50" />
                  </div>
                  <p>No recent activity</p>
                </div>
              ) : (
                <div className="relative border-l-2 border-slate-100 dark:border-slate-800 ml-4 space-y-8 pb-8">
                  {activities.map((activity) => {
                    const Icon = activity.icon;
                    return (
                      <div key={activity.id} className="relative pl-6">
                        <div className={`absolute -left-[17px] top-1 w-8 h-8 rounded-full ${activity.bg} flex items-center justify-center border-4 border-white dark:border-slate-900 shadow-sm`}>
                          <Icon className={`w-3.5 h-3.5 ${activity.color}`} />
                        </div>
                        <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 p-4 rounded-xl shadow-sm hover:shadow-md transition-shadow">
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <h4 className="font-semibold text-sm text-slate-900 dark:text-white">
                              {activity.title}
                            </h4>
                            <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500 shrink-0 mt-0.5">
                              {format(activity.timestamp, 'h:mm a')}
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            {activity.description}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
