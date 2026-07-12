import { useRef, useState } from 'react';
import { X, Upload, Loader2, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { useLibraryStore } from '../store/useLibraryStore';

export default function UploadCourseModal({
  isOpen,
  onClose,
  extendCourseId,
}: {
  isOpen: boolean;
  onClose: () => void;
  extendCourseId?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const { processUpload, isProcessing, lastUploadQuality, courses } = useLibraryStore();
  const navigate = useNavigate();
  const [dragOver, setDragOver] = useState(false);

  const handleFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    try {
      const course = await processUpload(files[0], extendCourseId);
      toast.success(`Course "${course.title}" created with ${course.topics.length} modules`);
      onClose();
      navigate(`/study/${course.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Upload failed');
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl max-w-lg w-full border border-slate-200 dark:border-slate-700"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-800">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              {extendCourseId ? 'Extend Course' : 'Upload & Generate Course'}
            </h2>
            <button onClick={onClose} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-5 space-y-4">
            {extendCourseId && (
              <p className="text-sm text-slate-500">
                Extending: {courses.find((c) => c.id === extendCourseId)?.title}
              </p>
            )}

            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files); }}
              onClick={() => inputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
                dragOver ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20' : 'border-slate-200 dark:border-slate-700 hover:border-indigo-300'
              }`}
            >
              {isProcessing ? (
                <Loader2 className="w-10 h-10 text-indigo-500 animate-spin mx-auto mb-3" />
              ) : (
                <Upload className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              )}
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                {isProcessing ? 'Processing pipeline…' : 'Drop PDF or text file'}
              </p>
              <p className="text-xs text-slate-500 mt-1">Offline outline · BM25 indexing · Quality scoring</p>
              <input ref={inputRef} type="file" accept=".pdf,.txt,.md,text/*,application/pdf" className="hidden" onChange={(e) => handleFiles(e.target.files)} />
            </div>

            {lastUploadQuality && (
              <div className="rounded-xl bg-slate-50 dark:bg-slate-800 p-3 text-sm">
                <div className="flex items-center gap-2 mb-1">
                  {lastUploadQuality.band === 'weak' ? (
                    <AlertTriangle className="w-4 h-4 text-amber-500" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  )}
                  <span className="font-semibold">Quality: {lastUploadQuality.score}/100 ({lastUploadQuality.band})</span>
                </div>
                {lastUploadQuality.warnings.map((w) => (
                  <p key={w} className="text-xs text-amber-600 mt-1">{w}</p>
                ))}
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
