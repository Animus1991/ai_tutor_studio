import { motion } from "framer-motion";
import { Play, Calendar, Clock, ArrowRight, CheckCircle2 } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import MasteryDashboard from "../components/MasteryDashboard";
import DailyStreak from "../components/DailyStreak";
import TaskCompletionChart from "../components/TaskCompletionChart";
import StudyProgressChart from "../components/StudyProgressChart";
import AudioNoteRecorder from "../components/AudioNoteRecorder";
import FocusSession from "../components/FocusSession";
import { useState, useEffect } from "react";
import { auth, db } from "../lib/firebase";
import { collection, query, getDocs, limit, orderBy } from "firebase/firestore";
import localforage from "localforage";
import { format, isFuture, isToday, isTomorrow } from "date-fns";

export default function Dashboard() {
  const navigate = useNavigate();
  const [recentActivity, setRecentActivity] = useState<any[]>([]);
  const [upcomingTasks, setUpcomingTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      let tasksData: any[] = [];

      // Fetch tasks from Firebase if logged in
      if (auth.currentUser) {
        try {
          const tasksQ = query(collection(db, "users", auth.currentUser.uid, "tasks"));
          const tasksSnap = await getDocs(tasksQ);
          tasksData = tasksSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        } catch (e) {
          console.error("Failed to fetch tasks from Firebase", e);
        }
      } else {
        // Fetch from local storage if not logged in or as fallback
        const storedTasksStr = await localforage.getItem<string>("memora-tasks");
        if (storedTasksStr) {
          tasksData = JSON.parse(storedTasksStr);
        }
      }

      // Filter and sort upcoming tasks (incomplete)
      const incomplete = tasksData.filter(t => !t.completed);
      // For simplicity, we just take the first few as "upcoming"
      setUpcomingTasks(incomplete.slice(0, 4));

      // Fetch AI logs as recent activity
      const logs = await localforage.getItem<any[]>("memora-ai-logs") || [];
      const recentLogs = logs.slice(-3).reverse().map(log => ({
        id: log.id,
        title: "Chatted with Tutor AI",
        time: "Recently",
        icon: "Bot",
      }));
      setRecentActivity(recentLogs);
      
      // Simulate network loading for skeletons
      setTimeout(() => setLoading(false), 800);
    };

    fetchData();
  }, []);

  return (
    <div className="flex-1 overflow-y-auto">
      <header className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-slate-200/60 dark:border-slate-800/60 sticky top-0 z-40 px-4 sm:px-6 py-3 sm:py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-display font-bold text-slate-900 dark:text-white tracking-tight">
            Dashboard
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Welcome back! Here's your study overview.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => navigate('/agent')}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium text-sm transition-colors shadow-sm"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            Quick Start Session
          </button>
        </div>
      </header>

      <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
        
        {/* Quick Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <DailyStreak />
          
          <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/60 rounded-xl p-4 sm:p-5 shadow-sm flex flex-col justify-between">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-lg bg-sky-50 dark:bg-sky-900/30 flex items-center justify-center text-sky-500 shrink-0">
                <Clock className="w-4 h-4" />
              </div>
              <h3 className="text-base font-semibold text-slate-900 dark:text-white tracking-tight">
                Study Time
              </h3>
            </div>
            {loading ? (
              <div className="animate-pulse">
                <div className="h-8 bg-slate-200 dark:bg-slate-700 w-16 rounded mb-2"></div>
                <div className="h-4 bg-slate-100 dark:bg-slate-800 w-24 rounded"></div>
              </div>
            ) : (
              <div>
                <p className="text-2xl font-bold text-slate-900 dark:text-white mb-1">12.5h</p>
                <p className="text-xs font-medium text-sky-600 dark:text-sky-400">+2.5h from last week</p>
              </div>
            )}
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/60 rounded-xl p-4 sm:p-5 shadow-sm flex flex-col justify-between">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-500 shrink-0">
                <CheckCircle2 className="w-4 h-4" />
              </div>
              <h3 className="text-base font-semibold text-slate-900 dark:text-white tracking-tight">
                Tasks Done
              </h3>
            </div>
            {loading ? (
              <div className="animate-pulse">
                <div className="h-8 bg-slate-200 dark:bg-slate-700 w-12 rounded mb-2"></div>
                <div className="h-4 bg-slate-100 dark:bg-slate-800 w-28 rounded"></div>
              </div>
            ) : (
              <div>
                <p className="text-2xl font-bold text-slate-900 dark:text-white mb-1">24</p>
                <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400">80% completion rate</p>
              </div>
            )}
          </div>
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="h-[320px] lg:col-span-2">
            <StudyProgressChart />
          </div>
          <div className="h-[320px] lg:col-span-1">
            <TaskCompletionChart />
          </div>
        </div>

        {/* Actionable Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Upcoming Tasks */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/60 rounded-xl p-4 sm:p-5 shadow-sm lg:col-span-1">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white tracking-tight">
                Upcoming Deadlines
              </h3>
              <Link to="/tasks" className="text-indigo-600 dark:text-indigo-400 text-xs font-medium hover:underline">
                View all
              </Link>
            </div>
            
            {loading ? (
              <div className="space-y-3 animate-pulse">
                {[1, 2, 3].map(i => (
                  <div key={i} className="h-14 bg-slate-100 dark:bg-slate-800/50 rounded-lg"></div>
                ))}
              </div>
            ) : upcomingTasks.length > 0 ? (
              <div className="space-y-3">
                {upcomingTasks.map((task) => (
                  <div key={task.id} className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700/50">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                        <Calendar className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-sm font-medium text-slate-900 dark:text-white">{task.title}</h4>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400">{task.course || 'Task'}</p>
                      </div>
                    </div>
                    <button className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 transition-colors">
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6">
                <p className="text-sm text-slate-500 dark:text-slate-400">No upcoming tasks.</p>
              </div>
            )}
          </div>

          <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-4">
              <FocusSession />
              <AudioNoteRecorder />
            </div>
            
            {/* Recent Activity */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/60 rounded-xl p-4 sm:p-5 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white tracking-tight">
                  Recent Activity
                </h3>
              </div>
              
              {loading ? (
                <div className="space-y-3 animate-pulse">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="h-10 bg-slate-100 dark:bg-slate-800/50 rounded-lg"></div>
                  ))}
                </div>
              ) : recentActivity.length > 0 ? (
                <div className="space-y-3">
                  {recentActivity.map((activity, i) => (
                    <div key={i} className="flex items-center justify-between p-3 rounded-lg border border-slate-100 dark:border-slate-800 hover:border-slate-200 dark:hover:border-slate-700 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        <div>
                          <h4 className="text-xs font-medium text-slate-900 dark:text-white">{activity.title}</h4>
                          <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">{activity.time}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6">
                  <p className="text-sm text-slate-500 dark:text-slate-400">No recent activity.</p>
                </div>
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
