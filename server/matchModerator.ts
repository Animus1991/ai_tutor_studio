/**
 * Study Match content moderator.
 * Blocks sexual / nude / erotic content and conversations before they reach peers.
 * Uses deterministic heuristics always; optional Gemini when API key is present.
 */
import { GoogleGenAI } from '@google/genai';
import { generateChatWithFallback, geminiChatModel } from './gemini.js';
import { resolveGeminiApiKey } from './geminiEnv.js';
import {
  heuristicModerateText,
  type HeuristicVerdict,
} from './matchModeratorHeuristics.js';

export type ModerationVerdict = Omit<HeuristicVerdict, 'source'> & {
  source: 'heuristic' | 'gemini';
};

export { heuristicModerateText } from './matchModeratorHeuristics.js';

function parseGeminiJson(raw: string): { allowed?: boolean; category?: string; reason?: string } | null {
  const trimmed = raw.trim();
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = fence ? fence[1].trim() : trimmed;
  try {
    return JSON.parse(body) as { allowed?: boolean; category?: string; reason?: string };
  } catch {
    const m = body.match(/\{[\s\S]*\}/);
    if (!m) return null;
    try {
      return JSON.parse(m[0]) as { allowed?: boolean; category?: string; reason?: string };
    } catch {
      return null;
    }
  }
}

/**
 * Full moderation pipeline: heuristics first (fast reject), then Gemini when configured.
 */
export async function moderateMatchContent(
  text: string,
  kind: 'chat' | 'notes' | 'goal' = 'chat',
): Promise<ModerationVerdict> {
  const heuristic = heuristicModerateText(text);
  if (!heuristic.allowed) return heuristic;

  const key = resolveGeminiApiKey();
  if (!key) return heuristic;

  try {
    const ai = new GoogleGenAI({ apiKey: key });
    const prompt = `You are a strict safety moderator for a student learning app (Study Match).
Reject sexual content, nudity, erotic talk, dating/flirting, and requests for photos of bodies.
Allow normal academic study conversation.
Respond ONLY with JSON: {"allowed":boolean,"category":"ok"|"sexual"|"nude"|"harassment"|"unsafe","reason":"short english reason"}
Content type: ${kind}
Text:
"""
${text.slice(0, 1500)}
"""`;

    const response = await generateChatWithFallback(ai, {
      model: geminiChatModel,
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
    });
    const raw =
      response.candidates?.[0]?.content?.parts
        ?.map((p) => ('text' in p ? String(p.text ?? '') : ''))
        .join('') ?? '';
    const parsed = parseGeminiJson(raw);
    if (!parsed || typeof parsed.allowed !== 'boolean') return heuristic;
    if (parsed.allowed) {
      return { allowed: true, category: 'ok', reason: '', source: 'gemini' };
    }
    const cat = String(parsed.category ?? 'unsafe');
    const category: ModerationVerdict['category'] =
      cat === 'sexual' || cat === 'nude' || cat === 'harassment' || cat === 'unsafe'
        ? cat
        : 'unsafe';
    return {
      allowed: false,
      category,
      reason:
        parsed.reason?.slice(0, 200) ||
        'This message was blocked by the Study Match safety moderator.',
      source: 'gemini',
    };
  } catch (err) {
    console.warn('[MatchModerator] Gemini moderation failed, using heuristics only:', err);
    return heuristic;
  }
}
