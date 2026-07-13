import { useState, useEffect, useMemo } from "react";
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
  Globe,
  Target
} from "lucide-react";
import { format } from "date-fns";
import { useDictation } from "../hooks/useDictation";
import { useLanguage } from '../lib/i18n';
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
import Flashcards from "../components/Flashcards";
import WebClipperModal from "../components/WebClipperModal";
import ImageOcclusionModal from "../components/ImageOcclusionModal";
import FlashcardGeneratorModal from "../components/FlashcardGeneratorModal";
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
import { useNavigate } from "react-router-dom";
import { useLibraryStore } from "../store/useLibraryStore";
import PageShell from "../components/layout/PageShell";
import UploadCourseModal from "../components/UploadCourseModal";
import { useAuthStore } from "../store/useAuthStore";
import type { Course } from "../lib/courseTypes";
import { useStore } from "../store/useStore";
import { isDemoModeActive, loadDemoTasks } from "../lib/demoStorage";
import {
  buildLibraryExportStats,
  formatExportStatsCsvRows,
  formatExportStatsMarkdown,
} from "../lib/libraryExportStats";
import {
  classroomCourseToLocalCourse,
  fetchClassroomCourses,
} from "../lib/classroomService";
import { persistLibraryCourse } from "../lib/libraryStorage";
import { PIPELINE_VERSION } from "../lib/uploadPipeline";
import { downloadOfflineStudyPackFile, saveOfflineStudyPack } from "../lib/offlineStudyPack";
import type { UploadedFile } from "../lib/courseTypes";
import {
  transcribeMediaFile,
  analyzeMediaFile,
  appendToDocNotes,
  buildMediaSummaryHtml,
} from "../lib/mediaPipeline";

type DisplayCourse = {
  id: string;
  title: string;
  documents: number;
  lastActive: string;
  progress: number;
  color: string;
  bg: string;
  isMemoraCourse?: boolean;
};

function mapMemoraCourseToDisplay(mc: Course): DisplayCourse {
  return {
    id: mc.id,
    title: mc.title,
    documents: mc.uploadedFileIds?.length ?? 1,
    lastActive: "Recently",
    progress: mc.sourceQuality?.score ?? 42,
    color: "from-indigo-500 to-violet-600",
    bg: "bg-indigo-50",
    isMemoraCourse: true,
  };
}

export default function Library() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const isDemoMode = useAuthStore((s) => s.isDemoMode);
  const accessToken = useAuthStore((s) => s.accessToken);
  const { courses: memoraCourses, lastUploadQuality, hydrate: hydrateLibrary } = useLibraryStore();
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const [isWorkspaceOpen, setIsWorkspaceOpen] = useState(false);
  const [isPdfViewerOpen, setIsPdfViewerOpen] = useState(false);
  const [isWebClipperOpen, setIsWebClipperOpen] = useState(false);
  const [isImageOcclusionOpen, setIsImageOcclusionOpen] = useState(false);
  const [isFlashcardModalOpen, setIsFlashcardModalOpen] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<any>(null);
  const [isImportingClassroom, setIsImportingClassroom] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [courses, setCourses] = useState<any[]>([]);
  const [selectedCourses, setSelectedCourses] = useState<string[]>([]);
  const [isSelectionMode, setIsSelectionMode] = useState(false);

  const memoraCourseIds = useMemo(
    () => new Set(memoraCourses.map((c) => c.id)),
    [memoraCourses],
  );

  const displayCourses = useMemo((): DisplayCourse[] => {
    const fromLibrary = memoraCourses.map(mapMemoraCourseToDisplay);
    const firebaseCourses = courses
      .filter((c) => !memoraCourseIds.has(c.id))
      .map((c) => ({
        id: c.id,
        title: c.title ?? c.name ?? "Untitled",
        documents: c.documents ?? 0,
        lastActive: c.lastActive ?? "—",
        progress: c.progress ?? 0,
        color: c.color ?? "from-slate-500 to-slate-600",
        bg: c.bg ?? "bg-slate-50",
        isMemoraCourse: false,
      }));
    if (isDemoMode || fromLibrary.length > 0) {
      return [...fromLibrary, ...firebaseCourses];
    }
    return firebaseCourses.length > 0 ? firebaseCourses : fromLibrary;
  }, [memoraCourses, courses, memoraCourseIds, isDemoMode]);

  const openCourse = (course: DisplayCourse) => {
    if (course.isMemoraCourse || memoraCourseIds.has(course.id)) {
      navigate(`/study/${course.id}`);
    } else {
      setIsWorkspaceOpen(true);
    }
  };

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
      toast.success(t(`${selectedCourses.length} courses deleted`, `${selectedCourses.length} μαθήματα διαγράφηκαν`));
      setSelectedCourses([]);
      setIsSelectionMode(false);
    } catch (e) {
      console.error(e);
      toast.error(t('Failed to delete courses', 'Αποτυχία διαγραφής μαθημάτων'));
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
      if (!isDemoMode && !user) {
        toast.info("Please sign in to import from Google Classroom.");
        return;
      }

      const imported = await fetchClassroomCourses(accessToken, isDemoMode);

      if (isDemoMode) {
        for (const c of imported) {
          const course = classroomCourseToLocalCourse(c);
          const stubFile: UploadedFile = {
            id: `${course.id}-import`,
            name: `${c.name}.txt`,
            extractedText: course.topics[0]?.description ?? c.name,
            pipelineVersion: PIPELINE_VERSION,
            createdAt: new Date().toISOString(),
            courseId: course.id,
          };
          await persistLibraryCourse(course, stubFile);
        }
        await hydrateLibrary();
        toast.success(`Imported ${imported.length} Classroom course${imported.length === 1 ? '' : 's'} (demo).`);
        return;
      }

      for (const c of imported) {
        const courseId = `classroom-${c.id}`;
        await setDoc(doc(db, "users", user.uid, "courses", courseId), {
          title: c.section ? `${c.name} (${c.section})` : c.name,
          progress: 0,
          documents: 0,
          lastActive: "Just now",
          color: "from-green-500 to-emerald-600",
          bg: "bg-green-50",
          userId: user.uid,
          classroomId: c.id,
          createdAt: serverTimestamp(),
        });
      }
      toast.success(`Imported ${imported.length} course${imported.length === 1 ? '' : 's'} from Google Classroom.`);
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : "Failed to import Classroom courses");
    } finally {
      setIsImportingClassroom(false);
    }
  };

  const handleOfflinePack = async () => {
    try {
      const pack = await saveOfflineStudyPack();
      toast.success(`Offline pack cached (${pack.stats.courseCount} courses).`);
    } catch {
      toast.error("Failed to build offline study pack");
    }
  };

  const getExportData = async () => {
    const courseData = displayCourses.map((c) => ({
      id: c.id,
      title: c.title,
      progress: c.progress,
      documents: c.documents,
    }));

    let tasksData: Array<{ completed?: boolean; createdAt?: string; completedAt?: string; title?: string; course?: string; type?: string; time?: string }> = [];
    if (isDemoModeActive()) {
      tasksData = await loadDemoTasks();
    } else if (user) {
      const q = query(collection(db, "users", user.uid, "tasks"));
      const snapshot = await import("firebase/firestore").then((m) => m.getDocs(q));
      tasksData = snapshot.docs.map((doc) => doc.data());
    } else {
      const storedTasksStr = await localforage.getItem<string>("memora-tasks");
      tasksData = storedTasksStr ? JSON.parse(storedTasksStr) : [];
    }

    const {
      streak,
      streakFreezes,
      pomodoroSessions,
      studySessionsHistory,
      xp,
      dailyGoal,
    } = useStore.getState();

    const stats = buildLibraryExportStats(
      { streak, streakFreezes, pomodoroSessions, studySessionsHistory, xp, dailyGoal },
      tasksData,
    );

    return {
      courses: courseData,
      tasks: tasksData,
      stats,
      exportedAt: new Date().toISOString(),
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
      ...formatExportStatsMarkdown(data.stats),
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
    const data = await getExportData();

    const courseHeaders = ["Course Title", "Mastery Progress (%)", "Documents"];
    const courseRows = data.courses.map(
      (row) => `"${row.title}",${row.progress},${row.documents}`,
    );

    const taskHeaders = ["Task Title", "Course", "Type", "Time", "Completed"];
    const taskRows = data.tasks.map(
      (t) => `"${t.title ?? ''}","${t.course ?? ''}","${t.type ?? ''}","${t.time ?? ''}",${t.completed ? 'Yes' : 'No'}`,
    );

    const statsHeaders = ["Metric", "Value"];
    const statsRows = formatExportStatsCsvRows(data.stats);

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
    <PageShell className="pb-16 w-full">
      <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl p-3 mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-800 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
            <BookOpen className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-semibold text-emerald-900 dark:text-emerald-100 text-sm">
              {t('Connect Google Classroom', 'Σύνδεση Google Classroom')}
            </h3>
            <p className="text-emerald-700 dark:text-emerald-300 text-xs mt-0.5">
              {t('Import your syllabus, materials, and deadlines instantly.', 'Εισαγωγή ύλης, υλικού και προθεσμιών αμέσως.')}
            </p>
          </div>
        </div>
        <button
          onClick={handleImportClassroom}
          disabled={isImportingClassroom}
          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold transition-colors disabled:opacity-50"
        >
          {isImportingClassroom ? t('Importing...', 'Εισαγωγή...') : t('Import Courses', 'Εισαγωγή Μαθημάτων')}
        </button>
      </div>

      <header className="mb-6 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-xl md:text-2xl font-display font-bold text-slate-900 dark:text-white tracking-tight">
            {t('Library', 'Βιβλιοθήκη')}
          </h2>
          <p className="text-slate-500 dark:text-slate-400 mt-1.5 text-sm max-w-xl leading-relaxed">
            {t('Upload your materials and let Memora build your adaptive knowledge graph.', 'ανεβάστε το υλικό σας και αφήστε τον Memora να δημιουργήσει τον γνωστικό σας χάρτη.')}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 origin-right">
          {/* Media group */}
          <div className="flex items-center gap-1 bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/60 rounded-xl p-1">
            <button
              onClick={() => {
                const input = document.createElement("input");
                input.type = "file";
                input.accept = "audio/*,video/*";
                input.onchange = async (e: any) => {
                  const file = e.target.files?.[0] as File | undefined;
                  if (!file) return;
                  toast.loading(`Transcribing ${file.name}…`, { id: 'transcribe' });
                  try {
                    const summary = await transcribeMediaFile(file);
                    await appendToDocNotes(buildMediaSummaryHtml(`AI Transcription: ${file.name}`, summary));
                    toast.success('Transcription added to study notes', { id: 'transcribe' });
                  } catch {
                    await appendToDocNotes(buildMediaSummaryHtml(`Transcription: ${file.name}`, 'Audio received. Configure GEMINI_API_KEY for live Gemini transcription.'));
                    toast.success('Placeholder summary saved to notes', { id: 'transcribe' });
                  }
                };
                input.click();
              }}
              title={t('Transcribe Media', 'Μεταγραφή Μέσων')}
              className="px-3 py-2 text-slate-600 dark:text-slate-300 rounded-lg font-medium text-sm hover:bg-white dark:hover:bg-slate-700 hover:shadow-sm transition-all flex items-center gap-2"
            >
              <Mic className="w-3.5 h-3.5" />
              <span className="hidden lg:inline">{t('Transcribe', 'Μεταγραφή')}</span>
            </button>
            <button
              onClick={() => {
                const input = document.createElement("input");
                input.type = "file";
                input.accept = "image/*,video/*";
                input.onchange = async (e: any) => {
                  const file = (e.target as HTMLInputElement).files?.[0];
                  if (!file) return;
                  toast.loading(`Analyzing ${file.name}…`, { id: 'analyze-media' });
                  try {
                    const { summary } = await analyzeMediaFile(file);
                    await appendToDocNotes(buildMediaSummaryHtml(`Media Analysis: ${file.name}`, summary));
                    toast.success('Analysis added to study notes', { id: 'analyze-media' });
                  } catch {
                    toast.error('Live analysis needs GEMINI_API_KEY.', { id: 'analyze-media' });
                  }
                };
                input.click();
              }}
              title={t('Analyze Media', 'Ανάλυση Μέσων')}
              className="px-3 py-2 text-slate-600 dark:text-slate-300 rounded-lg font-medium text-sm hover:bg-white dark:hover:bg-slate-700 hover:shadow-sm transition-all flex items-center gap-2"
            >
              <ImageIcon className="w-3.5 h-3.5" />
              <span className="hidden lg:inline">{t('Analyze', 'Ανάλυση')}</span>
            </button>
            <button
              onClick={toggleDictation}
              title={isDictating ? t('Stop Dictation', 'Διακοπή Αυχνογράφησης') : t('Dictate Note', 'Υπαγόρευση Σημείωσης')}
              className={cn(
                "px-3 py-2 rounded-lg font-medium text-sm transition-all flex items-center gap-2",
                isDictating
                  ? "bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400 shadow-sm"
                  : "text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 hover:shadow-sm"
              )}
            >
              {isDictating ? <MicOff className="w-3.5 h-3.5 animate-pulse" /> : <Mic className="w-3.5 h-3.5" />}
              <span className="hidden lg:inline">{isDictating ? t('Stop', 'Διακοπή') : t('Dictate', 'Υπαγόρευση')}</span>
            </button>
          </div>

          {/* AI Tools group */}
          <div className="flex items-center gap-1 bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/60 rounded-xl p-1">
            <button
              onClick={() => setIsImageModalOpen(true)}
              title={t('Generate Diagram', 'Δημιουργία Διαγράμματος')}
              className="px-3 py-2 text-slate-600 dark:text-slate-300 rounded-lg font-medium text-sm hover:bg-white dark:hover:bg-slate-700 hover:shadow-sm transition-all flex items-center gap-2"
            >
              <ImageIcon className="w-3.5 h-3.5" />
              <span className="hidden lg:inline">{t('Diagram', 'Διάγραμμα')}</span>
            </button>
            <button
              onClick={() => setIsWebClipperOpen(true)}
              title={t('Web Clipper', 'Αποκοπή Ιστοσελίδας')}
              className="px-3 py-2 text-indigo-600 dark:text-indigo-400 rounded-lg font-medium text-sm hover:bg-indigo-50 dark:hover:bg-indigo-900/30 hover:shadow-sm transition-all flex items-center gap-2"
            >
              <Globe className="w-3.5 h-3.5" />
              <span className="hidden lg:inline">{t('Clipper', 'Αποκοπή')}</span>
            </button>
            <button
              onClick={() => setIsFlashcardModalOpen(true)}
              title={t('AI Flashcards', 'Κάρτες AI')}
              className="px-3 py-2 text-fuchsia-600 dark:text-fuchsia-400 rounded-lg font-medium text-sm hover:bg-fuchsia-50 dark:hover:bg-fuchsia-900/30 hover:shadow-sm transition-all flex items-center gap-2"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span className="hidden lg:inline">{t('Flashcards', 'Κάρτες')}</span>
            </button>
            <button
              onClick={() => setIsImageOcclusionOpen(true)}
              title={t('Image Occlusion', 'Απόκρυψη Εικόνας')}
              className="px-3 py-2 text-emerald-600 dark:text-emerald-400 rounded-lg font-medium text-sm hover:bg-emerald-50 dark:hover:bg-emerald-900/30 hover:shadow-sm transition-all flex items-center gap-2"
            >
              <Target className="w-3.5 h-3.5" />
              <span className="hidden lg:inline">{t('Occlusion', 'Απόκρυψη')}</span>
            </button>
          </div>

          {/* Export dropdown */}
          <div className="relative group">
            <button className="px-3 py-2.5 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-xl font-medium text-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors flex items-center gap-2 shadow-sm">
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{t('Export', 'Εξαγωγή')}</span>
            </button>
            <div className="absolute right-0 mt-1 w-52 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 overflow-hidden">
              <button onClick={handleExportMD} className="w-full text-left px-3 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-sm font-medium">{t('Download Summary (MD)', 'Λήψη Περίληψης (MD)')}</button>
              <button onClick={handleExportCSV} className="w-full text-left px-3 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-sm">{t('Export as CSV', 'Εξαγωγή ως CSV')}</button>
              <button onClick={handleExportJSON} className="w-full text-left px-3 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-sm">{t('Export as JSON', 'Εξαγωγή ως JSON')}</button>
              <button onClick={handleOfflinePack} className="w-full text-left px-3 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-sm">{t('Cache offline pack', 'Αποθήκευση offline')}</button>
              <button onClick={() => void downloadOfflineStudyPackFile()} className="w-full text-left px-3 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-sm">{t('Download offline pack', 'Λήψη offline pack')}</button>
            </div>
          </div>

          {/* Upload CTA */}
          <button
            onClick={() => setIsUploadModalOpen(true)}
            className="group relative px-4 py-2 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white rounded-xl font-semibold text-sm shadow-md shadow-indigo-500/25 hover:shadow-lg hover:shadow-indigo-500/30 hover:-translate-y-0.5 transition-all duration-200 flex items-center gap-1.5"
          >
            <Upload className="w-4 h-4" />
            <span>{t('Upload', 'Φόρτωση')}</span>
          </button>
        </div>
      </header>

      {/* Bento Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-6 xl:grid-cols-12 gap-4 mb-8">
        {/* Main Upload / Hero Card */}
        <div
          onClick={() => setIsUploadModalOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              setIsUploadModalOpen(true);
            }
          }}
          role="button"
          tabIndex={0}
          aria-label="Open document workspace"
          className="lg:col-span-3 xl:col-span-5 relative overflow-hidden bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/60 rounded-2xl p-6 shadow-sm group hover:border-indigo-300 dark:hover:border-indigo-500/50 transition-colors cursor-pointer"
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
                {t('Initialize Workspace', 'Εκκίνηση Χώρου Εργασίας')}
              </h3>
              <p className="text-slate-500 dark:text-slate-400 text-sm max-w-sm leading-relaxed">
                {t('Drag and drop PDFs, slides, lecture transcripts, or images. Memora’s AI pipeline will extract concepts and map prerequisites instantly.', 'Σύρε PDF, παρουσιάσεις, μεταγραφές ή εικόνες. Το AI εξάγει έννοιες αμέσως.')}
              </p>
            </div>
            <div className="mt-6 flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-medium text-sm">
              <span className="flex items-center gap-1.5 bg-indigo-50 dark:bg-indigo-900/30 px-3 py-1.5 rounded-lg">
                <Sparkles className="w-3.5 h-3.5" /> {t('Drop files here or browse', 'Σύρε εδώ ή αναζήτησε')}
              </span>
            </div>
          </div>
        </div>

        {/* Stats Card */}
        <div className="lg:col-span-2 xl:col-span-4 bg-slate-900 dark:bg-slate-800 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden flex flex-col justify-between">
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/20 to-transparent pointer-events-none" />
          <div>
            <h3 className="text-slate-400 font-medium mb-1 text-sm">{t('Total Mastery', 'Συνολική Εξοικείωση')}</h3>
            <div className="text-[19px] leading-none font-display font-bold tracking-tight">
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
                <span className="text-xs font-medium">{t('Active Courses', 'Ενεργά Μαθήματα')}</span>
              </div>
              <span className="font-bold font-mono text-xs">3</span>
            </div>
            <div className="bg-white/10 dark:bg-slate-900/50 rounded-xl p-3 backdrop-blur-sm border border-white/5 dark:border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-300 dark:text-emerald-400" />
                <span className="text-xs font-medium">{t('Concepts Learned', 'Όροι που Όροι που Μαθάνετε')}</span>
              </div>
              <span className="font-bold font-mono text-xs">142</span>
            </div>
          </div>
        </div>
        
        {/* Achievements Card */}
        <div className="lg:col-span-1 xl:col-span-3">
          <UserAchievements />
        </div>
      </div>

      {memoraCourses.length > 0 && (
        <>
          <div className="flex items-center justify-between mb-4 mt-8">
            <h3 className="text-lg font-display font-bold text-slate-900 dark:text-white">
              {t('AI-Generated Courses', 'Μαθήματα AI')}
            </h3>
            {lastUploadQuality && (
              <span className="text-xs text-slate-500">
                Last upload quality: {lastUploadQuality.score}/100 ({lastUploadQuality.band})
              </span>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5 mb-8">
            {memoraCourses.map((mc) => (
              <motion.div
                key={mc.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white dark:bg-slate-900 rounded-2xl border border-indigo-200/60 dark:border-indigo-800/40 shadow-sm hover:shadow-lg hover:shadow-indigo-500/10 hover:-translate-y-0.5 transition-all duration-300 overflow-hidden"
              >
                <div className="h-1.5 w-full bg-gradient-to-r from-indigo-500 via-violet-500 to-fuchsia-500" />
                <div className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-50 to-violet-50 dark:from-indigo-900/40 dark:to-violet-900/40 border border-indigo-100/60 dark:border-indigo-800/40 flex items-center justify-center">
                      <Sparkles className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                    </div>
                    {mc.sourceQuality && (
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-lg ${
                        mc.sourceQuality.band === 'strong' ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400' :
                        mc.sourceQuality.band === 'moderate' ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400' :
                        'bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400'
                      }`}>
                        {mc.sourceQuality.score}/100
                      </span>
                    )}
                  </div>
                  <h4 className="font-bold text-slate-900 dark:text-white mb-1 leading-snug">{mc.title}</h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">{mc.topics.length} {t('modules', 'ενότητες')} · {mc.glossary.length} {t('terms', 'όροι')}</p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => navigate(`/study/${mc.id}`)}
                      className="flex-1 py-2 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white text-xs font-semibold rounded-xl transition-all shadow-sm shadow-indigo-500/20"
                    >
                      {t('Open Study Workspace', 'Ανοικτή Γραμμή Μελέτης')}
                    </button>
                    <button
                      onClick={() => { setIsUploadModalOpen(true); }}
                      title={t('Extend course', 'Επέκταση μαθήματος')}
                      className="px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 transition-colors"
                    >
                      +
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </>
      )}

      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <h3 className="text-lg font-display font-bold text-slate-900 dark:text-white tracking-tight">
            {t('Your Courses', 'Τα Μαθήματά Σου')}
          </h3>
          {isSelectionMode ? (
            <div className="flex gap-2">
              <button
                onClick={handleBulkDelete}
                disabled={selectedCourses.length === 0}
                className="px-2 py-1 bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-500/20 rounded-lg text-xs font-semibold hover:bg-rose-100 dark:hover:bg-rose-500/20 transition-colors disabled:opacity-50"
              >
                {t('Delete Selected', 'Διαγραφή Επιλεγμένων')} ({selectedCourses.length})
              </button>
              <button
                onClick={() => { setIsSelectionMode(false); setSelectedCourses([]); }}
                className="px-2 py-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
              >
                {t('Cancel', 'Ακύρωση')}
              </button>
            </div>
          ) : (
            <button
              onClick={() => setIsSelectionMode(true)}
              className="px-2 py-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
            >
              {t('Select', 'Επιλογή')}
            </button>
          )}
        </div>
        <button className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 font-medium text-xs transition-colors">
          {t('View all', 'Προβολή όλων')}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-5 gap-5">
        {displayCourses.map((course, index) => (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.08, duration: 0.35, ease: 'easeOut' }}
            key={course.id}
            role="button"
            tabIndex={0}
            aria-label={`View details for ${course.title || 'course'}`}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                openCourse(course);
              }
            }}
            onClick={() => openCourse(course)}
            className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200/60 dark:border-slate-800/60 hover:shadow-xl hover:shadow-slate-200/60 dark:hover:shadow-indigo-900/20 hover:-translate-y-1.5 transition-all duration-300 cursor-pointer group flex flex-col justify-between overflow-hidden"
          >
            {/* Gradient top bar */}
            <div className={cn('h-1 w-full bg-gradient-to-r', course.color)} />
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
                      'w-12 h-12 rounded-xl flex items-center justify-center border border-white/50 dark:border-white/10 shadow-inner group-hover:scale-110 transition-transform duration-300',
                      course.bg,
                    )}
                  >
                    <Brain
                      className="w-6 h-6 text-slate-700 dark:text-slate-200"
                      strokeWidth={1.5}
                    />
                  </div>
                </div>
                <div className="flex gap-1.5">
                  <button
                    onClick={async (e) => {
                      e.stopPropagation();
                      navigate(`/study/${course.id}`);
                      toast.success(`Open quiz tools in Study Workspace for "${course.title}"`);
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

            <div className="px-5 pb-5">
              <div className="flex justify-between text-xs mb-1.5">
                <span className="font-medium text-slate-500 dark:text-slate-400">
                  {t('Mastery', 'Εξοικείωση')}
                </span>
                <span className="font-bold text-slate-900 dark:text-white">
                  {course.progress}%
                </span>
              </div>
              <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
                <div
                  className={cn('h-full rounded-full bg-gradient-to-r transition-all duration-1000 ease-out', course.color)}
                  style={{ width: `${course.progress}%`, animation: 'progress-fill 1s ease-out' }}
                />
              </div>
            </div>
          </motion.div>
        ))}

        {/* Add New Course Card */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => setIsUploadModalOpen(true)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setIsUploadModalOpen(true);
            }
          }}
          className="border-2 border-dashed border-slate-200 dark:border-slate-700/60 rounded-2xl p-5 flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 hover:bg-indigo-50/50 dark:hover:bg-indigo-900/10 hover:border-indigo-300 dark:hover:border-indigo-700 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all duration-300 cursor-pointer min-h-[220px] group"
        >
          <div className="w-12 h-12 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 group-hover:border-indigo-200 dark:group-hover:border-indigo-800 rounded-xl flex items-center justify-center mb-3 shadow-sm group-hover:shadow-indigo-100 dark:group-hover:shadow-indigo-900/30 group-hover:scale-110 transition-all duration-300">
            <Plus className="w-5 h-5" />
          </div>
          <span className="font-semibold text-sm">{t('Create New Course', 'Δημιουργία Νέου Μαθήματος')}</span>
          <span className="text-xs mt-1 opacity-70">{t('Start from scratch or template', 'Από μηδέν ή από πρότυπο')}</span>
        </div>
      </div>

      {/* Recent Documents Section */}
      <div className="mt-10 mb-8">
        <h3 className="text-lg font-display font-bold text-slate-900 dark:text-white tracking-tight mb-4">
          {t('Recent Documents', 'Πρόσφατα Έγγραφα')}
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { id: 1, title: 'Calculus Notes Chapter 4', type: 'PDF', size: '2.4 MB', url: '/sample.pdf', summary: 'Limits, derivatives, and introduction to integrals. Focus on chain rule and related rates.' },
            { id: 2, title: 'Biology Study Guide', type: 'PDF', size: '1.1 MB', url: '/sample.pdf', summary: 'Cell structure, mitosis vs meiosis, and basic genetic inheritance patterns.' },
            { id: 3, title: 'Physics Formula Sheet', type: 'PDF', size: '500 KB', url: '/sample.pdf', summary: 'Kinematics, Newton\'s laws, work, energy, and momentum formulas.' },
            { id: 4, title: 'History Essay Draft', type: 'PDF', size: '3.2 MB', url: '/sample.pdf', summary: 'Draft on the causes of the Industrial Revolution in Britain and its social impacts.' },
          ].map(doc => (
            <div key={doc.id} className="relative h-24 group perspective-1000">
              <div className="w-full h-full absolute transition-all duration-500 transform-style-3d group-hover:rotate-y-180">
                {/* Front */}
                <div 
                  className="absolute inset-0 bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/60 rounded-xl p-3 flex items-center gap-3 backface-hidden cursor-pointer shadow-sm hover:border-indigo-300 dark:hover:border-indigo-500/50"
                  onClick={() => {
                    setSelectedDocument(doc);
                    setIsPdfViewerOpen(true);
                  }}
                >
                  <div className="w-10 h-10 bg-rose-50 dark:bg-rose-900/30 rounded-lg flex items-center justify-center text-rose-500 shrink-0">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div className="overflow-hidden">
                    <h4 className="font-medium text-slate-900 dark:text-white text-sm truncate">{doc.title}</h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{doc.type} • {doc.size}</p>
                  </div>
                </div>
                {/* Back */}
                <div 
                  className="absolute inset-0 bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-200 dark:border-indigo-800/60 rounded-xl p-3 flex flex-col justify-center backface-hidden rotate-y-180 cursor-pointer shadow-sm"
                  onClick={() => {
                    setSelectedDocument(doc);
                    setIsPdfViewerOpen(true);
                  }}
                >
                  <h4 className="font-medium text-indigo-900 dark:text-indigo-100 text-sm mb-1.5 truncate flex items-center gap-1.5"><Sparkles className="w-3.5 h-3.5" /> AI Summary</h4>
                  <p className="text-xs text-indigo-700 dark:text-indigo-300 line-clamp-3 leading-relaxed">{doc.summary}</p>
                </div>
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
        <div className="lg:col-span-1 h-[420px] md:h-[380px]">
          <Flashcards />
        </div>
        <div className="lg:col-span-2">
          <D3ActivityChart />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
        <div className="md:col-span-1">
          <GoalTracker />
        </div>
        <div className="md:col-span-2">
          <TaskCompletionChart />
        </div>
      </div>

      <div className="mt-12 grid grid-cols-1 lg:grid-cols-2 gap-6">
        <KnowledgeGraph />
        <StudyHoursChart />
      </div>

      <ImageGeneratorModal
        isOpen={isImageModalOpen}
        onClose={() => setIsImageModalOpen(false)}
      />

      <WebClipperModal
        isOpen={isWebClipperOpen}
        onClose={() => setIsWebClipperOpen(false)}
      />

            <FlashcardGeneratorModal
        isOpen={isFlashcardModalOpen}
        onClose={() => setIsFlashcardModalOpen(false)}
      />
      <ImageOcclusionModal
        isOpen={isImageOcclusionOpen}
        onClose={() => setIsImageOcclusionOpen(false)}
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

      <UploadCourseModal isOpen={isUploadModalOpen} onClose={() => setIsUploadModalOpen(false)} />

      <AnimatePresence>
        {isWorkspaceOpen && (
          <DocumentWorkspace onClose={() => setIsWorkspaceOpen(false)} />
        )}
      </AnimatePresence>
    </PageShell>
  );
}
