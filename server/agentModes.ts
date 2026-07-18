/**
 * Server-side agent mode contracts (mirrors client pedagogy/safety).
 */
export type ServerAgentModeId =
  | 'socratic'
  | 'direct'
  | 'quiz'
  | 'feynman'
  | 'exam-coach'
  | 'summariser'
  | 'debate'
  | 'explorer';

const EXAM_COACH_POLICY =
  'CRITICAL: Never provide a complete exam answer key or verbatim essay/solution that a student could submit as their own work. Give rubrics and partial guidance only after the student attempts.';

export function normalizeAgentMode(raw: unknown): ServerAgentModeId {
  const id = String(raw ?? 'direct');
  const allowed: ServerAgentModeId[] = [
    'socratic',
    'direct',
    'quiz',
    'feynman',
    'exam-coach',
    'summariser',
    'debate',
    'explorer',
  ];
  return (allowed.includes(id as ServerAgentModeId) ? id : 'direct') as ServerAgentModeId;
}

export function modeAllowsGoogleSearch(mode: ServerAgentModeId): boolean {
  return mode === 'direct' || mode === 'debate';
}

export function appendModeSafety(systemInstruction: string, mode: ServerAgentModeId): string {
  if (mode !== 'exam-coach') return systemInstruction;
  if (systemInstruction.includes('CRITICAL: Never provide a complete exam')) {
    return systemInstruction;
  }
  return `${systemInstruction}\n\n${EXAM_COACH_POLICY}`;
}

export function looksLikeExamAnswerDump(text: string): boolean {
  const t = text.trim();
  if (t.length < 400) return false;
  return (
    /here is the (full |complete )?(answer|essay|solution)/i.test(t) ||
    /submit this (as|for) your (exam|assignment)/i.test(t) ||
    /final answer\s*:/i.test(t) ||
    /model (essay|response)\s*:/i.test(t)
  );
}
