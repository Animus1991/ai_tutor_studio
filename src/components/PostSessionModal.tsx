import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Award, X, CheckCircle2 } from 'lucide-react';
import { auth, db } from '../lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import localforage from 'localforage';
import { logActivity } from '../lib/activity';
import { toast } from 'sonner';
import { useFocusTrap } from '../hooks/useFocusTrap';

export default function PostSessionModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [accomplishment, setAccomplishment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const dialogRef = useFocusTrap<HTMLDivElement>(isOpen, () => setIsOpen(false));

  useEffect(() => {
    const handleShow = () => setIsOpen(true);
    window.addEventListener('showPostSessionModal', handleShow);
    return () => window.removeEventListener('showPostSessionModal', handleShow);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accomplishment.trim()) return;

    setIsSubmitting(true);
    await logActivity(`Completed focus session: ${accomplishment.trim()}`, 'study');
    const newLog = {
      title: accomplishment.trim(),
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      icon: "CheckCircle2",
      createdAt: new Date().toISOString()
    };

    try {
      // First try to save as recent activity (AI logs style)
      const existingLogs = await localforage.getItem<any[]>('memora-ai-logs') || [];
      await localforage.setItem('memora-ai-logs', [...existingLogs, { ...newLog, id: crypto.randomUUID() }]);
      
      // Also save as a completed task to bump completion stats
      const newTask = {
        title: accomplishment.trim(),
        course: "Focus Session",
        completed: true,
        priority: 'Medium',
        dueDate: new Date().toISOString()
      };
      
      if (auth.currentUser) {
        await addDoc(collection(db, 'users', auth.currentUser.uid, 'tasks'), {
          ...newTask,
          createdAt: serverTimestamp()
        });
      } else {
        const existingTasks = await localforage.getItem<any[]>('memora-tasks') || [];
        await localforage.setItem('memora-tasks', [...existingTasks, { ...newTask, id: crypto.randomUUID() }]);
      }
      
      toast.success('Awesome work logged!');
      setIsOpen(false);
      setAccomplishment('');
    } catch (err) {
      console.error(err);
      toast.error('Failed to log session');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsOpen(false)}
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[100]"
          />
          <motion.div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="postsession-modal-title"
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl z-[101] overflow-hidden border border-slate-200 dark:border-slate-800"
          >
            <div className="bg-gradient-to-r from-indigo-500 to-purple-500 p-6 text-center relative">
              <button
                onClick={() => setIsOpen(false)}
                aria-label="Skip session log"
                className="absolute top-4 right-4 p-1 rounded-full bg-white/20 text-white hover:bg-white/30 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
              <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-3 backdrop-blur-sm shadow-inner">
                <Award className="w-8 h-8 text-white" />
              </div>
              <h2 id="postsession-modal-title" className="text-2xl font-bold text-white tracking-tight">Session Complete!</h2>
              <p className="text-indigo-100 mt-1">Time for a well-deserved break.</p>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                What did you accomplish?
              </label>
              <textarea
                autoFocus
                value={accomplishment}
                onChange={e => setAccomplishment(e.target.value)}
                placeholder="e.g. Read Chapter 4 and took notes..."
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 min-h-[100px] resize-y"
              />

              <div className="flex justify-end gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="px-5 py-2.5 rounded-xl font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  Skip
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !accomplishment.trim()}
                  className="px-5 py-2.5 rounded-xl font-medium bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-50 transition-colors flex items-center gap-2"
                >
                  {isSubmitting ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4" />
                  )}
                  Log Session
                </button>
              </div>
            </form>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
