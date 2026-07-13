import { Play, Brain, Users, Upload, Calendar, Clock, ArrowRight, CheckCircle2, Download, GripHorizontal, Loader2, Flame, Target, Sparkles } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import MasteryDashboard from "../components/MasteryDashboard";
import DailyStreak from "../components/DailyStreak";
import DailyGoalRing from "../components/DailyGoalRing";
import TaskCompletionChart from "../components/TaskCompletionChart";
import StudyProgressChart from "../components/StudyProgressChart";
import AudioNoteRecorder from "../components/AudioNoteRecorder";
import OptimalStudyTimes from "../components/OptimalStudyTimes";
import FocusSession from "../components/FocusSession";
import Flashcards from "../components/Flashcards";
import StudyTimeChart from "../components/StudyTimeChart";
import StudyRoadmap from "../components/StudyRoadmap";
import ContinueStudyingCard from "../components/ContinueStudyingCard";
import LearningProfileInsights from "../components/LearningProfileInsights";
import { useState, useEffect } from "react";
import { auth, db } from "../lib/firebase";
import { collection, query, getDocs, limit, orderBy } from "firebase/firestore";
import localforage from "localforage";
import { format, isFuture, isToday, isTomorrow } from "date-fns";
import { toast } from "sonner";
import { cn } from "../lib/utils";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { getRecentActivity } from "../lib/activity";
import { isDemoModeActive, loadDemoTasks } from "../lib/demoStorage";
import PageShell from "../components/layout/PageShell";
import { CONTENT_GUTTER, CONTENT_GUTTER_NEG } from "../components/layout/pageLayout";
import { useLanguage } from '../lib/i18n';

function getGreeting(t: (en: string, el?: string) => string): string {
  const h = new Date().getHours();
  if (h < 5)  return t('Good night', 'Καλή νύχτα');
  if (h < 12) return t('Good morning', 'Καλημέρα');
  if (h < 17) return t('Good afternoon', 'Καλό απόγευμα');
  if (h < 21) return t('Good evening', 'Καλό βράδυ');
  return t('Good night', 'Καλή νύχτα');
}

export default function Dashboard() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [recentActivity, setRecentActivity] = useState<any[]>([]);
  const [upcomingTasks, setUpcomingTasks] = useState<any[]>([]);
  const [tasksDone, setTasksDone] = useState(0);
  const [completionRate, setCompletionRate] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  
  const [layoutOrder, setLayoutOrder] = useState(['stats', 'charts', 'actionable', 'tools']);

  useEffect(() => {
    const fetchData = async () => {
      let tasksData: any[] = [];
      if (isDemoModeActive()) {
        tasksData = await loadDemoTasks();
      } else if (auth.currentUser) {
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

      // Calculate tasks done and completion rate
      const completed = tasksData.filter(t => t.completed).length;
      setTasksDone(completed);
      setCompletionRate(tasksData.length > 0 ? Math.round((completed / tasksData.length) * 100) : 0);

      // Fetch AI logs as recent activity
      const logs = await getRecentActivity(10);
      const recentLogs = logs.map(log => ({
        id: log.id,
        title: log.title || "Activity logged",
        time: log.timestamp ? format(log.timestamp.toDate(), "MMM d, h:mm a") : "Recently",
        icon: log.type === "study" ? "Brain" : log.type === "collab" ? "Users" : log.type === "upload" ? "Upload" : "CheckCircle2",
      }));
      setRecentActivity(recentLogs);
      
      const storedLayout = await localforage.getItem<string[]>('dashboard-layout-order');
      if (storedLayout && storedLayout.length === 4) {
        setLayoutOrder(storedLayout);
      }

      // Simulate network loading for skeletons
      setTimeout(() => setLoading(false), 800);
    };
    fetchData();
  }, []);

  const handleDownloadReport = async () => {
    setIsExporting(true);
    const dashboardElement = document.getElementById('dashboard-content');
    if (!dashboardElement) {
      setIsExporting(false);
      return;
    }

    try {
      const canvas = await html2canvas(dashboardElement, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: document.documentElement.classList.contains('dark') ? '#0f172a' : '#f8fafc',
      });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`memora-study-report-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
      toast.success("Report downloaded successfully");
    } catch (err) {
      console.error("Failed to generate PDF", err);
      toast.error("Failed to generate PDF");
    } finally {
      setIsExporting(false);
    }
  };

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    
    const newOrder = Array.from(layoutOrder);
    const [reorderedItem] = newOrder.splice(result.source.index, 1);
    newOrder.splice(result.destination.index, 0, reorderedItem);
    
    setLayoutOrder(newOrder);
    localforage.setItem('dashboard-layout-order', newOrder);
  };

  const blocks: Record<string, React.ReactNode> = {
    stats: (
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <DailyStreak />
        <DailyGoalRing />
        
        <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/60 rounded-xl p-4 sm:p-5 shadow-sm flex flex-col justify-between print-break-inside-avoid card-hover">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-sky-50 dark:bg-sky-900/30 flex items-center justify-center text-sky-500 shrink-0">
              <Clock className="w-4 h-4" />
            </div>
            <h3 className="text-base font-semibold text-slate-900 dark:text-white tracking-tight">
              {t('Study Time', 'Χρόνος Μελέτης')}
            </h3>
          </div>
          {loading ? (
            <div className="animate-pulse">
              <div className="h-8 bg-slate-200 dark:bg-slate-700 w-16 rounded mb-2"></div>
              <div className="h-4 bg-slate-100 dark:bg-slate-800 w-24 rounded"></div>
            </div>
          ) : (
            <div className="flex-1 mt-2">
              <StudyTimeChart />
            </div>
          )}
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/60 rounded-xl p-4 sm:p-5 shadow-sm flex flex-col justify-between print-break-inside-avoid card-hover">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-500 shrink-0">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <h3 className="text-base font-semibold text-slate-900 dark:text-white tracking-tight">
              {t('Tasks Done', 'Ολοκληρωμένες Εργασίες')}
            </h3>
          </div>
          {loading ? (
            <div className="animate-pulse">
              <div className="h-8 bg-slate-200 dark:bg-slate-700 w-12 rounded mb-2"></div>
              <div className="h-4 bg-slate-100 dark:bg-slate-800 w-28 rounded"></div>
            </div>
          ) : (
            <div>
              <p className="text-2xl font-bold text-slate-900 dark:text-white mb-1 animate-count-up">{tasksDone}</p>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                  <div className="h-full rounded-full bg-emerald-500" style={{ width: `${completionRate}%`, animation: 'progress-fill .8s ease-out' }} />
                </div>
                <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 shrink-0">{completionRate}%</p>
              </div>
            </div>
          )}
        </div>
      </div>
    ),
    charts: (
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
        <div className="h-[320px] xl:col-span-8 print-expand print-break-inside-avoid">
          <StudyProgressChart />
        </div>
        <div className="h-[320px] xl:col-span-4 print-expand print-break-inside-avoid">
          <TaskCompletionChart />
        </div>
      </div>
    ),
    actionable: (
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-4">
        <div className="xl:col-span-1 h-[420px] md:h-[380px] print-expand print-break-inside-avoid">
          <ContinueStudyingCard />
        </div>
        <div className="xl:col-span-1 h-[420px] md:h-[380px] print-expand print-break-inside-avoid">
          <Flashcards />
        </div>
        
        {/* Upcoming Tasks */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/60 rounded-xl p-4 sm:p-5 shadow-sm xl:col-span-1 h-[420px] md:h-[380px] flex flex-col print-expand print-break-inside-avoid card-hover">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-slate-900 dark:text-white tracking-tight">
              {t('Upcoming Deadlines', 'Επερχόμενες Προθεσμίες')}
            </h3>
            <Link to="/tasks" className="text-indigo-600 dark:text-indigo-400 text-sm font-medium hover:underline">
              {t('View all', 'Προβολή όλων')}
            </Link>
          </div>
          
          <div className="flex-1 overflow-y-auto pr-1">
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
                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{task.course || 'Task'}</p>
                      </div>
                    </div>
                    <button className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 transition-colors">
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 gap-2">
                <div className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center">
                  <Calendar className="w-5 h-5 text-slate-300 dark:text-slate-600" />
                </div>
                <p className="text-sm text-slate-400 dark:text-slate-500">{t('No upcoming tasks.', 'Δεν υπάρχουν εκκρεμείς εργασίες.')}</p>
              </div>
            )}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/60 rounded-xl p-4 sm:p-5 shadow-sm xl:col-span-1 h-[420px] md:h-[380px] flex flex-col print-expand print-break-inside-avoid card-hover">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-slate-900 dark:text-white tracking-tight">
              {t('Recent Activity', 'Πρόσφατη Δραστηριότητα')}
            </h3>
          </div>
          
          <div className="flex-1 overflow-y-auto pr-1">
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
                      <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 dark:text-slate-400">
                        {activity.icon === 'Brain' && <Brain className="w-4 h-4" />}
                        {activity.icon === 'Users' && <Users className="w-4 h-4" />}
                        {activity.icon === 'Upload' && <Upload className="w-4 h-4" />}
                        {activity.icon === 'CheckCircle2' && <CheckCircle2 className="w-4 h-4" />}
                      </div>
                      <div>
                        <h4 className="text-sm font-medium text-slate-900 dark:text-white">{activity.title}</h4>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{activity.time}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 gap-2">
                <div className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center">
                  <Brain className="w-5 h-5 text-slate-300 dark:text-slate-600" />
                </div>
                <p className="text-sm text-slate-400 dark:text-slate-500">{t('No recent activity.', 'Δεν υπάρχει πρόσφατη δραστηριότητα.')}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    ),
    tools: (
      <>
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <div className="h-[420px] lg:col-span-1 print-expand print-break-inside-avoid">
          <StudyRoadmap />
        </div>
        <div className="space-y-4 lg:col-span-1 print-expand print-break-inside-avoid">
          <FocusSession />
        </div>
        <div className="space-y-4 lg:col-span-1 print-expand print-break-inside-avoid">
          <AudioNoteRecorder />
        </div>
        <div className="space-y-4 lg:col-span-1 print-expand print-break-inside-avoid">
          <OptimalStudyTimes />
        </div>
      </div>
      <div className="mt-4 print-expand print-break-inside-avoid">
        <LearningProfileInsights />
      </div>
      </>
    )
  };

  return (
    <PageShell className="flex flex-col min-h-full">
      <header className={cn(
        'bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-slate-200/60 dark:border-slate-800/60 sticky top-0 z-40 py-4 sm:py-5',
        CONTENT_GUTTER_NEG, CONTENT_GUTTER,
      )}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <p className="section-eyebrow mb-1">{t('Dashboard', 'Πίνακας Ελέγχου')}</p>
            <h1 className="text-xl sm:text-2xl font-display font-bold tracking-tight">
              <span className="text-slate-500 dark:text-slate-400 font-medium">{getGreeting(t)}, </span>
              <span className="bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent">Alex</span>
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              {tasksDone > 0
                ? t(`${tasksDone} tasks completed · ${completionRate}% on track`, `${tasksDone} εργασίες ολοκληρώθηκαν · ${completionRate}% σε πορεία`)
                : t("Here's your study overview.", 'Ιδού η επισκόπηση μελέτης σου.')}
            </p>
          </div>
          <div className="flex items-center gap-2.5">
            <button 
              onClick={handleDownloadReport}
              disabled={isExporting}
              className="flex items-center gap-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 text-slate-700 dark:text-slate-200 px-3.5 py-2 rounded-xl font-medium text-sm transition-colors shadow-sm disabled:opacity-50"
            >
              {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              <span className="hidden sm:inline">{isExporting ? t('Exporting...', 'Εξαγωγή...') : t('Download Report', 'Λήψη Αναφοράς')}</span>
            </button>
            <button 
              onClick={() => navigate('/agent')}
              className="flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white px-4 py-2.5 rounded-xl font-semibold text-sm transition-all shadow-md shadow-indigo-500/20 hover:shadow-lg hover:shadow-indigo-500/30"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              {t('Start Session', 'Έναρξη')}
            </button>
          </div>
        </div>

        {/* Quick Stat Pills */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <div className="stat-tile ux-stat-tile flex items-center gap-3">
            <Flame className="w-5 h-5 text-amber-500 shrink-0" />
            <div className="min-w-0">
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{t('Tasks Done', 'Ολοκληρωμένες')}</p>
              <p className="text-base font-bold text-slate-900 dark:text-white">{tasksDone}</p>
            </div>
          </div>
          <div className="stat-tile ux-stat-tile flex items-center gap-3">
            <Target className="w-5 h-5 text-emerald-500 shrink-0" />
            <div className="min-w-0">
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{t('Completion', 'Ολοκλήρωση')}</p>
              <p className="text-base font-bold text-slate-900 dark:text-white">{completionRate}%</p>
            </div>
          </div>
          <div className="stat-tile ux-stat-tile flex items-center gap-3">
            <Clock className="w-5 h-5 text-sky-500 shrink-0" />
            <div className="min-w-0">
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{t('Upcoming', 'Εκκρεμείς')}</p>
              <p className="text-base font-bold text-slate-900 dark:text-white">{upcomingTasks.length}</p>
            </div>
          </div>
          <div className="stat-tile ux-stat-tile flex items-center gap-3">
            <Sparkles className="w-5 h-5 text-violet-500 shrink-0" />
            <div className="min-w-0">
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{t('Activity', 'Δραστηριότητα')}</p>
              <p className="text-base font-bold text-slate-900 dark:text-white">{recentActivity.length}</p>
            </div>
          </div>
        </div>
      </header>
      
      <div id="dashboard-content" className="w-full min-h-0 flex-1">
        <DragDropContext onDragEnd={handleDragEnd}>
          <Droppable droppableId="dashboard-sections">
            {(provided) => (
              <div 
                {...provided.droppableProps}
                ref={provided.innerRef}
                className="space-y-6"
              >
                {layoutOrder.map((blockId, index) => (
                  <Draggable draggableId={blockId} index={index} key={blockId}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        className={`relative rounded-xl transition-shadow ${snapshot.isDragging ? 'shadow-2xl z-50 ring-2 ring-indigo-500/50 ring-offset-2 dark:ring-offset-slate-900 bg-white/50 dark:bg-slate-900/50 backdrop-blur' : ''}`}
                      >
                        <div
                          {...provided.dragHandleProps}
                          className={`absolute -left-5 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-slate-300 hover:text-slate-500 dark:text-slate-700 dark:hover:text-slate-400 cursor-grab active:cursor-grabbing transition-all opacity-0 hover:opacity-100 lg:opacity-50 lg:hover:opacity-100 hover:bg-slate-100 dark:hover:bg-slate-800 ${snapshot.isDragging ? 'opacity-100' : ''}`}
                          title={t('Drag to reorder', 'Σύρε για αναδιάταξη')}
                        >
                          <GripHorizontal className="w-5 h-5" />
                        </div>
                        {blocks[blockId]}
                      </div>
                    )}
                  </Draggable>
                ))}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>
      </div>
    </PageShell>
  );
}
