/**
 * Voice Tutor session helpers — turn TTL, latency budgets, barge-in transitions.
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
