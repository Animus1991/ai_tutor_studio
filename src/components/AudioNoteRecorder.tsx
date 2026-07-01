import { useState, useEffect } from 'react';
import { useMicrophone } from '../hooks/useMicrophone';
import { Mic, Square, Play, Trash2, Save } from 'lucide-react';
import { toast } from 'sonner';

export default function AudioNoteRecorder() {
  const { isRecording, startRecording, stopRecording, audioBlob, audioUrl } = useMicrophone();
  const [notes, setNotes] = useState<{ id: string; url: string; date: string }[]>([]);

  useEffect(() => {
    const handleToggle = () => {
      if (isRecording) {
        stopRecording();
      } else {
        startRecording();
      }
    };
    window.addEventListener('toggleMicrophone', handleToggle);
    return () => window.removeEventListener('toggleMicrophone', handleToggle);
  }, [isRecording, startRecording, stopRecording]);

  const handleSave = () => {
    if (audioUrl) {
      setNotes(prev => [...prev, { id: Date.now().toString(), url: audioUrl, date: new Date().toLocaleString() }]);
      toast.success('Audio note saved locally!');
      // In a real app, upload audioBlob to server or Firebase Storage here.
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/60 rounded-xl p-5 shadow-sm">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-lg bg-rose-50 dark:bg-rose-900/30 flex items-center justify-center text-rose-600 dark:text-rose-400">
          <Mic className="w-5 h-5" />
        </div>
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white tracking-tight">
          Audio Notes
        </h3>
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          {!isRecording ? (
            <button
              onClick={startRecording}
              className="flex items-center gap-2 bg-rose-500 hover:bg-rose-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              <Mic className="w-4 h-4" /> Start Recording
            </button>
          ) : (
            <button
              onClick={stopRecording}
              className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors animate-pulse"
            >
              <Square className="w-4 h-4" /> Stop Recording
            </button>
          )}

          {audioUrl && !isRecording && (
            <button
              onClick={handleSave}
              className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              <Save className="w-4 h-4" /> Save Note
            </button>
          )}
        </div>

        {audioUrl && (
          <div className="w-full">
            <audio src={audioUrl} controls className="w-full h-10" />
          </div>
        )}

        {notes.length > 0 && (
          <div className="mt-4 space-y-2">
            <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300">Saved Notes</h4>
            {notes.map(note => (
              <div key={note.id} className="flex items-center justify-between bg-slate-50 dark:bg-slate-800 p-2 rounded-lg border border-slate-100 dark:border-slate-700">
                <span className="text-xs text-slate-500 dark:text-slate-400">{note.date}</span>
                <audio src={note.url} controls className="h-8 w-48" />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
