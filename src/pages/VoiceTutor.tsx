import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, Square, Loader2, Volume2, Pause, Sparkles, User, RotateCcw, AudioLines } from 'lucide-react';
import { toast } from 'sonner';
import { transcribeAudio, synthesizeSpeech, chatWithAgent } from '../lib/api';
import { useMicrophone } from '../hooks/useMicrophone';
import { useLanguage } from '../lib/i18n';
import { useAuthStore } from '../store/useAuthStore';
import { ensureDemoSandboxReady } from '../lib/demoMode';

type Phase = 'idle' | 'listening' | 'transcribing' | 'thinking' | 'speaking';
interface Turn { id: string; role: 'user' | 'model'; content: string }

const VOICES = ['alloy', 'nova', 'shimmer', 'echo', 'fable', 'onyx'];

function SoundWaves() {
  return (
    <div className="flex items-center justify-center gap-1 h-8" aria-hidden="true">
      {[0, 1, 2, 3, 4].map((i) => (
        <span
          key={i}
          className="w-1.5 rounded-full bg-indigo-500"
          style={{ animation: 'voice-wave 1s ease-in-out infinite', animationDelay: `${i * 0.12}s`, height: '100%' }}
        />
      ))}
    </div>
  );
}

export default function VoiceTutor() {
  const { t } = useLanguage();
  const isDemoMode = useAuthStore((s) => s.isDemoMode);
  const { isRecording, startRecording, stopRecording, audioBlob, error } = useMicrophone();
  const [phase, setPhase] = useState<Phase>('idle');
  const [transcript, setTranscript] = useState('');
  const [turns, setTurns] = useState<Turn[]>([]);
  const [voice, setVoice] = useState('nova');
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const turnsRef = useRef<Turn[]>([]);
  turnsRef.current = turns;

  useEffect(() => {
    if (error) toast.error(error);
  }, [error]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [turns, transcript]);

  const speak = useCallback(async (text: string) => {
    try {
      setPhase('speaking');
      const { audio } = await synthesizeSpeech(text, voice);
      if (!audioRef.current) audioRef.current = new Audio();
      audioRef.current.src = audio;
      audioRef.current.onended = () => setPhase('idle');
      await audioRef.current.play();
    } catch {
      setPhase('idle');
    }
  }, [voice]);

  const processBlob = useCallback(async (blob: Blob) => {
    setPhase('transcribing');
    setTranscript('');
    try {
      if (isDemoMode) await ensureDemoSandboxReady();
      const { text } = await transcribeAudio(blob);
      if (!text.trim()) {
        toast.info(t('No speech detected. Try again.', 'Δεν εντοπίστηκε ομιλία. Δοκίμασε ξανά.'));
        setPhase('idle');
        return;
      }
      setTranscript(text);
      const userTurn: Turn = { id: Date.now().toString(), role: 'user', content: text };
      setTurns((prev) => [...prev, userTurn]);

      setPhase('thinking');
      const history = [...turnsRef.current, userTurn].map((tn) => ({
        role: tn.role === 'user' ? 'user' : 'model',
        parts: [{ text: tn.content }],
      }));
      const system =
        'You are Memora, a friendly spoken AI tutor. Reply conversationally and concisely (2-5 sentences), ' +
        'as if speaking aloud. Avoid markdown, lists, or code blocks — plain spoken language only.';
      const { text: reply } = await chatWithAgent(history, system);
      setTranscript('');
      setTurns((prev) => [...prev, { id: (Date.now() + 1).toString(), role: 'model', content: reply }]);
      await speak(reply);
    } catch (e) {
      toast.error(t('Voice tutor failed. Please try again.', 'Αποτυχία φωνητικού βοηθού. Δοκίμασε ξανά.'));
      setPhase('idle');
    }
  }, [isDemoMode, speak, t]);

  useEffect(() => {
    if (audioBlob && phase === 'listening') {
      void processBlob(audioBlob);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audioBlob]);

  const handleMicClick = async () => {
    if (phase === 'speaking') {
      audioRef.current?.pause();
      setPhase('idle');
      return;
    }
    if (isRecording) {
      stopRecording();
      return; // audioBlob effect picks up
    }
    if (phase !== 'idle') return;
    setTranscript('');
    setPhase('listening');
    await startRecording();
  };

  const reset = () => {
    audioRef.current?.pause();
    setTurns([]);
    setTranscript('');
    setPhase('idle');
  };

  const statusText = {
    idle: t('Tap the mic and start speaking', 'Πάτησε το μικρόφωνο και μίλα'),
    listening: t('Listening… tap to stop', 'Ακούω… πάτησε για διακοπή'),
    transcribing: t('Transcribing your voice…', 'Μεταγραφή της φωνής σου…'),
    thinking: t('Memora is thinking…', 'Ο Memora σκέφτεται…'),
    speaking: t('Memora is speaking… tap to stop', 'Ο Memora μιλά… πάτησε για διακοπή'),
  }[phase];

  const isBusy = phase === 'transcribing' || phase === 'thinking';

  return (
    <div
      className="h-full flex flex-col min-h-[calc(100dvh-8rem)] bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-200/60 dark:border-slate-800/60 overflow-hidden"
      data-testid="voice-tutor-page"
    >
      <header className="px-6 py-4 border-b border-slate-100 dark:border-slate-800/60 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-gradient-to-br from-indigo-500 to-fuchsia-500 p-2.5 rounded-xl shadow-lg shadow-indigo-500/25">
            <AudioLines className="w-5 h-5 text-white" strokeWidth={1.5} />
          </div>
          <div>
            <h2 className="text-lg font-display font-bold text-slate-900 dark:text-white leading-none tracking-tight">
              {t('Voice Tutor', 'Φωνητικός Δάσκαλος')}
            </h2>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-1">
              {t('Speak with Memora — powered by Whisper + neural TTS', 'Μίλα με τον Memora — Whisper + νευρωνικό TTS')}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <select
            data-testid="voice-select"
            value={voice}
            onChange={(e) => setVoice(e.target.value)}
            className="text-xs font-medium px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 capitalize"
            title={t('Choose the tutor voice', 'Επίλεξε φωνή δασκάλου')}
          >
            {VOICES.map((v) => <option key={v} value={v}>{v}</option>)}
          </select>
          {turns.length > 0 && (
            <button
              onClick={reset}
              data-testid="voice-reset"
              title={t('Reset conversation', 'Επαναφορά συνομιλίας')}
              className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-rose-600 hover:border-rose-200 dark:hover:border-rose-800 transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          )}
        </div>
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 bg-slate-50/40 dark:bg-slate-950/30">
        {turns.length === 0 && !transcript && (
          <div className="flex flex-col items-center justify-center h-full min-h-[240px] text-center gap-3">
            <div className="w-16 h-16 rounded-2xl bg-indigo-50 dark:bg-indigo-900/20 border-2 border-indigo-100 dark:border-indigo-800/40 flex items-center justify-center">
              <Volume2 className="w-8 h-8 text-indigo-500" strokeWidth={1.5} />
            </div>
            <h3 className="text-lg font-display font-bold text-slate-900 dark:text-white tracking-tight">
              {t('Have a conversation, out loud', 'Κάνε μια συνομιλία, φωναχτά')}
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm leading-relaxed">
              {t('Ask a question by voice. Memora transcribes it, answers, and speaks the reply back to you.',
                 'Ρώτησε με τη φωνή σου. Ο Memora τη μεταγράφει, απαντά και εκφωνεί την απάντηση.')}
            </p>
          </div>
        )}

        <AnimatePresence>
          {turns.map((turn) => (
            <motion.div
              key={turn.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex gap-3 ${turn.role === 'user' ? 'flex-row-reverse' : ''}`}
            >
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border shadow-sm mt-0.5 ${
                turn.role === 'model'
                  ? 'bg-gradient-to-br from-indigo-500 to-fuchsia-500 border-indigo-700 text-white'
                  : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
              }`}>
                {turn.role === 'model' ? <Sparkles className="w-3.5 h-3.5" strokeWidth={1.5} /> : <User className="w-3.5 h-3.5" strokeWidth={1.5} />}
              </div>
              <div className={`px-4 py-3 rounded-2xl max-w-[85%] text-sm leading-relaxed ${
                turn.role === 'user'
                  ? 'bg-slate-900 dark:bg-indigo-600 text-white rounded-tr-sm'
                  : 'bg-white dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/60 text-slate-800 dark:text-slate-200 rounded-tl-sm'
              }`}>
                {turn.content}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {transcript && phase !== 'speaking' && (
          <div className="text-center text-sm text-slate-400 dark:text-slate-500 italic" data-testid="live-transcript">
            “{transcript}”
          </div>
        )}
      </div>

      {/* Voice control dock */}
      <div className="p-8 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800/60 flex flex-col items-center gap-4">
        <div className="relative flex items-center justify-center" data-testid="voice-status" aria-live="polite">
          <AnimatePresence>
            {(phase === 'listening' || phase === 'speaking') && (
              <motion.span
                initial={{ scale: 0.8, opacity: 0.6 }}
                animate={{ scale: [1, 1.35, 1], opacity: [0.5, 0.15, 0.5] }}
                exit={{ opacity: 0 }}
                transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
                className="absolute w-24 h-24 rounded-full"
                style={{ background: 'linear-gradient(to right, #4f46e5, #ec4899, #8b5cf6)' }}
              />
            )}
          </AnimatePresence>
          <motion.button
            whileTap={{ scale: 0.94 }}
            onClick={handleMicClick}
            disabled={isBusy}
            data-testid="voice-mic-button"
            aria-label={statusText}
            className={`relative z-10 w-20 h-20 rounded-full flex items-center justify-center shadow-xl transition-colors ${
              phase === 'listening'
                ? 'bg-rose-500 text-white'
                : phase === 'speaking'
                  ? 'bg-fuchsia-500 text-white'
                  : isBusy
                    ? 'bg-slate-300 dark:bg-slate-700 text-slate-500'
                    : 'bg-indigo-600 hover:bg-indigo-700 text-white'
            }`}
          >
            {phase === 'listening' ? <Square className="w-7 h-7 fill-current" strokeWidth={1.5} />
              : phase === 'speaking' ? <Pause className="w-7 h-7 fill-current" strokeWidth={1.5} />
              : isBusy ? <Loader2 className="w-7 h-7 animate-spin" strokeWidth={1.5} />
              : <Mic className="w-8 h-8" strokeWidth={1.5} />}
          </motion.button>
        </div>
        {phase === 'speaking' ? <SoundWaves /> : (
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400 h-8 flex items-center" data-testid="voice-status-text">
            {statusText}
          </p>
        )}
      </div>
    </div>
  );
}
