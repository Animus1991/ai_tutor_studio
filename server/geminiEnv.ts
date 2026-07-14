/** Resolve Gemini API key from common env var names (Memora + cross-project reuse). */
export function resolveGeminiApiKey(): string {
  return (
    process.env.GEMINI_API_KEY?.trim() ||
    process.env.GOOGLE_API_KEY?.trim() ||
    process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim() ||
    ''
  );
}

export function geminiKeyFingerprint(key: string): string {
  if (!key) return '(none)';
  if (key.startsWith('AIza')) return `AIza…${key.slice(-4)}`;
  if (key.startsWith('AQ.')) return `AQ.…${key.slice(-4)} (AI Studio express)`;
  return `${key.slice(0, 4)}…${key.slice(-4)}`;
}
