import { toast } from 'sonner';
import { useState, useRef, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Send, Bot, User, Sparkles, BookOpen, ChevronDown, Activity, Mic, Square, Trash2, Copy, Check, Globe, HelpCircle, Layers, FlaskConical, Brain, Zap, GraduationCap, FileText, Swords, Compass } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  chatWithAgent,
  streamChatWithAgent,
  ApiError,
  DemoModeError,
  checkHealth,
  isGeminiUnavailable,
} from '../lib/api';
import { retrieveForQueryHybrid, offlineAnswerFromExcerpt } from '../lib/sourceContext';
import { formatCitation, type Citation } from '../lib/rag';
import { logActivity } from '../lib/activity';
import CompactPomodoroTimer from '../components/CompactPomodoroTimer';
import {
  loadAgentMessages,
  saveAgentMessages,
  loadAgentMode,
  saveAgentMode,
  clearAgentMessages,
  type AgentMessage,
  type AgentModeId,
} from '../lib/agentChatStorage';
import { useAuthStore } from '../store/useAuthStore';
import { useLibraryStore } from '../store/useLibraryStore';
import { useLearningProfileStore } from '../store/useLearningProfileStore';
import type { BehaviorEvent } from '../lib/learningProfile';
import { loadAgentCourseId, saveAgentCourseId } from '../lib/agentCourseContext';
import { useLanguage } from '../lib/i18n';
import { announce } from '../lib/liveAnnouncer';
import MarkdownMessage from '../components/MarkdownMessage';
import { ensureDemoSandboxReady } from '../lib/demoMode';

type Message = AgentMessage;

const MODES = [
  { id: 'socratic',    icon: HelpCircle,   color: 'text-violet-500',  bg: 'bg-violet-50 dark:bg-violet-900/20',  border: 'border-violet-200 dark:border-violet-700/50' },
  { id: 'direct',      icon: Layers,       color: 'text-blue-500',    bg: 'bg-blue-50 dark:bg-blue-900/20',      border: 'border-blue-200 dark:border-blue-700/50' },
  { id: 'quiz',        icon: Zap,          color: 'text-amber-500',   bg: 'bg-amber-50 dark:bg-amber-900/20',    border: 'border-amber-200 dark:border-amber-700/50' },
  { id: 'feynman',     icon: FlaskConical, color: 'text-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-900/20', border: 'border-emerald-200 dark:border-emerald-700/50' },
  { id: 'exam-coach',  icon: GraduationCap, color: 'text-rose-500',   bg: 'bg-rose-50 dark:bg-rose-900/20',      border: 'border-rose-200 dark:border-rose-700/50' },
  { id: 'summariser',  icon: FileText,     color: 'text-cyan-500',    bg: 'bg-cyan-50 dark:bg-cyan-900/20',      border: 'border-cyan-200 dark:border-cyan-700/50' },
  { id: 'debate',      icon: Swords,       color: 'text-orange-500',  bg: 'bg-orange-50 dark:bg-orange-900/20',  border: 'border-orange-200 dark:border-orange-700/50' },
  { id: 'explorer',    icon: Compass,      color: 'text-teal-500',    bg: 'bg-teal-50 dark:bg-teal-900/20',      border: 'border-teal-200 dark:border-teal-700/50' },
];

const MODE_NAMES: Record<string, { en: string; el: string }> = {
  socratic:     { en: 'Socratic Tutor',    el: 'Σωκρατικός Δάσκαλος' },
  direct:       { en: 'Deep Theory',       el: 'Βαθιά Θεωρία' },
  quiz:         { en: 'Quick Quiz',        el: 'Γρήγορο Quiz' },
  feynman:      { en: 'Feynman Mode',      el: 'Μέθοδος Feynman' },
  'exam-coach': { en: 'Exam Coach',        el: 'Προπονητής Εξετάσεων' },
  summariser:   { en: 'Summary Writer',    el: 'Συγγραφέας Περιλήψεων' },
  debate:       { en: 'Debate Partner',    el: 'Συνομιλητής Διαλόγου' },
  explorer:     { en: 'Concept Explorer',  el: 'Εξερευνητής Εννοιών' },
};

const MODE_DESCS: Record<string, { en: string; el: string }> = {
  socratic:     { en: 'Guides with questions rather than giving direct answers',            el: 'Καθοδηγεί με ερωτήσεις αντί να δίνει άμεσες απαντήσεις' },
  direct:       { en: 'Thorough, structured theoretical explanations',                      el: 'Διεξοδικές, δομημένες θεωρητικές εξηγήσεις' },
  quiz:         { en: 'Tests your knowledge one question at a time',                       el: 'Ελέγχει τις γνώσεις σου μία ερώτηση τη φορά' },
  feynman:      { en: 'You explain, Memora identifies knowledge gaps',                     el: 'Εξηγείς εσύ, ο Memora εντοπίζει κενά γνώσης' },
  'exam-coach': { en: 'Simulates exam conditions with timed practice and scoring',         el: 'Προσομοιώνει συνθήκες εξέτασης με χρονομέτρηση και βαθμολόγηση' },
  summariser:   { en: 'Creates concise summaries, bullet points, and study notes',         el: 'Δημιουργεί περιλήψεις, κουκκίδες και σημειώσεις μελέτης' },
  debate:       { en: 'Argues the opposing view to strengthen your understanding',          el: 'Υποστηρίζει την αντίθετη άποψη για να ενισχύσει την κατανόησή σου' },
  explorer:     { en: 'Maps relationships between concepts and builds knowledge graphs',   el: 'Χαρτογραφεί σχέσεις εννοιών και δομεί γράφους γνώσης' },
};

const MODE_PROMPTS: Record<string, string> = {
  socratic: 'Use the Socratic method: ask guiding questions rather than giving direct answers. Help the student discover insights themselves.',
  direct: 'Provide thorough, structured theoretical explanations with clear definitions and examples.',
  quiz: 'Act as a quiz master: ask one focused question at a time, wait for answers, then give brief feedback before the next question.',
  feynman: 'Ask the student to explain concepts in their own words. When they do, compare against the source material and identify knowledge gaps gently.',
  'exam-coach': 'Simulate an exam environment: present questions under time pressure, provide a score afterward, identify weak areas, and suggest targeted review. Be strict but encouraging.',
  summariser: 'Generate concise, well-structured summaries of the material. Use bullet points, key takeaways, and highlight the most important concepts. Offer to create flashcard-style notes.',
  debate: 'Take the opposing viewpoint on the topic the student presents. Challenge their reasoning with counter-arguments, evidence, and alternative perspectives to deepen understanding.',
  explorer: 'Map relationships between concepts. When the student asks about a topic, explain how it connects to related ideas, prerequisites, and advanced extensions. Build a mental knowledge graph.',
};

const agentProfileMode = (modeId: AgentModeId): BehaviorEvent['mode'] | undefined => {
  if (modeId === 'socratic' || modeId === 'direct' || modeId === 'quiz' || modeId === 'feynman') {
    return modeId;
  }
  return undefined;
};

const resolveAgentMode = (
  savedModeId: string | null | undefined,
  suggestedMode: string,
) =>
  MODES.find((m) => m.id === savedModeId) ??
  MODES.find((m) => m.id === suggestedMode) ??
  MODES[0];

export default function Agent() {
  const { t } = useLanguage();
  const isDemoMode = useAuthStore((s) => s.isDemoMode);
  const { courses, hydrate: hydrateLibrary } = useLibraryStore();
  const profile = useLearningProfileStore((state) => state.profile);
  const trackEvent = useLearningProfileStore((state) => state.trackEvent);
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [chatHydrated, setChatHydrated] = useState(false);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [activeMode, setActiveMode] = useState(() =>
    resolveAgentMode(null, profile.parameters.suggestedMode),
  );
  const [isModeOpen, setIsModeOpen] = useState(false);
  const [hasSelectedMode, setHasSelectedMode] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recognition, setRecognition] = useState<any>(null);
  const [copiedMsgId, setCopiedMsgId] = useState<string | null>(null);
  const isRecordingRef = useRef(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const turnStartedAtRef = useRef(Date.now());

  const modeName = (id: string) => t(MODE_NAMES[id]?.en ?? id, MODE_NAMES[id]?.el);
  const modeDesc = (id: string) => t(MODE_DESCS[id]?.en ?? '', MODE_DESCS[id]?.el);

  const extractDomain = (url: string): string => {
    try { return new URL(url).hostname.replace('www.', ''); } catch { return url.slice(0, 28); }
  };

  const copyMessage = (id: string, content: string) => {
    void navigator.clipboard.writeText(content).then(() => {
      setCopiedMsgId(id);
      setTimeout(() => setCopiedMsgId(null), 1800);
    });
  };
  const location = useLocation();

  useEffect(() => {
    void hydrateLibrary();
    void loadAgentCourseId().then(setSelectedCourseId);
  }, [hydrateLibrary]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setChatHydrated(false);
      const savedModeId = await loadAgentMode();
      const mode = resolveAgentMode(savedModeId, profile.parameters.suggestedMode);
      const modeId = mode.id as AgentModeId;
      const stored = await loadAgentMessages(modeId, isDemoMode);
      if (cancelled) return;
      setActiveMode(mode);
      if (stored.length > 0) {
        setMessages(stored);
        setHasSelectedMode(true);
      } else {
        setMessages([]);
        setHasSelectedMode(false);
      }
      setChatHydrated(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [isDemoMode, profile.parameters.suggestedMode]);

  useEffect(() => {
    if (!chatHydrated || messages.length === 0) return;
    const timer = setTimeout(() => {
      void saveAgentMessages(activeMode.id as AgentModeId, isDemoMode, messages);
    }, 400);
    return () => clearTimeout(timer);
  }, [messages, activeMode.id, isDemoMode, chatHydrated]);

  const handleModeChange = async (mode: (typeof MODES)[number]) => {
    if (mode.id === activeMode.id) {
      setIsModeOpen(false);
      return;
    }
    await saveAgentMessages(activeMode.id as AgentModeId, isDemoMode, messages);
    const nextMessages = await loadAgentMessages(mode.id as AgentModeId, isDemoMode);
    setActiveMode(mode);
    setMessages(nextMessages);
    await saveAgentMode(mode.id as AgentModeId);
    setIsModeOpen(false);
    if (nextMessages.length > 0) {
      setHasSelectedMode(true);
    }
  };

  const handleClearChat = async () => {
    await clearAgentMessages(activeMode.id as AgentModeId, isDemoMode);
    setMessages([]);
    toast.success('Chat cleared for this mode');
  };

  const handleStartSession = async () => {
    setHasSelectedMode(true);
    await saveAgentMode(activeMode.id as AgentModeId);
  };

  
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
      setMessages([{ id: '1', role: 'model', content: t(
        `Welcome to your active learning session. We are in ${modeName(activeMode.id)} mode. Which concept are we mastering today?`,
        `Καλωσήρθες στην ενεργή συνεδρία μάθησης. Είμαστε σε λειτουργία ${modeName(activeMode.id)}. Ποια έννοια κατακτούμε σήμερα;`
      ) }]);
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
    turnStartedAtRef.current = Date.now();
    logActivity(`Agent session: ${modeName(activeMode.id)}`, 'study');

    try {
      if (isDemoMode) {
        await ensureDemoSandboxReady();
        await hydrateLibrary();
      }

      const geminiMessages = messages.map(m => ({
        role: m.role === 'user' ? 'user' : 'model',
        parts: [{ text: m.content }]
      }));
      geminiMessages.push({ role: 'user', parts: [{ text: userMessage }] });

      let ragContext = "";
      let citations: Citation[] = [];
      let retrievalResult = { excerpt: '', citations: [] as Citation[], chunks: [] as import('../lib/rag').ScoredChunk[] };
      const scopedCourse = selectedCourseId ? courses.find((c) => c.id === selectedCourseId) : undefined;
      const docIds = scopedCourse?.uploadedFileIds;
      try {
        retrievalResult = await retrieveForQueryHybrid(userMessage, {
          topK: 4,
          docIds: docIds && docIds.length > 0 ? docIds : undefined,
        });
        citations = retrievalResult.citations;
        if (retrievalResult.excerpt) {
          ragContext = `\n\nRelevant Context from User's Documents (cite as [Document ¶N]):\n${retrievalResult.excerpt}`;
        }
      } catch (err) {
        console.error("Hybrid retrieval failed", err);
      }

      const modePrompt = MODE_PROMPTS[activeMode.id] ?? modeDesc(activeMode.id);
      const courseScope = scopedCourse
        ? `\nFocus on course: "${scopedCourse.title}". Only use document context from this course when available.`
        : '';
      const systemInstruction = `You are Memora, an advanced AI tutor. Current mode: ${modeName(activeMode.id)}. ${modePrompt}${courseScope}
When using document context, cite sources inline using the format [DocumentName ¶N].
Do not hallucinate external facts if not confident. Focus on educational outcomes, mastery, and adaptive learning principles.
Format responses nicely using markdown structure if helpful.${ragContext}`;

      const serverUp = await checkHealth();
      const assistantId = (Date.now() + 1).toString();
      let responseText = '';
      let responseUrls: string[] | undefined;

      if (serverUp) {
        announce('Memora is thinking…', 'polite');
        setMessages((prev) => [...prev, { id: assistantId, role: 'model', content: '' }]);
        setIsLoading(false);

        try {
          const streamedUrls: string[] = [];
          await streamChatWithAgent(geminiMessages, systemInstruction, {
            onChunk: (chunk) => {
              responseText += chunk;
              setMessages((prev) =>
                prev.map((m) => (m.id === assistantId ? { ...m, content: responseText } : m)),
              );
            },
            onCitation: (citation) => {
              // Render grounding web sources incrementally as they arrive.
              if (!streamedUrls.includes(citation.uri)) {
                streamedUrls.push(citation.uri);
                responseUrls = [...streamedUrls];
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantId ? { ...m, urls: [...streamedUrls] } : m,
                  ),
                );
              }
            },
            onDone: (urls) => {
              if (urls.length > 0) responseUrls = urls;
              announce('Response received.', 'polite');
            },
          });
        } catch (streamErr) {
          try {
            const response = await chatWithAgent(geminiMessages, systemInstruction);
            responseText = response.text;
            responseUrls = response.urls;
          } catch (chatErr) {
            if (isGeminiUnavailable(streamErr) || isGeminiUnavailable(chatErr)) {
              const offlineErr = isGeminiUnavailable(chatErr) ? chatErr : streamErr;
              responseText = `${offlineAnswerFromExcerpt(userMessage, retrievalResult)}\n\n---\n*Gemini unavailable (${offlineErr instanceof ApiError ? offlineErr.message : 'API error'}). Showing offline excerpt from your documents.*`;
              toast.warning(
                offlineErr instanceof ApiError
                  ? offlineErr.message
                  : 'Gemini unavailable — using offline mode',
              );
            } else {
              throw chatErr;
            }
          }
        }

        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? {
                  ...m,
                  content: responseText,
                  urls: responseUrls,
                  citations: citations.length > 0 ? citations : undefined,
                }
              : m,
          ),
        );
      } else {
        responseText = offlineAnswerFromExcerpt(userMessage, retrievalResult);
        setMessages((prev) => [
          ...prev,
          {
            id: assistantId,
            role: 'model',
            content: responseText,
            citations: citations.length > 0 ? citations : undefined,
          },
        ]);
      }

      if (shouldSpeak) {
        const utterance = new SpeechSynthesisUtterance(responseText);
        window.speechSynthesis.speak(utterance);
      }

      trackEvent({
        kind: 'agent_turn',
        surface: 'agent',
        channel: shouldSpeak ? 'voice' : 'text',
        mode: agentProfileMode(activeMode.id as AgentModeId),
        success: true,
        durationSeconds: (Date.now() - turnStartedAtRef.current) / 1_000,
        chunkSizeWords: profile.parameters.chunkSizeWords,
      });
      turnStartedAtRef.current = Date.now();
    } catch (error) {
      console.error('Chat error:', error);
      const msg =
        error instanceof DemoModeError
          ? `${error.message} Use “Sign in with Google” in the banner, or set VITE_REQUIRE_API_AUTH=false in .env.local and restart npm run dev.`
          : error instanceof ApiError
            ? error.status === 429
              ? error.message
              : `Service error (${error.status}): ${error.message}`
            : 'Network interruption. Re-establishing Memora connection...';
      setMessages(prev => [...prev, { 
        id: (Date.now() + 1).toString(), 
        role: 'model', 
        content: msg,
      }]);
      trackEvent({
        kind: 'agent_turn',
        surface: 'agent',
        channel: shouldSpeak ? 'voice' : 'text',
        mode: agentProfileMode(activeMode.id as AgentModeId),
        success: false,
        errorType:
          error instanceof Error ? error.name.slice(0, 80) : 'unknown_error',
      });
      toast.error(
        error instanceof DemoModeError
          ? 'Sign in with Google to use AI in demo mode'
          : error instanceof ApiError && error.status === 429
            ? error.message
            : 'Failed to get AI response',
      );
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
    <div className="h-full flex flex-col min-h-[calc(100dvh-8rem)] bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-200/60 dark:border-slate-800/60 overflow-hidden relative transition-colors duration-300 w-full">
      
      <AnimatePresence>
        {!hasSelectedMode && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-6"
            role="dialog"
            aria-modal="true"
            aria-labelledby="agent-mode-title"
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl p-6 max-w-xl w-full border border-slate-200/60 dark:border-slate-800/60"
            >
              <div className="text-center mb-6">
                <div className="w-14 h-14 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-indigo-500/30 animate-float">
                  <Brain className="w-7 h-7 text-white" strokeWidth={1.5} />
                </div>
                <h2 id="agent-mode-title" className="text-xl font-display font-bold text-slate-900 dark:text-white mb-1.5">{t('Select Study Mode', 'Επιλογή Τρόπου Μελέτης')}</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">{t('Choose how Memora should guide your session.', 'Επίλεξε πώς ο Memora θα καθοδηγήσει την περίοδό σου.')}</p>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-6 stagger">
                {MODES.map(mode => {
                  const ModeIcon = mode.icon;
                  const isSelected = activeMode.id === mode.id;
                  return (
                    <button
                      key={mode.id}
                      onClick={() => setActiveMode(mode)}
                      className={`w-full text-left px-4 py-3 rounded-xl border-2 transition-all flex items-start gap-3 animate-fade-in-up ${
                        isSelected
                          ? `${mode.border} ${mode.bg} shadow-sm`
                          : 'border-slate-200 dark:border-slate-700/60 hover:border-slate-300 dark:hover:border-slate-600 bg-transparent'
                      }`}
                    >
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${isSelected ? mode.bg : 'bg-slate-100 dark:bg-slate-800'}`}>
                        <ModeIcon className={`w-4 h-4 ${isSelected ? mode.color : 'text-slate-400'}`} strokeWidth={1.5} />
                      </div>
                      <div>
                        <div className={`text-sm font-bold ${isSelected ? 'text-slate-900 dark:text-white' : 'text-slate-700 dark:text-slate-300'}`}>{modeName(mode.id)}</div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">{modeDesc(mode.id)}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
              
              <button 
                onClick={() => void handleStartSession()}
                className="w-full py-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-sm text-white rounded-xl font-semibold transition-all shadow-md shadow-indigo-500/25 hover:shadow-lg hover:shadow-indigo-500/30"
              >
                {t('Start Session', 'Έναρξη Περιόδου')}
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
            <h2 className="text-lg font-display font-bold text-slate-900 dark:text-white leading-none">{t('Memora Agent', 'Memora Agent')}</h2>
            <div className="flex items-center gap-1.5 mt-1">
              <Activity className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400" />
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{t('Adaptive Engine Active', 'Προσαρμοστική Μηχανή Ενεργή')}</p>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-3 flex-wrap justify-end">
          <CompactPomodoroTimer />
          <select
            value={selectedCourseId ?? ''}
            onChange={(e) => {
              const id = e.target.value || null;
              setSelectedCourseId(id);
              void saveAgentCourseId(id);
            }}
            className="max-w-[180px] text-xs font-medium px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
            title={t('Scope RAG context to a course', 'Εστίαση πλαισίου σε μάθημα')}
          >
            <option value="">{t('All library docs', 'Όλα τα έγγραφα')}</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
          {hasSelectedMode && messages.length > 0 && (
            <button
              type="button"
              onClick={() => void handleClearChat()}
              title={t('Clear chat for this mode', 'Εκκαθάριση συνομιλίας')}
              className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-rose-600 hover:border-rose-200 dark:hover:border-rose-800 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
          {/* Dropdown Mode Selector */}
          <div className="relative">
            <button 
              onClick={() => setIsModeOpen(!isModeOpen)}
            className="flex items-center gap-2 px-4 py-2 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200/60 dark:border-slate-700 rounded-xl text-sm font-semibold text-slate-700 dark:text-slate-300 transition-colors"
          >
            {modeName(activeMode.id)}
            <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isModeOpen ? 'rotate-180' : ''}`} />
          </button>

          {isModeOpen && (
            <div className="absolute right-0 mt-2 w-72 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl shadow-xl z-50 overflow-y-auto max-h-[420px] py-2">
              {MODES.map(mode => {
                const MIcon = mode.icon;
                return (
                <button
                  key={mode.id}
                  onClick={() => void handleModeChange(mode)}
                  className={`w-full text-left px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors flex items-start gap-3 ${activeMode.id === mode.id ? 'bg-indigo-50/50 dark:bg-indigo-900/30' : ''}`}
                >
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${activeMode.id === mode.id ? mode.bg : 'bg-slate-100 dark:bg-slate-800'}`}>
                    <MIcon className={`w-3.5 h-3.5 ${activeMode.id === mode.id ? mode.color : 'text-slate-400'}`} strokeWidth={1.5} />
                  </div>
                  <div className="min-w-0">
                    <p className={`text-sm font-semibold truncate ${activeMode.id === mode.id ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-900 dark:text-white'}`}>{modeName(mode.id)}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-1">{modeDesc(mode.id)}</p>
                  </div>
                </button>
              );})}
            </div>
          )}
          </div>
        </div>
      </header>

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 bg-slate-50/40 dark:bg-slate-950/30 scroll-smooth transition-colors duration-300">
        {/* Empty state */}
        {hasSelectedMode && messages.length === 0 && !isLoading && (() => {
          const ModeIcon = activeMode.icon;
          return (
            <div className="flex flex-col items-center justify-center h-full min-h-[280px] gap-5 py-10 animate-fade-in-up">
              <div className={`w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg ${activeMode.bg} ${activeMode.border} border-2 animate-float`}>
                <ModeIcon className={`w-8 h-8 ${activeMode.color}`} strokeWidth={1.5} />
              </div>
              <div className="text-center">
                <h3 className="text-lg font-display font-bold text-slate-900 dark:text-white mb-1">{modeName(activeMode.id)}</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 max-w-xs">{modeDesc(activeMode.id)}</p>
              </div>
              <div className="flex flex-wrap gap-2 justify-center max-w-sm">
                {[
                  { en: 'Ask me anything about your materials', el: 'Ρώτησέ με ό,τι θέλεις για το υλικό σου' },
                  { en: 'Quiz me on today\'s topic', el: 'Κάνε μου quiz στο σημερινό θέμα' },
                  { en: 'Explain a concept in simple terms', el: 'Εξήγησέ μου μια έννοια απλά' },
                ].map((s) => (
                  <button key={s.en} onClick={() => { setInput(t(s.en, s.el)); inputRef.current?.focus(); }}
                    className="text-xs px-3 py-1.5 rounded-full border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-indigo-300 dark:hover:border-indigo-700 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors bg-white dark:bg-slate-800/50">
                    {t(s.en, s.el)}
                  </button>
                ))}
              </div>
            </div>
          );
        })()}

        <AnimatePresence>
          {messages.map((msg) => (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
              key={msg.id}
              className={`flex gap-3 w-full group ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
            >
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border shadow-sm mt-0.5 ${
                msg.role === 'model' 
                  ? 'bg-gradient-to-br from-indigo-500 to-violet-600 border-indigo-700 text-white shadow-indigo-500/20' 
                  : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
              }`}>
                {msg.role === 'model' ? <Sparkles className="w-3.5 h-3.5" strokeWidth={1.5} /> : <User className="w-3.5 h-3.5" strokeWidth={1.5} />}
              </div>
              
              <div className={`relative px-4 py-3 rounded-2xl max-w-[85%] ${
                msg.role === 'user' 
                  ? 'bg-slate-900 dark:bg-indigo-600 text-white rounded-tr-sm shadow-md' 
                  : 'bg-white dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/60 shadow-sm text-slate-800 dark:text-slate-200 rounded-tl-sm'
              }`}>
                {msg.role === 'model' ? (
                  <MarkdownMessage content={msg.content} />
                ) : (
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                )}

                {/* Copy button on AI messages */}
                {msg.role === 'model' && msg.content && (
                  <button
                    onClick={() => copyMessage(msg.id, msg.content)}
                    className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 shadow-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400"
                    title="Copy message"
                  >
                    {copiedMsgId === msg.id ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                  </button>
                )}

                {msg.role === 'model' && msg.id !== '1' && (
                  <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-700/50">
                    <div className="flex flex-wrap gap-1.5">
                      {(msg.citations && msg.citations.length > 0) ? (
                        msg.citations.map((c, i) => (
                          <span key={i} className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 px-2 py-0.5 rounded-full border border-indigo-100 dark:border-indigo-800/50">
                            <BookOpen className="w-2.5 h-2.5" />
                            {formatCitation(c)}
                          </span>
                        ))
                      ) : null}
                      <span className="inline-flex items-center gap-1 text-xs font-mono text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-800/50 px-2 py-0.5 rounded-full border border-slate-100 dark:border-slate-700/50">
                        Hybrid RAG
                      </span>
                    </div>
                    
                    {msg.urls && msg.urls.length > 0 && (
                      <div className="mt-2.5 flex flex-wrap gap-1.5">
                        {msg.urls.map((url, i) => (
                          <a 
                            key={i} 
                            href={url} 
                            target="_blank" 
                            rel="noreferrer"
                            className="inline-flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 bg-slate-50 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 transition-colors max-w-[220px] truncate"
                          >
                            <Globe className="w-3 h-3 shrink-0 text-slate-400" />
                            {extractDomain(url)}
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
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-3 w-full">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white flex items-center justify-center shrink-0 shadow-sm shadow-indigo-500/20 mt-0.5">
                <Sparkles className="w-3.5 h-3.5" strokeWidth={1.5} />
              </div>
              <div className="px-4 py-3.5 rounded-2xl rounded-tl-sm bg-white dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/60 shadow-sm flex gap-1 items-center">
                {[0, 150, 300].map((delay) => (
                  <span
                    key={delay}
                    className="w-2 h-2 rounded-full bg-indigo-400"
                    style={{ animation: `typing-dot 1.2s ease-in-out infinite`, animationDelay: `${delay}ms` }}
                  />
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        <div ref={messagesEndRef} className="h-4" />
      </div>

      {/* Input Area */}
      <div className="p-6 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800/60 relative z-20 transition-colors duration-300">
        <div className="w-full relative flex items-end shadow-sm">
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
            aria-label={t('Ask Memora a question', 'Κάνε μια ερώτηση στον Memora')}
            placeholder={t('Type a question, paste a theory, or ask for an exercise...', 'Γράψε ερώτηση, επικόλλησε θεωρία, ή ζήτησε άσκηση...')}
            className="w-full text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 text-slate-900 dark:text-white rounded-2xl pl-4 pr-24 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 resize-none transition-colors placeholder:text-slate-400 dark:placeholder:text-slate-500"
            rows={1}
            style={{ minHeight: '48px', maxHeight: '160px' }}
          />
          <div className="absolute right-2 bottom-2 flex items-center gap-2">
            <button
              onClick={toggleRecording}
              aria-label={isRecording ? t('Stop recording', 'Διακοπή εγγραφής') : t('Start recording', 'Έναρξη εγγραφής')}
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
              aria-label={t('Send message', 'Αποστολή μηνύματος')}
              className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:hover:bg-indigo-600 text-white p-2 rounded-xl transition-all shadow-sm disabled:shadow-none"
            >
              <Send className="w-4 h-4" strokeWidth={1.5} aria-hidden="true" />
            </button>
          </div>
        </div>
        <div className="text-center mt-4 flex items-center justify-center gap-4">
          <p className="text-xs font-medium text-slate-400 dark:text-slate-500">
            {t('Memora continuously models your mastery level.', 'Ο Memora μοντελοποιεί συνεχώς το επίπεδό σου.')}
          </p>
        </div>
      </div>
    </div>
  );
}
