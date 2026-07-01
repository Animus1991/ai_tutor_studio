import { useState, useEffect } from "react";
import localforage from 'localforage';
import {
  Upload,
  FileText,
  MoreHorizontal,
  Plus,
  Brain,
  Sparkles,
  Clock,
  TrendingUp,
  FolderOpen,
  Download,
  Image as ImageIcon,
  Mic,
  MicOff,
  CheckSquare,
  BookOpen,
} from "lucide-react";
import { format } from "date-fns";
import { useDictation } from "../hooks/useDictation";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "../lib/utils";
import KnowledgeGraph from "../components/KnowledgeGraph";
import StudyHoursChart from "../components/StudyHoursChart";
import TaskCompletionChart from "../components/TaskCompletionChart";
import TopicCompletionChart from "../components/TopicCompletionChart";
import MasteryDashboard from "../components/MasteryDashboard";
import DailyStreak from "../components/DailyStreak";
import SpacedRepetition from "../components/SpacedRepetition";
import DailyGoalProgress from "../components/DailyGoalProgress";
import GoalTracker from "../components/GoalTracker";
import D3ActivityChart from "../components/D3ActivityChart";
import ImageGeneratorModal from "../components/ImageGeneratorModal";
import DocumentWorkspace from "../components/DocumentWorkspace";
import { UserAchievements } from "../components/UserAchievements";
import PDFViewerModal from "../components/PDFViewerModal";
import { auth, db } from "../lib/firebase";
import {
  collection,
  onSnapshot,
  query,
  setDoc,
  doc,
  serverTimestamp,
  writeBatch,
  deleteDoc,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { toast } from "sonner";

export default function Library() {
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const [isWorkspaceOpen, setIsWorkspaceOpen] = useState(false);
  const [isPdfViewerOpen, setIsPdfViewerOpen] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<any>(null);
  const [isImportingClassroom, setIsImportingClassroom] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [courses, setCourses] = useState<any[]>([]);
  const [selectedCourses, setSelectedCourses] = useState<string[]>([]);
  const [isSelectionMode, setIsSelectionMode] = useState(false);

  const toggleCourseSelection = (courseId: string) => {
    setSelectedCourses(prev => 
      prev.includes(courseId) ? prev.filter(id => id !== courseId) : [...prev, courseId]
    );
  };

  const handleBulkDelete = async () => {
    if (!user || selectedCourses.length === 0) return;
    try {
      const batch = writeBatch(db);
      selectedCourses.forEach(courseId => {
        batch.delete(doc(db, "users", user.uid, "courses", courseId));
      });
      await batch.commit();
      toast.success(`${selectedCourses.length} courses deleted`);
      setSelectedCourses([]);
      setIsSelectionMode(false);
    } catch (e) {
      console.error(e);
      toast.error("Failed to delete courses");
    }
  };

  const { isDictating, toggleDictation, transcript } = useDictation();

  useEffect(() => {
    if (!isDictating && transcript.trim()) {
      localforage.getItem<string>("memora-doc-notes").then(notesStr => {
        const newSummary = `<p><strong>[Voice Note - ${format(new Date(), 'PP p')}]</strong><br/>${transcript}</p>`;
        localforage.setItem(
          "memora-doc-notes",
          JSON.stringify((notesStr || "").replace(/^"|"$/g, "") + newSummary)
        );
      });
    }
  }, [isDictating, transcript]);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        const q = query(collection(db, "users", currentUser.uid, "courses"));
        const unsubscribeCourses = onSnapshot(
          q,
          (snapshot) => {
            const coursesData = snapshot.docs.map((doc) => ({
              id: doc.id,
              ...doc.data(),
            }));
            setCourses(coursesData);
          },
          (error) => {
            console.error("Error fetching courses:", error);
          },
        );
        return () => unsubscribeCourses();
      } else {
        setCourses([]);
      }
    });
    return () => unsubscribeAuth();
  }, []);

  const handleImportClassroom = async () => {
    try {
      setIsImportingClassroom(true);
      if (!user) {
        toast.info("Please sign in to the platform first.");
        return;
      }
      
      await new Promise(r => setTimeout(r, 1000));
      const demoCourses = [
        { id: "demo-course-1", name: "Demo Course: Intro to Psychology" },
        { id: "demo-course-2", name: "Demo Course: Linear Algebra" }
      ];

      for (const c of demoCourses) {
        const courseId = c.id;
        await setDoc(doc(db, "users", user.uid, "courses", courseId), {
          title: c.name,
          progress: 0,
          documents: 0,
          lastActive: "Just now",
          color: "from-green-500 to-emerald-600",
          bg: "bg-green-50",
          userId: user.uid,
          createdAt: serverTimestamp(),
        });
      }
      toast.success("Successfully imported demo courses!");
    } catch (e) {
      console.error(e);
      toast.error("Failed to import demo courses");
    } finally {
      setIsImportingClassroom(false);
    }
  };

  const getExportData = async () => {
    // Collect courses
    const courseData = courses;

    // Collect tasks from local storage or Firestore
    let tasksData = [];
    if (user) {
      const q = query(collection(db, "users", user.uid, "tasks"));
      const snapshot = await import("firebase/firestore").then(m => m.getDocs(q));
      tasksData = snapshot.docs.map(doc => doc.data());
    } else {
      const storedTasksStr = await localforage.getItem<string>("memora-tasks");
      tasksData = storedTasksStr ? JSON.parse(storedTasksStr) : [];
    }

    // Attempt to get global notes if stored somewhere, but we'll export what we have (courses/tasks)
    return {
      courses: courseData,
      tasks: tasksData,
      stats: {
        currentStreak: 12,
        totalPomodoroSessions: 45,
        averageDailyStudyTime: 120,
        tasksCompletedThisWeek: 18
      }
    };
  };

  const handleExportJSON = async () => {
    const data = await getExportData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "study_progress_report.json");
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportMD = async () => {
    const data = await getExportData();
    const storedNotes = await localforage.getItem<string>("memora-doc-notes") || "";
    const cleanNotes = storedNotes.replace(/^"|"$/g, "").replace(/<[^>]+>/g, "\n"); // rough html to text

    const mdContent = [
      "# Study Progress Report\n",
      "## Courses",
      data.courses.map((c: any) => `- **${c.title}**: ${c.progress}% mastery (${c.documents} documents)`).join("\n"),
      "\n## Tasks",
      data.tasks.map((t: any) => `- [${t.completed ? 'x' : ' '}] **${t.title}** (${t.course}) - ${t.type} - ${t.time}`).join("\n"),
      "\n## Statistics",
      `- **Current Streak**: ${data.stats.currentStreak} days`,
      `- **Total Pomodoro Sessions**: ${data.stats.totalPomodoroSessions}`,
      `- **Average Daily Study Time**: ${data.stats.averageDailyStudyTime} mins`,
      `- **Tasks Completed this Week**: ${data.stats.tasksCompletedThisWeek}`,
      "\n## Captured Notes",
      cleanNotes.trim() ? cleanNotes : "No recent notes captured."
    ].join("\n");

    const blob = new Blob([mdContent], { type: "text/markdown;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "study_progress_report.md");
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportCSV = async () => {
    // Collect courses
    const courseHeaders = ["Course Title", "Mastery Progress (%)", "Documents"];
    const courseRows = courses.map(
      (row) => `"${row.title}",${row.progress},${row.documents}`,
    );

    // Collect tasks from local storage
    const storedTasksStr = await localforage.getItem<string>("memora-tasks");
    const storedTasks = storedTasksStr ? JSON.parse(storedTasksStr) : [];
    const taskHeaders = ["Task Title", "Course", "Type", "Time"];
    const taskRows = storedTasks.map(
      (t: any) => `"${t.title}","${t.course}","${t.type}","${t.time}"`,
    );

    // Mock streak and study stats
    const statsHeaders = ["Metric", "Value"];
    const statsRows = [
      '"Current Streak (Days)",12',
      '"Total Pomodoro Sessions",45',
      '"Average Daily Study Time (mins)",120',
      '"Tasks Completed this Week",18',
    ];

    const csvContent = [
      "--- COURSE PROGRESS ---",
      courseHeaders.join(","),
      ...courseRows,
      "",
      "--- TASK PROGRESS ---",
      taskHeaders.join(","),
      ...taskRows,
      "",
      "--- STUDY STATISTICS & STREAKS ---",
      statsHeaders.join(","),
      ...statsRows,
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "study_progress_report.csv");
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="pb-16">
      <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl p-3 mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-800 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
            <BookOpen className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-semibold text-emerald-900 dark:text-emerald-100 text-sm">
              Connect Google Classroom
            </h3>
            <p className="text-emerald-700 dark:text-emerald-300 text-xs mt-0.5">
              Import your syllabus, materials, and deadlines instantly.
            </p>
          </div>
        </div>
        <button
          onClick={handleImportClassroom}
          disabled={isImportingClassroom}
          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold transition-colors disabled:opacity-50"
        >
          {isImportingClassroom ? "Importing..." : "Import Courses"}
        </button>
      </div>

      <header className="mb-6 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-xl md:text-2xl font-display font-bold text-slate-900 dark:text-white tracking-tight">
            Library
          </h2>
          <p className="text-slate-500 dark:text-slate-400 mt-1.5 text-sm max-w-xl leading-relaxed">
            Upload your materials and let Memora build your adaptive knowledge
            graph.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 origin-right">
          <button
            onClick={() => {
              const input = document.createElement("input");
              input.type = "file";
              input.accept = "audio/*,video/*";
              input.onchange = (e: any) => {
                if (e.target.files && e.target.files[0]) {
                  const fileName = e.target.files[0].name;
                  toast.success(
                    `Started AI transcription for ${fileName}. A lecture summary will be added to your study notes when complete.`,
                  );
                  // Mock generation
                  setTimeout(() => {
                    localforage.getItem<string>("memora-doc-notes").then(notesStr => {
                      const newSummary = `<p><strong>[AI Transcription Summary: ${fileName}]</strong><br/>The lecture covered the fundamentals of the topic, outlining key definitions and providing real-world examples. It emphasized the importance of understanding the core concepts before moving to advanced topics.</p>`;
                      localforage.setItem(
                        "memora-doc-notes",
                        JSON.stringify(
                          (notesStr || "").replace(/^"|"$/g, "") + newSummary,
                        ),
                      );
                    });
                  }, 2000);
                }
              };
              input.click();
            }}
            className="px-3 py-2 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-lg font-medium text-xs hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors flex items-center gap-1.5"
          >
            <Mic className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Transcribe Media</span>
          </button>
          <button
            onClick={() => {
              const input = document.createElement("input");
              input.type = "file";
              input.accept = "image/*,video/*";
              input.onchange = () =>
                toast.success(
                  "Media analysis using Gemini Multimodal Vision API requires a backend storage solution. For this demo, imagine the media being analyzed and a summary added to your notes!",
                );
              input.click();
            }}
            className="px-3 py-2 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-lg font-medium text-xs hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors flex items-center gap-1.5"
          >
            <ImageIcon className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Analyze Media</span>
          </button>
          <button
            onClick={toggleDictation}
            className={cn(
              "px-3 py-2 border rounded-lg font-medium text-xs transition-colors flex items-center gap-1.5",
              isDictating 
                ? "bg-red-50 text-red-600 border-red-200 dark:bg-red-900/30 dark:border-red-800/50 dark:text-red-400" 
                : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700"
            )}
          >
            {isDictating ? <MicOff className="w-3.5 h-3.5 animate-pulse" /> : <Mic className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">{isDictating ? "Stop Dictation" : "Dictate Note"}</span>
          </button>
          <button
            onClick={() => setIsImageModalOpen(true)}
            className="px-3 py-2 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-lg font-medium text-xs hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors flex items-center gap-1.5"
          >
            <ImageIcon className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Generate Diagram</span>
          </button>
          <div className="relative group">
            <button className="px-3 py-2 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-lg font-medium text-xs hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors flex items-center gap-1.5">
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Export</span>
            </button>
            <div className="absolute right-0 mt-1 w-48 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
              <button
                onClick={handleExportMD}
                className="w-full text-left px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-medium first:rounded-t-lg"
              >
                Download Summary (MD)
              </button>
              <button
                onClick={handleExportCSV}
                className="w-full text-left px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs"
              >
                Export as CSV
              </button>
              <button
                onClick={handleExportJSON}
                className="w-full text-left px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs last:rounded-b-lg"
              >
                Export as JSON
              </button>
            </div>
          </div>
          <button className="group relative px-4 py-2 bg-slate-900 dark:bg-indigo-600 text-white rounded-lg font-medium text-sm shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 flex items-center gap-1.5 overflow-hidden">
            <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out"></div>
            <Upload className="w-4 h-4 relative z-10" />
            <span className="relative z-10">Upload</span>
          </button>
        </div>
      </header>

      {/* Bento Grid Layout */}
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-4 mb-8">
        {/* Main Upload / Hero Card */}
        <div
          onClick={() => setIsWorkspaceOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              setIsWorkspaceOpen(true);
            }
          }}
          role="button"
          tabIndex={0}
          aria-label="Open document workspace"
          className="xl:col-span-2 relative overflow-hidden bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/60 rounded-2xl p-6 shadow-sm group hover:border-indigo-300 dark:hover:border-indigo-500/50 transition-colors cursor-pointer"
        >
          <div className="absolute top-0 right-0 p-6 opacity-10 dark:opacity-5 pointer-events-none">
            <Brain className="w-40 h-40 text-indigo-600 dark:text-white rotate-12 transform scale-[1.1]" />
          </div>
          <div className="relative z-10 flex flex-col h-full justify-between min-h-[200px]">
            <div>
              <div className="bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-100 dark:border-indigo-800/50 w-10 h-10 rounded-xl flex items-center justify-center mb-4 shadow-inner">
                <FileText className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              </div>
              <h3 className="text-lg font-display font-bold text-slate-900 dark:text-white mb-1.5">
                Initialize Workspace
              </h3>
              <p className="text-slate-500 dark:text-slate-400 text-sm max-w-sm leading-relaxed">
                Drag and drop PDFs, slides, lecture transcripts, or images.
                Memora's AI pipeline will extract concepts and map prerequisites
                instantly.
              </p>
            </div>
            <div className="mt-6 flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-medium text-sm">
              <span className="flex items-center gap-1.5 bg-indigo-50 dark:bg-indigo-900/30 px-3 py-1.5 rounded-lg">
                <Sparkles className="w-3.5 h-3.5" /> Drop files here or browse
              </span>
            </div>
          </div>
        </div>

        {/* Stats Card */}
        <div className="bg-slate-900 dark:bg-slate-800 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden flex flex-col justify-between">
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/20 to-transparent pointer-events-none" />
          <div>
            <h3 className="text-slate-400 font-medium mb-1 text-sm">Total Mastery</h3>
            <div className="text-[20px] leading-none font-display font-bold tracking-tight">
              38
              <span className="text-slate-500 dark:text-slate-400 ml-1 text-sm">
                %
              </span>
            </div>
          </div>

          <div className="space-y-3 mt-6">
            <div className="bg-white/10 dark:bg-slate-900/50 rounded-xl p-3 backdrop-blur-sm border border-white/5 dark:border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FolderOpen className="w-4 h-4 text-indigo-300 dark:text-indigo-400" />
                <span className="text-xs font-medium">Active Courses</span>
              </div>
              <span className="font-bold font-mono text-xs">3</span>
            </div>
            <div className="bg-white/10 dark:bg-slate-900/50 rounded-xl p-3 backdrop-blur-sm border border-white/5 dark:border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-300 dark:text-emerald-400" />
                <span className="text-xs font-medium">Concepts Learned</span>
              </div>
              <span className="font-bold font-mono text-xs">142</span>
            </div>
          </div>
        </div>
        
        {/* Achievements Card */}
        <div className="xl:col-span-1">
          <UserAchievements />
        </div>
      </div>

      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <h3 className="text-lg font-display font-bold text-slate-900 dark:text-white tracking-tight">
            Your Courses
          </h3>
          {isSelectionMode ? (
            <div className="flex gap-2">
              <button
                onClick={handleBulkDelete}
                disabled={selectedCourses.length === 0}
                className="px-2 py-1 bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-500/20 rounded-lg text-xs font-semibold hover:bg-rose-100 dark:hover:bg-rose-500/20 transition-colors disabled:opacity-50"
              >
                Delete Selected ({selectedCourses.length})
              </button>
              <button
                onClick={() => { setIsSelectionMode(false); setSelectedCourses([]); }}
                className="px-2 py-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setIsSelectionMode(true)}
              className="px-2 py-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
            >
              Select
            </button>
          )}
        </div>
        <button className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 font-medium text-xs transition-colors">
          View all
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {courses.map((course, index) => (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1, duration: 0.4, ease: "easeOut" }}
            key={course.id}
            role="button"
            tabIndex={0}
            aria-label={`View details for ${course.title || 'course'}`}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                setIsWorkspaceOpen(true);
              }
            }}
            onClick={() => setIsWorkspaceOpen(true)}
            className="bg-white dark:bg-slate-900 rounded-2xl p-5 shadow-sm border border-slate-200/60 dark:border-slate-800/60 hover:shadow-lg hover:shadow-slate-200/50 dark:hover:shadow-indigo-900/20 hover:-translate-y-1 transition-all duration-300 cursor-pointer group flex flex-col justify-between"
          >
            <div>
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                  {isSelectionMode && (
                    <input
                      type="checkbox"
                      checked={selectedCourses.includes(course.id)}
                      onChange={() => toggleCourseSelection(course.id)}
                      onClick={(e) => e.stopPropagation()}
                      className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                    />
                  )}
                  <div
                    className={cn(
                      "w-12 h-12 rounded-xl flex items-center justify-center border border-white/50 dark:border-white/10 shadow-inner",
                      course.bg,
                    )}
                  >
                    <Brain
                      className={cn("w-6 h-6 text-slate-800")}
                      strokeWidth={1.5}
                    />
                  </div>
                </div>
                <div className="flex gap-1.5">
                  <button
                    onClick={async (e) => {
                      e.stopPropagation();
                      try {
                        await new Promise(r => setTimeout(r, 500));
                        const mockUri = "https://docs.google.com/forms/d/demo-form-id/viewform";
                        window.open(mockUri, "_blank");
                      } catch (err) {
                        toast.error("Failed to generate form.");
                      }
                    }}
                    className="w-7 h-7 flex items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white transition-colors"
                    title="Generate Google Form Quiz"
                  >
                    <CheckSquare className="w-3.5 h-3.5" />
                  </button>
                  <button className="w-7 h-7 flex items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white transition-colors">
                    <MoreHorizontal className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <h4 className="text-base font-display font-bold text-slate-900 dark:text-white mb-2 leading-snug group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                {course.title}
              </h4>

              <div className="flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400 mb-6">
                <span className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800/50 px-2 py-1 rounded-md border border-slate-100 dark:border-slate-700/50">
                  <FileText className="w-3.5 h-3.5" /> {course.documents}{" "}
                  sources
                </span>
                <span className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" /> {course.lastActive}
                </span>
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs mb-2">
                <span className="font-medium text-slate-600 dark:text-slate-400">
                  Course Mastery
                </span>
                <span className="font-bold text-slate-900 dark:text-white">
                  {course.progress}%
                </span>
              </div>
              <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 overflow-hidden border border-slate-200/50 dark:border-slate-700/50 shadow-inner">
                <div
                  className={cn(
                    "h-full rounded-full bg-gradient-to-r transition-all duration-1000 ease-out",
                    course.color,
                  )}
                  style={{ width: `${course.progress}%` }}
                ></div>
              </div>
            </div>
          </motion.div>
        ))}

        {/* Add New Course Card */}
        <div className="border-2 border-dashed border-slate-200 dark:border-slate-700/60 rounded-2xl p-5 flex flex-col items-center justify-center text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/30 hover:border-slate-300 dark:hover:border-slate-600 hover:text-slate-900 dark:hover:text-white transition-all duration-300 cursor-pointer min-h-[220px] group">
          <div className="w-12 h-12 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl flex items-center justify-center mb-3 shadow-sm group-hover:scale-110 transition-transform duration-300">
            <Plus className="w-5 h-5" />
          </div>
          <span className="font-semibold text-sm">Create New Course</span>
          <span className="text-xs mt-1 opacity-70">
            Start from scratch or template
          </span>
        </div>
      </div>

      {/* Recent Documents Section */}
      <div className="mt-10 mb-8">
        <h3 className="text-lg font-display font-bold text-slate-900 dark:text-white tracking-tight mb-4">
          Recent Documents
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { id: 1, title: 'Calculus Notes Chapter 4', type: 'PDF', size: '2.4 MB', url: '/sample.pdf' },
            { id: 2, title: 'Biology Study Guide', type: 'PDF', size: '1.1 MB', url: '/sample.pdf' },
            { id: 3, title: 'Physics Formula Sheet', type: 'PDF', size: '500 KB', url: '/sample.pdf' },
            { id: 4, title: 'History Essay Draft', type: 'PDF', size: '3.2 MB', url: '/sample.pdf' },
          ].map(doc => (
            <div 
              key={doc.id}
              onClick={() => {
                setSelectedDocument(doc);
                setIsPdfViewerOpen(true);
              }}
              className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/60 rounded-xl p-3 flex items-center gap-3 cursor-pointer hover:shadow-sm hover:border-indigo-300 dark:hover:border-indigo-500/50 transition-all group"
            >
              <div className="w-10 h-10 bg-rose-50 dark:bg-rose-900/30 rounded-lg flex items-center justify-center text-rose-500 shrink-0 group-hover:scale-105 transition-transform">
                <FileText className="w-5 h-5" />
              </div>
              <div className="overflow-hidden">
                <h4 className="font-medium text-slate-900 dark:text-white text-sm truncate">{doc.title}</h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{doc.type} • {doc.size}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mt-12">
        <MasteryDashboard />
        <DailyStreak />
        <SpacedRepetition />
        <DailyGoalProgress />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
        <div className="md:col-span-1">
          <GoalTracker />
        </div>
        <div className="md:col-span-2">
          <D3ActivityChart />
        </div>
      </div>

      <div className="mt-12 grid grid-cols-1 lg:grid-cols-2 gap-6">
        <TaskCompletionChart />
        <TopicCompletionChart />
      </div>

      <div className="mt-12 grid grid-cols-1 lg:grid-cols-2 gap-6">
        <KnowledgeGraph />
        <StudyHoursChart />
      </div>

      <ImageGeneratorModal
        isOpen={isImageModalOpen}
        onClose={() => setIsImageModalOpen(false)}
      />
      
      {selectedDocument && (
        <PDFViewerModal
          isOpen={isPdfViewerOpen}
          onClose={() => {
            setIsPdfViewerOpen(false);
            setTimeout(() => setSelectedDocument(null), 300);
          }}
          documentUrl={selectedDocument.url}
          documentTitle={selectedDocument.title}
        />
      )}

      <AnimatePresence>
        {isWorkspaceOpen && (
          <DocumentWorkspace onClose={() => setIsWorkspaceOpen(false)} />
        )}
      </AnimatePresence>
    </div>
  );
}
