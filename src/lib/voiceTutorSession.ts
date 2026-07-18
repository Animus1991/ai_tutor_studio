/**
 * Voice Tutor session helpers — turn TTL, latency budgets, barge-in transitions,
 * offline fallback prompt pack (local only — never fakes online answers).
 */

export type VoicePhase = 'idle' | 'listening' | 'transcribing' | 'thinking' | 'speaking';

export const VOICE_TURN_TTL_MS = 24 * 60 * 60 * 1000;
export const VOICE_MAX_TURNS = 40;
/** Soft latency budgets (ms) for client Observe metrics. */
export const VOICE_LATENCY_BUDGETS = {
  stt: 8_000,
  chat: 12_000,
  tts: 10_000,
  roundTrip: 25_000,
} as const;

export type OfflineVoicePrompt = {
  id: string;
  match: RegExp;
  replyEn: string;
  replyEl: string;
};

/** Static offline pack — used only when navigator.onLine is false or chat fails offline. */
export const OFFLINE_VOICE_PROMPTS: OfflineVoicePrompt[] = [
  {
    id: 'hello',
    match: /\b(hello|hi|γεια|χαίρετε)\b/i,
    replyEn: 'Hi — I am offline right now. Ask a short study question and I will answer from local prompts only.',
    replyEl: 'Γεια — είμαι offline. Κάνε μια σύντομη ερώτηση μελέτης και θα απαντήσω μόνο από τοπικά prompts.',
  },
  {
    id: 'fsrs',
    match: /\b(fsrs|spaced|επανάληψ|flashcard)\b/i,
    replyEn: 'Offline tip: do a short retrieval check now — cover the answer, recall, then grade yourself honestly for FSRS.',
    replyEl: 'Offline tip: κάνε σύντομο retrieval — κάλυψε την απάντηση, ανάκλησε, βαθμολόγησε ειλικρινά για FSRS.',
  },
  {
    id: 'explain',
    match: /\b(explain|εξήγησ|what is|τι είναι)\b/i,
    replyEn: 'I cannot pull the full course corpus offline. Try Feynman: explain the idea aloud in two sentences, then check your notes.',
    replyEl: 'Offline δεν φορτώνω πλήρες corpus. Δοκίμασε Feynman: εξήγησε την ιδέα σε δύο προτάσεις και έλεγξε τις σημειώσεις σου.',
  },
  {
    id: 'default',
    match: /./,
    replyEn: 'Memora Voice is offline. I will not invent live answers. Open Tasks for due reviews or reconnect for full tutoring.',
    replyEl: 'Το Voice είναι offline. Δεν επινοώ live απαντήσεις. Άνοιξε Tasks για due reviews ή επανασύνδεση για πλήρες tutoring.',
  },
];

export function offlineVoiceReply(userText: string, lang: 'en' | 'el' = 'en'): string {
  const text = userText.trim() || 'hello';
  const hit =
    OFFLINE_VOICE_PROMPTS.find((p) => p.id !== 'default' && p.match.test(text)) ||
    OFFLINE_VOICE_PROMPTS.find((p) => p.id === 'default')!;
  return lang === 'el' ? hit.replyEl : hit.replyEn;
}

export function isBrowserOffline(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine === false;
}

export type VoiceTurn = {
  id: string;
  role: 'user' | 'model';
  content: string;
  at: number;
};

const STORAGE_KEY = 'memora-voice-turns-v1';

export function pruneExpiredTurns(turns: VoiceTurn[], now = Date.now()): VoiceTurn[] {
  const cutoff = now - VOICE_TURN_TTL_MS;
  return turns.filter((t) => t.at >= cutoff).slice(-VOICE_MAX_TURNS);
}

export function loadVoiceTurns(): VoiceTurn[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as VoiceTurn[];
    if (!Array.isArray(parsed)) return [];
    return pruneExpiredTurns(
      parsed.map((t) => ({
        id: String(t.id),
        role: t.role === 'model' ? 'model' : 'user',
        content: String(t.content ?? ''),
        at: Number(t.at) || Date.now(),
      })),
    );
  } catch {
    return [];
  }
}

export function saveVoiceTurns(turns: VoiceTurn[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(pruneExpiredTurns(turns)));
  } catch {
    /* ignore */
  }
}

export function clearVoiceTurns(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

/** Barge-in: speaking → listening (abort TTS path). */
export function nextPhaseOnMic(phase: VoicePhase, isRecording: boolean): VoicePhase | 'toggle_stop' {
  if (phase === 'speaking') return 'listening';
  if (isRecording || phase === 'listening') return 'toggle_stop';
  if (phase === 'idle') return 'listening';
  return phase; // busy: ignore
}

export function latencyWithinBudget(kind: keyof typeof VOICE_LATENCY_BUDGETS, ms: number): boolean {
  return ms <= VOICE_LATENCY_BUDGETS[kind];
}
