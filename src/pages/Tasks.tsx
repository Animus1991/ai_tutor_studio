import { useState, useEffect, FormEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Calendar,
  Clock,
  AlertTriangle,
  Target,
  Zap,
  CheckCircle2,
  Play,
  BookOpen,
  PenTool,
  Plus,
  Mic,
  Square,
  Download,
  GripVertical,
} from "lucide-react";
import { motion, AnimatePresence, Reorder } from "framer-motion";
import PomodoroTimer from "../components/PomodoroTimer";
import DailyGoalProgress from "../components/DailyGoalProgress";
import StudyTipsWidget from "../components/StudyTipsWidget";
import { useStore } from "../store/useStore";
import { xapi } from "../lib/xapiTracker";
import { auditLogger } from "../lib/auditLogger";
import { cn } from "../lib/utils";
import { auth, db } from "../lib/firebase";
import {
  collection,
  onSnapshot,
  query,
  setDoc,
  doc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  writeBatch,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { format, subDays } from "date-fns";
import { toast } from "sonner";

const mockAnalyticsData = Array.from({ length: 7 }).map((_, i) => ({
  date: format(subDays(new Date(), 6 - i), 'EEE'),
  focusTime: Math.floor(Math.random() * 120) + 30, // mins
  mastery: Math.floor(Math.random() * 40) + 50, // %
  completionRate: Math.floor(Math.random() * 30) + 70, // %
}));

import ActivityFeed from "../components/ActivityFeed";

import { calculateSM2 } from '../lib/sm2';
import { useDictation } from '../hooks/useDictation';
import confetti from 'canvas-confetti';

import DashboardStats from "../components/DashboardStats";

export default function Tasks() {
  const { pomodoroSessions } = useStore();
  const [isSyncingTasks, setIsSyncingTasks] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [tasks, setTasks] = useState<any[]>([]);
  const { isDictating, transcript, toggleDictation } = useDictation();
  const [taskNotes, setTaskNotes] = useState("");
  const [selectedTasks, setSelectedTasks] = useState<string[]>([]);
  const [isSelectionMode, setIsSelectionMode] = useState(false);

  const toggleTaskSelection = (taskId: string) => {
    setSelectedTasks(prev => 
      prev.includes(taskId) ? prev.filter(id => id !== taskId) : [...prev, taskId]
    );
  };

  const handleBulkDelete = async () => {
    if (!user || selectedTasks.length === 0) return;
    try {
      const batch = writeBatch(db);
      selectedTasks.forEach(taskId => {
        batch.delete(doc(db, "users", user.uid, "tasks", taskId));
      });
      await batch.commit();
      toast.success(`${selectedTasks.length} tasks deleted`);
      setSelectedTasks([]);
      setIsSelectionMode(false);
    } catch (e) {
      console.error(e);
      toast.error("Failed to delete tasks");
    }
  };

  useEffect(() => {
    if (transcript) {
      setTaskNotes((prev) => {
        const separator = prev && !prev.endsWith(' ') ? ' ' : '';
        return prev + separator + transcript;
      });
    }
  }, [transcript]);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        const q = query(collection(db, "users", currentUser.uid, "tasks"));
        const unsubscribeTasks = onSnapshot(
          q,
          (snapshot) => {
            let tasksData = snapshot.docs.map((doc) => ({
              id: doc.id,
              ...doc.data(),
            }));
            // Sort by order field if it exists
            tasksData.sort((a: any, b: any) => (a.order || 0) - (b.order || 0));
            setTasks(tasksData);
          },
          (error) => {
            console.error("Error fetching tasks:", error);
          },
        );
        return () => unsubscribeTasks();
      } else {
        setTasks([]);
      }
    });
    return () => unsubscribeAuth();
  }, []);

  const handleSyncGoogleTasks = async () => {
    try {
      setIsSyncingTasks(true);
      // Mock the sync delay
      await new Promise((resolve) => setTimeout(resolve, 1000));
      toast.success("Demo Tasks synced successfully!");
    } catch (err) {
      console.error(err);
      toast.error("Failed to sync tasks to Google Tasks.");
    } finally {
      setIsSyncingTasks(false);
    }
  };

  const [reviewTask, setReviewTask] = useState<any>(null);

  const handleReviewTask = async (task: any, quality: number) => {
    if (!user) return;
    try {
      const prevData = {
        repetition: task.repetition || 0,
        interval: task.interval || 1,
        easinessFactor: task.easeFactor || 2.5,
      };

      const newData = calculateSM2(quality, prevData);

      const nextReview = new Date();
      nextReview.setDate(nextReview.getDate() + newData.interval);

      await updateDoc(doc(db, "users", user.uid, "tasks", task.id.toString()), {
        repetition: newData.repetition,
        interval: newData.interval,
        easeFactor: newData.easinessFactor,
        nextReviewDate: nextReview.toISOString(),
        completed: quality >= 3 ? true : false,
      });
      setReviewTask(null);

      // Track via xAPI
      xapi.logLessonCompletion(
        user?.email || "current_user",
        task.id.toString(),
        task.title,
        quality >= 3
      );
      if (quality >= 3) {
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 }
        });
      }
    } catch (e) {
      console.error(e);
      toast.error("Failed to update task review.");
    }
  };

  const handleCompleteTask = async (task: any) => {
    if (task.type === "Review") {
      setReviewTask(task);
      return;
    }
    if (!user) return;
    try {
      await updateDoc(doc(db, "users", user.uid, "tasks", task.id.toString()), {
        completed: true,
      });
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 }
      });
    } catch (e) {
      console.error(e);
      toast.error("Failed to complete task.");
    }

    // Track via xAPI
    if (task.type === "Quiz Prep") {
      xapi.logQuizAttempt(
        user?.email || "current_user",
        task.id.toString(),
        task.title,
        85,
      );
    } else {
      xapi.logLessonCompletion(
        user?.email || "current_user",
        task.id.toString(),
        task.title,
        true,
      );
    }

    // Audit Log
    auditLogger.log(
      "ROLE_CHANGED",
      user?.email || "current_user",
      task.id.toString(),
      {
        title: task.title,
        action: "completed",
      },
    ); // Generic log
  };

  const exportSessionData = () => {
    const dataStr = JSON.stringify(tasks, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "memora_tasks_export.json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const [activeFilter, setActiveFilter] = useState("All");
  const [viewMode, setViewMode] = useState<"list" | "calendar">("list");
  const [isNewTaskModalOpen, setIsNewTaskModalOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const uniqueTags = Array.from(new Set(tasks.flatMap(t => t.tags || []))).filter(Boolean) as string[];
  const categories = Array.from(new Set(["All", "Reading", "Quiz Prep", "Review", ...uniqueTags]));

  useEffect(() => {
    if (location.state?.newTask) {
      setIsNewTaskModalOpen(true);
      navigate(location.pathname, { replace: true, state: {} });
    }

    const handleOpenModal = () => setIsNewTaskModalOpen(true);
    window.addEventListener("openNewTaskModal", handleOpenModal);

    return () =>
      window.removeEventListener("openNewTaskModal", handleOpenModal);
  }, [location, navigate]);

  const handleCreateTask = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) return toast.info("Please sign in to create a task.");

    const formData = new FormData(e.target as HTMLFormElement);
    const title = formData.get("title") as string;
    const type = formData.get("type") as string;
    const tagsInput = formData.get("tags") as string;
    const tagsArray = tagsInput ? tagsInput.split(',').map(t => t.trim()).filter(Boolean) : [];

    if (title) {
      try {
        const taskId = Date.now().toString();
        const nextReviewDate = new Date();
        nextReviewDate.setDate(nextReviewDate.getDate() + 1);

        await setDoc(doc(db, "users", user.uid, "tasks", taskId), {
          title,
          notes: taskNotes,
          course: "New Course",
          type: type || "Review",
          tags: tagsArray,
          time: "30 min",
          urgent: false,
          icon: "Target",
          color: "text-indigo-500",
          bg: "bg-indigo-50",
          completed: false,
          userId: user.uid,
          createdAt: serverTimestamp(),
          repetition: 0,
          interval: 1,
          easeFactor: 2.5,
          nextReviewDate: nextReviewDate.toISOString(),
        });
        setIsNewTaskModalOpen(false);
        setTaskNotes("");
      } catch (e) {
        console.error(e);
        toast.error("Failed to create task");
      }
    }
  };

  const filteredTasks =
    activeFilter === "All"
      ? tasks
      : tasks.filter((t) => t.type === activeFilter || (t.tags && t.tags.includes(activeFilter)));

  const getIcon = (iconName: string) => {
    switch (iconName) {
      case "AlertTriangle":
        return AlertTriangle;
      case "PenTool":
        return PenTool;
      case "BookOpen":
        return BookOpen;
      default:
        return Target;
    }
  };

  return (
    <div className="pb-16">
      <header className="mb-6 flex items-end justify-between">
        <div>
          <h2 className="text-xl md:text-2xl font-display font-bold text-slate-900 dark:text-white tracking-tight">
            Command Center
          </h2>
          <p className="text-slate-500 dark:text-slate-400 mt-1.5 text-sm max-w-xl leading-relaxed">
            Your adaptive study plan based on retention curves and upcoming
            goals.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={exportSessionData}
            className="hidden sm:flex items-center gap-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 px-3 py-1.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors font-medium text-xs shadow-sm"
          >
            <Download className="w-3.5 h-3.5" />
            Export
          </button>
          <button
            onClick={() => setIsNewTaskModalOpen(true)}
            className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg font-semibold text-sm transition-all shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">New Task</span>
          </button>
        </div>
      </header>

      <DashboardStats />

      {/* Focus Modes */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
        <button className="group relative overflow-hidden bg-slate-900 dark:bg-indigo-600 text-white p-5 rounded-2xl shadow-lg dark:shadow-[0_4px_14px_0_rgba(79,70,229,0.39)] hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300 text-left flex flex-col justify-between min-h-[140px]">
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          <Zap className="w-6 h-6 mb-3 text-indigo-400 dark:text-white relative z-10" />
          <div className="relative z-10">
            <h3 className="font-display font-bold text-base mb-1">
              Quick Session
            </h3>
            <p className="text-slate-400 dark:text-indigo-100 text-xs">
              15 min rapid review
            </p>
          </div>
        </button>

        <button className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/60 p-5 rounded-2xl shadow-sm hover:shadow-md hover:border-emerald-200 dark:hover:border-emerald-500/50 hover:-translate-y-0.5 transition-all duration-300 text-left flex flex-col justify-between min-h-[140px] group">
          <Target className="w-6 h-6 mb-3 text-emerald-500 dark:text-emerald-400 group-hover:scale-110 transition-transform duration-300" />
          <div>
            <h3 className="font-display font-bold text-base text-slate-900 dark:text-white mb-1">
              Deep Focus
            </h3>
            <p className="text-slate-500 dark:text-slate-400 text-xs">
              50 min deep learning
            </p>
          </div>
        </button>

        <button className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/60 p-5 rounded-2xl shadow-sm hover:shadow-md hover:border-amber-200 dark:hover:border-amber-500/50 hover:-translate-y-0.5 transition-all duration-300 text-left flex flex-col justify-between min-h-[140px] group">
          <AlertTriangle className="w-6 h-6 mb-3 text-amber-500 group-hover:scale-110 transition-transform duration-300" />
          <div>
            <h3 className="font-display font-bold text-base text-slate-900 dark:text-white mb-1">
              Danger Zone
            </h3>
            <p className="text-slate-500 dark:text-slate-400 text-xs">
              Review struggling concepts
            </p>
          </div>
        </button>

        <button className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/60 p-5 rounded-2xl shadow-sm hover:shadow-md hover:border-blue-200 dark:hover:border-blue-500/50 hover:-translate-y-0.5 transition-all duration-300 text-left flex flex-col justify-between min-h-[140px] group">
          <Calendar className="w-6 h-6 mb-3 text-blue-500 group-hover:scale-110 transition-transform duration-300" />
          <div>
            <h3 className="font-display font-bold text-base text-slate-900 dark:text-white mb-1">
              Exam Cram
            </h3>
            <p className="text-slate-500 dark:text-slate-400 text-xs">
              Prepare for upcoming test
            </p>
          </div>
        </button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 border-b border-slate-200/60 dark:border-slate-800/60 pb-3 gap-3">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-display font-bold text-slate-900 dark:text-white tracking-tight">
                Up Next
              </h3>
              <button
                onClick={handleSyncGoogleTasks}
                disabled={isSyncingTasks}
                className="px-3 py-1.5 bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-500/20 rounded-xl text-xs font-semibold hover:bg-blue-100 dark:hover:bg-blue-500/20 transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                <CheckCircle2 className="w-3 h-3" />{" "}
                {isSyncingTasks ? "Syncing..." : "Sync to Google Tasks"}
              </button>
              
              {isSelectionMode ? (
                <>
                  <button
                    onClick={handleBulkDelete}
                    disabled={selectedTasks.length === 0}
                    className="px-3 py-1.5 bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-500/20 rounded-xl text-xs font-semibold hover:bg-rose-100 dark:hover:bg-rose-500/20 transition-colors disabled:opacity-50"
                  >
                    Delete Selected ({selectedTasks.length})
                  </button>
                  <button
                    onClick={() => { setIsSelectionMode(false); setSelectedTasks([]); }}
                    className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setIsSelectionMode(true)}
                  className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                >
                  Select
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-2 items-center">
              <div className="flex bg-slate-100 dark:bg-slate-800 rounded-lg p-1 mr-2">
                <button
                  onClick={() => setViewMode("list")}
                  className={cn(
                    "px-3 py-1.5 rounded-md text-xs font-bold uppercase transition-colors",
                    viewMode === "list"
                      ? "bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-white"
                      : "text-slate-500 hover:text-slate-700",
                  )}
                >
                  List
                </button>
                <button
                  onClick={() => setViewMode("calendar")}
                  className={cn(
                    "px-3 py-1.5 rounded-md text-xs font-bold uppercase transition-colors",
                    viewMode === "calendar"
                      ? "bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-white"
                      : "text-slate-500 hover:text-slate-700",
                  )}
                >
                  Calendar
                </button>
              </div>
              {categories.map((category) => (
                <button
                  key={category}
                  onClick={() => setActiveFilter(category)}
                  className={`text-xs font-bold uppercase tracking-wider px-3 py-1.5 rounded-full transition-colors ${
                    activeFilter === category
                      ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                      : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                  }`}
                >
                  {category}
                </button>
              ))}
            </div>
          </div>

          {viewMode === "calendar" ? (
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 overflow-hidden">
              <div className="flex items-center justify-between mb-6">
                <h4 className="font-bold text-slate-700 dark:text-slate-200">
                  This Week
                </h4>
                <div className="flex gap-2">
                  <span className="w-2 h-2 rounded-full bg-amber-500 mt-1.5"></span>
                  <span className="text-xs text-slate-500">Urgent</span>
                </div>
              </div>
              <div className="relative border-l-2 border-slate-100 dark:border-slate-800 ml-4 pl-6 pb-4 space-y-8">
                {filteredTasks
                  .filter((t) => !t.completed)
                  .map((task, i) => {
                    const Icon = getIcon(task.icon);
                    return (
                      <div key={task.id} className="relative">
                        <div
                          className={cn(
                            "absolute -left-[35px] top-0 w-6 h-6 rounded-full border-4 border-white dark:border-slate-900 flex items-center justify-center",
                            task.bg,
                          )}
                        >
                          <div
                            className={cn(
                              "w-2 h-2 rounded-full",
                              task.urgent ? "bg-amber-500" : "bg-indigo-500",
                            )}
                          />
                        </div>
                        <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 border border-slate-100 dark:border-slate-700">
                          <div className="flex justify-between items-start">
                            <div>
                              <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 mb-1 block">
                                Today, {10 + i}:00 AM
                              </span>
                              <h5 className="font-bold text-slate-900 dark:text-white text-base">
                                {task.title}
                              </h5>
                              <p className="text-sm text-slate-500 mt-1">
                                {task.course}
                              </p>
                            </div>
                            <div
                              className={cn(
                                "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
                                task.bg,
                              )}
                            >
                              <Icon className={cn("w-4 h-4", task.color)} />
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          ) : (
            <Reorder.Group axis="y" values={filteredTasks} onReorder={async (newOrder) => {
              // Update local state by merging the reordered filtered tasks with the rest
              const newTasks = [...tasks];
              
              // We need to assign orders to newOrder items based on their position
              // Since newOrder only contains filtered tasks, they will simply have an incrementing order
              // Or better, just give them order values starting from 0 to N
              newOrder.forEach((task, index) => {
                const t = newTasks.find(t => t.id === task.id);
                if (t) t.order = index;
              });
              
              setTasks(newTasks.sort((a, b) => (a.order || 0) - (b.order || 0)));

              if (user) {
                const batch = writeBatch(db);
                newOrder.forEach((task, index) => {
                  batch.update(doc(db, "users", user.uid, "tasks", task.id.toString()), {
                    order: index
                  });
                });
                await batch.commit();
              }
            }} className="space-y-4 max-w-4xl">
              {filteredTasks.map((task, i) => {
                const Icon = getIcon(task.icon);
                if (task.completed) {
                  return (
                    <Reorder.Item
                      value={task}
                      dragListener={false}
                      key={task.id}
                      className="bg-slate-50/50 dark:bg-slate-900/30 border border-slate-200/40 dark:border-slate-800/40 p-4 rounded-2xl flex items-center justify-between opacity-60"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl flex items-center justify-center bg-slate-100 dark:bg-slate-800 shrink-0">
                          <CheckCircle2
                            className="w-5 h-5 md:w-6 md:h-6 text-slate-400 dark:text-slate-500"
                            strokeWidth={1.5}
                          />
                        </div>
                        <div>
                          <h4 className="font-display font-bold text-slate-500 dark:text-slate-400 text-base line-through">
                            {task.title}
                          </h4>
                          <p className="text-xs font-medium text-slate-400 dark:text-slate-500 mt-1">
                            Completed
                          </p>
                        </div>
                      </div>
                    </Reorder.Item>
                  );
                }

                return (
                  <Reorder.Item
                    value={task}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{
                      duration: 0.2,
                      ease: "easeOut",
                    }}
                    whileDrag={{ scale: 1.02, zIndex: 50 }}
                    key={task.id}
                    className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between hover:shadow-md hover:border-slate-300 dark:hover:border-slate-700 transition-all duration-300 group relative overflow-hidden"
                  >
                    {task.urgent && (
                      <div className="absolute left-0 top-0 bottom-0 w-1 bg-amber-500" />
                    )}

                    <div className="flex items-start sm:items-center gap-4 mb-3 sm:mb-0">
                      {isSelectionMode ? (
                        <input
                          type="checkbox"
                          checked={selectedTasks.includes(task.id)}
                          onChange={() => toggleTaskSelection(task.id)}
                          className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 mr-1"
                        />
                      ) : (
                        <div className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 cursor-grab active:cursor-grabbing px-2 py-3 -ml-2 shrink-0">
                          <GripVertical className="w-4 h-4" />
                        </div>
                      )}
                      <button
                        onClick={() => handleCompleteTask(task)}
                        aria-label={`Mark task ${task.title} as complete`}
                        className="group/btn relative shrink-0"
                      >
                        <div
                          className={`w-10 h-10 md:w-12 md:h-12 rounded-xl flex items-center justify-center border border-white/50 dark:border-white/5 shadow-inner transition-colors ${task.bg.replace("bg-", "dark:bg-").replace("50", "900/30")} ${task.bg} group-hover/btn:bg-emerald-50 dark:group-hover/btn:bg-emerald-900/30`}
                        >
                          <Icon
                            className={`w-4 h-4 md:w-5 md:h-5 transition-all ${task.color} group-hover/btn:scale-0 group-hover/btn:opacity-0 absolute`}
                            strokeWidth={1.5}
                          />
                          <CheckCircle2
                            className={`w-4 h-4 md:w-5 md:h-5 text-emerald-500 scale-0 opacity-0 transition-all group-hover/btn:scale-100 group-hover/btn:opacity-100 absolute`}
                            strokeWidth={2}
                          />
                        </div>
                      </button>
                      <div>
                        <h4 className="font-display font-bold text-slate-900 dark:text-white text-base leading-tight group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                          {task.title}
                        </h4>
                        <div className="flex flex-wrap items-center gap-2 mt-1.5">
                          <span className="text-xs font-semibold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-100/50 dark:border-indigo-800/50 px-2 py-0.5 rounded-md">
                            {task.course}
                          </span>
                          <span className="w-1 h-1 bg-slate-300 dark:bg-slate-600 rounded-full hidden sm:block"></span>
                          <span className="text-xs font-medium text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700/60 px-2 py-0.5 rounded-md">
                            {task.type}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-4 w-full sm:w-auto mt-3 sm:mt-0 pl-14 sm:pl-0">
                      {task.nextReviewDate ? (
                        <div className={cn("flex flex-col items-end gap-0.5 px-2.5 py-1 rounded-lg border", new Date(task.nextReviewDate) <= new Date() ? "bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-900/50 text-amber-700 dark:text-amber-400" : "bg-slate-50 dark:bg-slate-800 border-slate-100 dark:border-slate-700/50 text-slate-500 dark:text-slate-400")}>
                          <span className="text-[9px] font-bold uppercase tracking-wider">
                            {new Date(task.nextReviewDate) <= new Date() ? 'Review Due' : 'Next Review'}
                          </span>
                          <span className="text-xs font-bold font-mono">
                            {format(new Date(task.nextReviewDate), "MMM d, HH:mm")}
                          </span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800 px-2.5 py-1 rounded-lg border border-slate-100 dark:border-slate-700/50">
                          <Clock className="w-3.5 h-3.5" />
                          <span className="text-xs font-bold font-mono">
                            {task.time}
                          </span>
                        </div>
                      )}
                      
                      <button 
                        onClick={() => handleCompleteTask(task)}
                        aria-label={`Start task ${task.title}`}
                        className="bg-slate-900 dark:bg-indigo-600 hover:bg-slate-800 dark:hover:bg-indigo-700 hover:scale-105 active:scale-95 text-white w-10 h-10 rounded-xl flex items-center justify-center transition-all shadow-[0_4px_14px_0_rgba(15,23,42,0.39)] dark:shadow-[0_4px_14px_0_rgba(79,70,229,0.39)] shrink-0"
                      >
                        <Play className="w-4 h-4 ml-0.5" fill="currentColor" />
                      </button>
                    </div>
                  </Reorder.Item>
                );
              })}
            </Reorder.Group>
          )}
        </div>

        {/* Focus Timer & Stats Column */}
        <div className="space-y-6">
          <PomodoroTimer />

          <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 p-6 rounded-3xl shadow-sm transition-colors duration-300">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center">
                <Target className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              </div>
              <h3 className="font-display font-bold text-lg text-slate-900 dark:text-white">
                Learning Analytics
              </h3>
            </div>
            
            <div className="space-y-6">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-slate-500 dark:text-slate-400">Focus Time (Last 7 Days)</span>
                  <span className="text-xs font-bold text-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-1 rounded-md">+14%</span>
                </div>
                <div className="h-32 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={mockAnalyticsData} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorFocus" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" opacity={0.2} />
                      <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} dy={10} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} />
                      <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                      <Area type="monotone" dataKey="focusTime" stroke="#6366f1" strokeWidth={2} fillOpacity={1} fill="url(#colorFocus)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-slate-500 dark:text-slate-400">Knowledge Retention</span>
                  <span className="text-xs font-bold text-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 px-2 py-1 rounded-md">High</span>
                </div>
                <div className="h-32 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={mockAnalyticsData} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorMastery" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" opacity={0.2} />
                      <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} dy={10} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} />
                      <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                      <Area type="monotone" dataKey="mastery" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorMastery)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-slate-500 dark:text-slate-400">Task Completion Rate</span>
                  <span className="text-xs font-bold text-sky-500 bg-sky-50 dark:bg-sky-900/20 px-2 py-1 rounded-md">Trending Up</span>
                </div>
                <div className="h-32 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={mockAnalyticsData} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorCompletion" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" opacity={0.2} />
                      <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} dy={10} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} />
                      <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                      <Area type="monotone" dataKey="completionRate" stroke="#0ea5e9" strokeWidth={2} fillOpacity={1} fill="url(#colorCompletion)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </div>
          
          <DailyGoalProgress />
          
          <StudyTipsWidget />

          <ActivityFeed />
        </div>
      </div>

      <AnimatePresence>
        {isNewTaskModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-6"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl p-8 max-w-md w-full border border-slate-200/60 dark:border-slate-800/60 relative"
            >
              <button
                onClick={() => setIsNewTaskModalOpen(false)}
                className="absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors"
              >
                &times;
              </button>
              <h2 className="text-2xl font-display font-bold text-slate-900 dark:text-white mb-6">
                New Task
              </h2>
              <form onSubmit={handleCreateTask} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Task Title
                  </label>
                  <input
                    required
                    name="title"
                    type="text"
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
                    placeholder="e.g. Read chapter 5"
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                      Notes / Description
                    </label>
                    <button
                      type="button"
                      onClick={toggleDictation}
                      className={cn(
                        "p-1.5 rounded-lg transition-colors flex items-center gap-1.5 text-xs font-semibold",
                        isDictating 
                          ? "bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400" 
                          : "bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700"
                      )}
                    >
                      {isDictating ? (
                        <>
                          <Square className="w-3.5 h-3.5 fill-current" /> Stop Dictating
                        </>
                      ) : (
                        <>
                          <Mic className="w-3.5 h-3.5" /> Dictate
                        </>
                      )}
                    </button>
                  </div>
                  <textarea
                    name="notes"
                    value={taskNotes}
                    onChange={(e) => setTaskNotes(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors min-h-[100px] resize-y"
                    placeholder="Add details, or use dictation..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Type
                  </label>
                  <select
                    name="type"
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
                  >
                    {categories
                      .filter((c) => c !== "All")
                      .map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Tags (comma separated)
                  </label>
                  <input
                    name="tags"
                    type="text"
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
                    placeholder="e.g. Math, Urgent, Midterm"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full py-3 mt-4 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-colors"
                >
                  Add Task
                </button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {reviewTask && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-6"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl p-8 max-w-md w-full border border-slate-200/60 dark:border-slate-800/60 relative"
            >
              <button
                onClick={() => setReviewTask(null)}
                className="absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors"
              >
                &times;
              </button>
              <h2 className="text-2xl font-display font-bold text-slate-900 dark:text-white mb-2">
                Review: {reviewTask.title}
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
                How well did you remember this concept? This helps the Spaced Repetition System (SRS) schedule your next review.
              </p>
              
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => handleReviewTask(reviewTask, 1)}
                  className="p-4 rounded-xl border border-rose-200 dark:border-rose-900/50 bg-rose-50 dark:bg-rose-900/10 hover:bg-rose-100 dark:hover:bg-rose-900/30 text-rose-700 dark:text-rose-400 font-semibold transition-colors flex flex-col items-center gap-1"
                >
                  <span className="text-lg">😵</span>
                  Blackout
                </button>
                <button
                  onClick={() => handleReviewTask(reviewTask, 2)}
                  className="p-4 rounded-xl border border-orange-200 dark:border-orange-900/50 bg-orange-50 dark:bg-orange-900/10 hover:bg-orange-100 dark:hover:bg-orange-900/30 text-orange-700 dark:text-orange-400 font-semibold transition-colors flex flex-col items-center gap-1"
                >
                  <span className="text-lg">🤔</span>
                  Hard
                </button>
                <button
                  onClick={() => handleReviewTask(reviewTask, 4)}
                  className="p-4 rounded-xl border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50 dark:bg-emerald-900/10 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 font-semibold transition-colors flex flex-col items-center gap-1"
                >
                  <span className="text-lg">🙂</span>
                  Good
                </button>
                <button
                  onClick={() => handleReviewTask(reviewTask, 5)}
                  className="p-4 rounded-xl border border-blue-200 dark:border-blue-900/50 bg-blue-50 dark:bg-blue-900/10 hover:bg-blue-100 dark:hover:bg-blue-900/30 text-blue-700 dark:text-blue-400 font-semibold transition-colors flex flex-col items-center gap-1"
                >
                  <span className="text-lg">😎</span>
                  Easy
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
