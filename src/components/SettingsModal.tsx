import { X, Type, Database, Download } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore } from '../store/useStore';
import { cn } from '../lib/utils';
import { auth, db } from '../lib/firebase';
import { collection, query, getDocs } from 'firebase/firestore';
import localforage from 'localforage';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const { isDyslexiaFont, toggleDyslexiaFont } = useStore();

  const getExportData = async () => {
    let coursesData = [];
    let tasksData = [];
    
    if (auth.currentUser) {
      const coursesQ = query(collection(db, "users", auth.currentUser.uid, "courses"));
      const coursesSnap = await getDocs(coursesQ);
      coursesData = coursesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      const tasksQ = query(collection(db, "users", auth.currentUser.uid, "tasks"));
      const tasksSnap = await getDocs(tasksQ);
      tasksData = tasksSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    }

    const storedTasksStr = await localforage.getItem<string>("memora-tasks");
    if (storedTasksStr) {
      const localTasks = JSON.parse(storedTasksStr);
      tasksData = [...tasksData, ...localTasks];
    }

    return {
      courses: coursesData,
      tasks: tasksData,
    };
  };

  const handleExportJSON = async () => {
    const data = await getExportData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `memora-export-${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportCSV = async () => {
    const data = await getExportData();
    
    const courseHeaders = ["Course Title", "Mastery Progress (%)", "Documents"];
    const courseRows = data.courses.map(
      (row: any) => `"${row.title || ''}",${row.progress || 0},${row.documents || 0}`,
    );

    const taskHeaders = ["Task Title", "Course", "Type", "Time", "Completed"];
    const taskRows = data.tasks.map(
      (row: any) => `"${row.title || ''}","${row.course || ''}","${row.type || ''}","${row.time || ''}",${row.completed ? 'Yes' : 'No'}`,
    );

    const csvContent = [
      "COURSES",
      courseHeaders.join(","),
      ...courseRows,
      "",
      "TASKS",
      taskHeaders.join(","),
      ...taskRows,
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `memora-export-${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden z-50 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-slate-800 sticky top-0 bg-white dark:bg-slate-900 z-10">
              <h3 className="font-bold text-slate-900 dark:text-white">Settings</h3>
              <button
                onClick={onClose}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 flex flex-col gap-8">
              <div>
                <h4 className="text-sm font-semibold text-slate-900 dark:text-white mb-4 uppercase tracking-wider">Appearance & Accessibility</h4>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                      <Type className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="font-medium text-slate-900 dark:text-white">Dyslexic Font</p>
                      <p className="text-sm text-slate-500 dark:text-slate-400">Use OpenDyslexic font globally</p>
                    </div>
                  </div>
                  <button
                    onClick={toggleDyslexiaFont}
                    className={cn(
                      "w-12 h-6 rounded-full transition-colors relative",
                      isDyslexiaFont ? "bg-indigo-600" : "bg-slate-200 dark:bg-slate-700"
                    )}
                  >
                    <div
                      className={cn(
                        "w-4 h-4 rounded-full bg-white absolute top-1 transition-transform",
                        isDyslexiaFont ? "left-7" : "left-1"
                      )}
                    />
                  </button>
                </div>
              </div>

              <div>
                <h4 className="text-sm font-semibold text-slate-900 dark:text-white mb-4 uppercase tracking-wider">Data Management</h4>
                
                <div className="flex flex-col gap-3">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
                      <Database className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="font-medium text-slate-900 dark:text-white">Export Your Data</p>
                      <p className="text-sm text-slate-500 dark:text-slate-400">Download your library and tasks</p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3 pl-13">
                    <button
                      onClick={handleExportJSON}
                      className="flex items-center justify-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors font-medium text-sm"
                    >
                      <Download className="w-4 h-4" /> JSON
                    </button>
                    <button
                      onClick={handleExportCSV}
                      className="flex items-center justify-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors font-medium text-sm"
                    >
                      <Download className="w-4 h-4" /> CSV
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
