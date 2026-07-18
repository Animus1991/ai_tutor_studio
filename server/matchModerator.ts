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

const MAX_IMAGE_MOD_BYTES = 4 * 1024 * 1024;

/**
 * Multimodal image moderation for Match / platform uploads.
 * Heuristic size/MIME gate, then Gemini vision when key present.
 */
export async function moderateMatchImage(
  buffer: Buffer,
  mimeType: string,
): Promise<ModerationVerdict> {
  const mime = mimeType.split(';')[0]?.trim().toLowerCase() || '';
  if (!mime.startsWith('image/')) {
    return {
      allowed: false,
      category: 'unsafe',
      reason: 'Only image attachments are accepted.',
      source: 'heuristic',
    };
  }
  if (!buffer?.length || buffer.length > MAX_IMAGE_MOD_BYTES) {
    return {
      allowed: false,
      category: 'unsafe',
      reason: 'Image exceeds size limit for moderation.',
      source: 'heuristic',
    };
  }

  const key = resolveGeminiApiKey();
  if (!key) {
    // Without Gemini, allow only after text caption is moderated separately.
    return {
      allowed: true,
      category: 'ok',
      reason: 'image_heuristic_pass_no_vision',
      source: 'heuristic',
    };
  }

  try {
    const ai = new GoogleGenAI({ apiKey: key });
    const prompt = `You are a strict safety moderator for a student peer study app.
Reject sexual content, nudity, erotic imagery, dating selfies, weapons used as threats, and gore.
Allow diagrams, textbooks, whiteboards, math, and academic notes photos.
Respond ONLY with JSON: {"allowed":boolean,"category":"ok"|"sexual"|"nude"|"harassment"|"unsafe","reason":"short english reason"}`;

    const response = await generateChatWithFallback(ai, {
      model: geminiChatModel,
      contents: [
        {
          role: 'user',
          parts: [
            { inlineData: { mimeType: mime, data: buffer.toString('base64') } },
            { text: prompt },
          ],
        },
      ],
    });
    const raw =
      response.candidates?.[0]?.content?.parts
        ?.map((p) => ('text' in p ? String(p.text ?? '') : ''))
        .join('') ?? '';
    const parsed = parseGeminiJson(raw);
    if (!parsed || typeof parsed.allowed !== 'boolean') {
      return { allowed: true, category: 'ok', reason: '', source: 'gemini' };
    }
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
      reason: parsed.reason?.slice(0, 200) || 'This image was blocked by the safety moderator.',
      source: 'gemini',
    };
  } catch (err) {
    console.warn('[MatchModerator] Image moderation failed:', err);
    return {
      allowed: false,
      category: 'unsafe',
      reason: 'Image could not be safety-checked. Try again or send text only.',
      source: 'heuristic',
    };
  }
}
