import { toast } from 'sonner';
import { useState, useRef, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Send, Bot, User, Sparkles, BookOpen, ChevronDown, Activity, Mic, Square } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { chatWithAgent } from '../lib/api';
import { searchVectors } from '../lib/vectorStore';
import CompactPomodoroTimer from '../components/CompactPomodoroTimer';
import localforage from 'localforage';

type Message = {
  id: string;
  role: 'user' | 'model';
  content: string;
  urls?: string[];
};

const MODES = [
  { id: 'socratic', name: 'Socratic Tutor', desc: 'Guides with questions' },
  { id: 'direct', name: 'Deep Theory', desc: 'Detailed theoretical explanations' },
  { id: 'quiz', name: 'Quick Quiz', desc: 'Tests your knowledge with questions' },
  { id: 'feynman', name: 'Feynman Mode', desc: 'You explain, I check' }
];

export default function Agent() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [activeMode, setActiveMode] = useState(MODES[0]);
  const [isModeOpen, setIsModeOpen] = useState(false);
  const [hasSelectedMode, setHasSelectedMode] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recognition, setRecognition] = useState<any>(null);
  const isRecordingRef = useRef(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const location = useLocation();

  useEffect(() => {
    localforage.getItem<Message[]>('memora-ai-logs').then(logs => {
      if (logs && logs.length > 0) {
        setMessages(logs);
        setHasSelectedMode(true);
      }
    });
  }, []);

  useEffect(() => {
    if (messages.length > 0) {
      localforage.setItem('memora-ai-logs', messages);
    }
  }, [messages]);

  
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        const rec = new SpeechRecognition();
        rec.continuous = true;
        rec.interimResults = false;
        rec.onresult = (event: any) => {
          let finalTranscript = '';
          for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
              finalTranscript += event.results[i][0].transcript;
            }
          }
          if (finalTranscript) {
            setInput(prev => prev + (prev ? ' ' : '') + finalTranscript);
          }
        };
        rec.onerror = (e: any) => {
          console.error('Speech recognition error', e);
          setIsRecording(false);
          isRecordingRef.current = false;
        };
        rec.onend = () => {
          setIsRecording(false);
          isRecordingRef.current = false;
        };
        setRecognition(rec);
      }
    }
  }, []);

  useEffect(() => {
    if (hasSelectedMode && messages.length === 0) {
      setMessages([{ id: '1', role: 'model', content: `Welcome to your active learning session. We are in ${activeMode.name} mode. Which concept are we mastering today?` }]);
    }
  }, [hasSelectedMode, activeMode, messages.length]);

  useEffect(() => {
    if (location.state?.focusInput) {
      inputRef.current?.focus();
    }
  }, [location.state]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const shouldSpeak = isRecordingRef.current;
    if (isRecording) {
      recognition?.stop();
      setIsRecording(false);
      isRecordingRef.current = false;
    }

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { id: Date.now().toString(), role: 'user', content: userMessage }]);
    setIsLoading(true);

    try {
      const geminiMessages = messages.map(m => ({
        role: m.role === 'user' ? 'user' : 'model',
        parts: [{ text: m.content }]
      }));
      geminiMessages.push({ role: 'user', parts: [{ text: userMessage }] });

      let ragContext = "";
      try {
        const results = await searchVectors(userMessage, 4);
        if (results && results.length > 0) {
           ragContext = "\n\nRelevant Context from User's Documents:\n" + results.map((r) => `[Source: ${r.docTitle}]\n${r.text}`).join("\n\n");
        }
      } catch (err) {
        console.error("Vector search failed", err);
      }

      const systemInstruction = `You are Memora, an advanced AI tutor. Current mode: ${activeMode.name}. ${activeMode.desc}. Do not hallucinate external facts if not confident. Focus on educational outcomes, mastery, and adaptive learning principles. Format responses nicely using markdown structure if helpful.${ragContext}`;

      const response = await chatWithAgent(geminiMessages, systemInstruction);
      
      setMessages(prev => [...prev, { 
        id: (Date.now() + 1).toString(), 
        role: 'model', 
        content: response.text,
        urls: response.urls
      }]);

      if (shouldSpeak) {
        const utterance = new SpeechSynthesisUtterance(response.text);
        window.speechSynthesis.speak(utterance);
      }
    } catch (error) {
      console.error('Chat error:', error);
      setMessages(prev => [...prev, { 
        id: (Date.now() + 1).toString(), 
        role: 'model', 
        content: "Network interruption. Re-establishing memora connection..." 
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleRecording = () => {
    if (!recognition) {
      toast.success("Speech recognition is not supported in your browser.");
      return;
    }
    if (isRecording) {
      recognition.stop();
      setIsRecording(false);
      isRecordingRef.current = false;
    } else {
      recognition.start();
      setIsRecording(true);
      isRecordingRef.current = true;
    }
  };

  return (
    <div className="h-full flex flex-col bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-200/60 dark:border-slate-800/60 overflow-hidden relative transition-colors duration-300">
      
      <AnimatePresence>
        {!hasSelectedMode && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-6"
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl p-6 max-w-md w-full border border-slate-200/60 dark:border-slate-800/60"
            >
              <div className="text-center mb-6">
                <div className="w-12 h-12 bg-indigo-100 dark:bg-indigo-900/30 rounded-xl flex items-center justify-center mx-auto mb-3">
                  <Bot className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
                </div>
                <h2 className="text-xl font-display font-bold text-slate-900 dark:text-white mb-1.5">Select Study Mode</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">Choose how Memora should guide your session.</p>
              </div>
              
              <div className="space-y-2 mb-6">
                {MODES.map(mode => (
                  <button
                    key={mode.id}
                    onClick={() => setActiveMode(mode)}
                    className={`w-full text-left px-4 py-3 rounded-xl border transition-all ${
                      activeMode.id === mode.id 
                        ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-900/20 dark:border-indigo-500' 
                        : 'border-slate-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-slate-500'
                    }`}
                  >
                    <div className="text-sm font-bold text-slate-900 dark:text-white">{mode.name}</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{mode.desc}</div>
                  </button>
                ))}
              </div>
              
              <button 
                onClick={() => setHasSelectedMode(true)}
                className="w-full py-2.5 bg-slate-900 dark:bg-indigo-600 text-sm text-white rounded-xl font-semibold hover:bg-slate-800 dark:hover:bg-indigo-700 transition-colors"
              >
                Start Session
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <header className="px-6 py-4 border-b border-slate-100 dark:border-slate-800/60 flex items-center justify-between bg-white dark:bg-slate-900 z-20 transition-colors duration-300">
        <div className="flex items-center gap-4">
          <div className="relative">
            <div className="bg-slate-900 dark:bg-indigo-600 p-2.5 rounded-xl shadow-lg shadow-indigo-500/20">
              <Bot className="w-5 h-5 text-white" strokeWidth={1.5} />
            </div>
            <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-emerald-500 rounded-full border-2 border-white dark:border-slate-900"></div>
          </div>
          <div>
            <h2 className="text-lg font-display font-bold text-slate-900 dark:text-white leading-none">Memora Agent</h2>
            <div className="flex items-center gap-1.5 mt-1">
              <Activity className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400" />
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Adaptive Engine Active</p>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <CompactPomodoroTimer />
          {/* Dropdown Mode Selector */}
          <div className="relative">
            <button 
              onClick={() => setIsModeOpen(!isModeOpen)}
            className="flex items-center gap-2 px-4 py-2 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200/60 dark:border-slate-700 rounded-xl text-sm font-semibold text-slate-700 dark:text-slate-300 transition-colors"
          >
            {activeMode.name}
            <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isModeOpen ? 'rotate-180' : ''}`} />
          </button>

          {isModeOpen && (
            <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl shadow-xl z-50 overflow-hidden py-2">
              {MODES.map(mode => (
                <button
                  key={mode.id}
                  onClick={() => { setActiveMode(mode); setIsModeOpen(false); }}
                  className={`w-full text-left px-5 py-3 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors ${activeMode.id === mode.id ? 'bg-indigo-50/50 dark:bg-indigo-900/30' : ''}`}
                >
                  <p className={`font-semibold ${activeMode.id === mode.id ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-900 dark:text-white'}`}>{mode.name}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{mode.desc}</p>
                </button>
              ))}
            </div>
          )}
          </div>
        </div>
      </header>

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 bg-slate-50/30 dark:bg-slate-900/50 scroll-smooth transition-colors duration-300">
        <AnimatePresence>
          {messages.map((msg) => (
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              key={msg.id}
              className={`flex gap-3 max-w-4xl mx-auto ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
            >
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border shadow-sm ${
                msg.role === 'model' 
                  ? 'bg-indigo-600 border-indigo-700 text-white' 
                  : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
              }`}>
                {msg.role === 'model' ? <Sparkles className="w-4 h-4" strokeWidth={1.5} /> : <User className="w-4 h-4" strokeWidth={1.5} />}
              </div>
              
              <div className={`px-5 py-3.5 rounded-2xl max-w-[85%] ${
                msg.role === 'user' 
                  ? 'bg-slate-900 dark:bg-indigo-600 text-white rounded-tr-md shadow-[0_4px_14px_0_rgba(15,23,42,0.15)] dark:shadow-[0_4px_14px_0_rgba(79,70,229,0.15)]' 
                  : 'bg-white dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/60 shadow-sm text-slate-800 dark:text-slate-300 rounded-tl-md'
              }`}>
                <div className="prose prose-slate dark:prose-invert prose-sm sm:prose-base leading-relaxed max-w-none">
                  {msg.content.split('\n').map((line, i) => (
                    <p key={i} className="mb-2 last:mb-0">{line}</p>
                  ))}
                </div>
                {msg.role === 'model' && msg.id !== '1' && (
                  <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-700/50">
                    <div className="flex gap-3">
                      <button className="text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 flex items-center gap-1.5 transition-colors bg-slate-50 dark:bg-slate-800/50 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 px-3 py-1.5 rounded-lg border border-slate-100 dark:border-slate-700/50">
                        <BookOpen className="w-3.5 h-3.5" /> {msg.urls && msg.urls.length > 0 ? `${msg.urls.length} Sources` : 'Sources'}
                      </button>
                      <span className="text-xs font-mono text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-800/50 px-2.5 py-1.5 rounded-lg border border-slate-100 dark:border-slate-700/50">
                        Grounding Active
                      </span>
                    </div>
                    
                    {msg.urls && msg.urls.length > 0 && (
                      <div className="mt-3 flex flex-col gap-2">
                        {msg.urls.map((url, i) => (
                          <a 
                            key={i} 
                            href={url} 
                            target="_blank" 
                            rel="noreferrer"
                            className="text-xs text-indigo-500 hover:text-indigo-600 dark:text-indigo-400 dark:hover:text-indigo-300 truncate block"
                          >
                            {url}
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          ))}
          {isLoading && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-3 max-w-4xl mx-auto">
              <div className="w-8 h-8 rounded-xl bg-indigo-600 border-indigo-700 text-white flex items-center justify-center shrink-0 shadow-sm">
                <Sparkles className="w-4 h-4 animate-pulse" strokeWidth={1.5} />
              </div>
              <div className="px-5 py-4 rounded-2xl bg-white dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/60 shadow-sm text-slate-500 dark:text-slate-400 rounded-tl-md flex gap-1.5 items-center">
                <div className="w-2 h-2 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-2 h-2 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-2 h-2 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        <div ref={messagesEndRef} className="h-4" />
      </div>

      {/* Input Area */}
      <div className="p-6 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800/60 relative z-20 transition-colors duration-300">
        <div className="max-w-4xl mx-auto relative flex items-end shadow-sm">
          <textarea
            ref={inputRef}
            id="agent-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Type a question, paste a theory, or ask for an exercise..."
            className="w-full text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 text-slate-900 dark:text-white rounded-2xl pl-4 pr-24 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 resize-none transition-colors placeholder:text-slate-400 dark:placeholder:text-slate-500"
            rows={1}
            style={{ minHeight: '48px', maxHeight: '160px' }}
          />
          <div className="absolute right-2 bottom-2 flex items-center gap-2">
            <button
              onClick={toggleRecording}
              aria-label={isRecording ? "Stop recording" : "Start recording"}
              className={`p-2 rounded-xl transition-all flex items-center justify-center ${
                isRecording 
                  ? 'bg-rose-500 hover:bg-rose-600 text-white animate-pulse' 
                  : 'bg-white dark:bg-slate-700 text-slate-500 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-600 border border-slate-200 dark:border-slate-600 shadow-sm'
              }`}
            >
              {isRecording ? <Square className="w-4 h-4 fill-current" strokeWidth={1.5} aria-hidden="true" /> : <Mic className="w-4 h-4" strokeWidth={1.5} aria-hidden="true" />}
            </button>
            <button 
              onClick={handleSend}
              disabled={!input.trim() || isLoading}
              aria-label="Send message"
              className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:hover:bg-indigo-600 text-white p-2 rounded-xl transition-all shadow-sm disabled:shadow-none"
            >
              <Send className="w-4 h-4" strokeWidth={1.5} aria-hidden="true" />
            </button>
          </div>
        </div>
        <div className="text-center mt-4 flex items-center justify-center gap-4">
          <p className="text-xs font-medium text-slate-400 dark:text-slate-500">
            Memora continuously models your mastery level.
          </p>
        </div>
      </div>
    </div>
  );
}
