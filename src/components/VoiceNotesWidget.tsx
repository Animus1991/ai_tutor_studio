import { useState, useEffect, useRef } from 'react';
import { Mic, Square, Save, Loader2, FileText } from 'lucide-react';
import { toast } from 'sonner';

export default function VoiceNotesWidget() {
  const [isRecording, setIsRecording] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [interimText, setInterimText] = useState("");
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        recognitionRef.current = new SpeechRecognition();
        recognitionRef.current.continuous = true;
        recognitionRef.current.interimResults = true;
        
        recognitionRef.current.onresult = (event: any) => {
          let finalTranscript = '';
          let interimTranscript = '';
          
          for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
              finalTranscript += event.results[i][0].transcript;
            } else {
              interimTranscript += event.results[i][0].transcript;
            }
          }
          
          if (finalTranscript) {
            setNoteText(prev => prev + (prev ? " " : "") + finalTranscript);
          }
          setInterimText(interimTranscript);
        };
        
        recognitionRef.current.onerror = (event: any) => {
          console.error("Speech recognition error", event.error);
          setIsRecording(false);
          toast.error("Microphone access denied or error occurred");
        };
        
        recognitionRef.current.onend = () => {
          // If still recording but stopped automatically, restart it or just let it stop
          setIsRecording(false);
          setInterimText("");
        };
      }
    }
    
    return () => {
      if (recognitionRef.current && isRecording) {
        recognitionRef.current.stop();
      }
    };
  }, []);

  const toggleRecording = () => {
    if (!recognitionRef.current) {
      toast.error("Speech recognition is not supported in this browser.");
      return;
    }
    
    if (isRecording) {
      recognitionRef.current.stop();
      setIsRecording(false);
    } else {
      try {
        recognitionRef.current.start();
        setIsRecording(true);
      } catch (err) {
        console.error("Failed to start recording:", err);
      }
    }
  };

  const saveNote = () => {
    if (!noteText.trim()) return;
    toast.success("Note saved successfully!");
    setNoteText("");
    setInterimText("");
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/60 rounded-xl p-5 shadow-sm col-span-1 lg:col-span-3">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-orange-50 dark:bg-orange-900/30 flex items-center justify-center text-orange-600 dark:text-orange-400">
            <FileText className="w-5 h-5" />
          </div>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Workspace Notes</h2>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={toggleRecording}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              isRecording 
                ? 'bg-rose-100 text-rose-600 hover:bg-rose-200 dark:bg-rose-900/30 dark:text-rose-400 dark:hover:bg-rose-900/50' 
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
            }`}
          >
            {isRecording ? <><Square className="w-4 h-4 fill-current" /> Stop</> : <><Mic className="w-4 h-4" /> Record</>}
          </button>
          {noteText.trim() && (
            <button 
              onClick={saveNote}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium bg-indigo-600 hover:bg-indigo-700 text-white transition-colors"
            >
              <Save className="w-4 h-4" /> Save
            </button>
          )}
        </div>
      </div>
      
      <div className="relative">
        <textarea 
          value={noteText + (isRecording && interimText ? (noteText ? " " : "") + interimText : "")}
          onChange={(e) => setNoteText(e.target.value)}
          placeholder="Start recording or type your notes here..."
          className="w-full min-h-[120px] p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl resize-y text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 outline-none transition-all"
        />
        {isRecording && (
          <div className="absolute top-4 right-4 flex items-center gap-2">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-500"></span>
            </span>
            <span className="text-xs font-medium text-rose-500">Listening...</span>
          </div>
        )}
      </div>
    </div>
  );
}
