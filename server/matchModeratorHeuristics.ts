/**
 * Deterministic Study Match text safety heuristics (no I/O, no Gemini).
 * Shared by server moderator pipeline and client demo pre-checks.
 */

export type HeuristicVerdict = {
  allowed: boolean;
  category:
    | 'ok'
    | 'sexual'
    | 'nude'
    | 'harassment'
    | 'off_platform'
    | 'spam'
    | 'unsafe';
  reason: string;
  source: 'heuristic';
};

const SEXUAL_PATTERNS: RegExp[] = [
  /\b(nude|nudes|naked|nudity|nsfw|porn|pornography|xxx|onlyfans|sex\s*cam)\b/i,
  /\b(send\s*(nudes?|pics?|photos?)|dick\s*pic|boobs?|tits?|pussy|cock|penis|vagina|ass\s*pic)\b/i,
  /\b(horny|sexy|sext|sexting|erotic|fetish|kink|orgasm|masturbat)/i,
  /\b(hook\s*up|netflix\s*and\s*chill|friends?\s*with\s*benefits|one\s*night\s*stand)\b/i,
  /\b(blow\s*job|hand\s*job|anal|oral\s*sex|make\s*out|undress|strip\s*for\s*me)\b/i,
  // Greek stems — avoid \b (ASCII-only word boundary)
  /(γυμν|σεξουαλ|σεξ\b|πορν|ερωτικ|αυναν|στήθη|πέος|κόλπο|καυλ)/i,
];

const DATING_PATTERNS: RegExp[] = [
  /\b(are\s*you\s*(a\s*)?(girl|boy|single|cute|hot)|what\s*do\s*you\s*look\s*like|send\s*selfie|dating|boyfriend|girlfriend|crush)\b/i,
  /(θες\s*να\s*βγούμε|είσαι\s*μόνος|είσαι\s*μονος|φλερτ|ραντεβού)/i,
];

const OFF_PLATFORM =
  /\b(whatsapp|telegram|snapchat|instagram|discord\.gg|onlyfans|add\s*me|dm\s*me|text\s*me|call\s*me)\b/i;

export function heuristicModerateText(text: string): HeuristicVerdict {
  const t = text.trim();
  if (!t) {
    return { allowed: false, category: 'spam', reason: 'Empty message', source: 'heuristic' };
  }
  if (t.length > 1000) {
    return { allowed: false, category: 'spam', reason: 'Message too long', source: 'heuristic' };
  }
  for (const re of SEXUAL_PATTERNS) {
    if (re.test(t)) {
      return {
        allowed: false,
        category: /nude|naked|nudity|γυμν/i.test(t) ? 'nude' : 'sexual',
        reason:
          'Sexual or nude content is not allowed in Study Match. Keep the space for learning only.',
        source: 'heuristic',
      };
    }
  }
  for (const re of DATING_PATTERNS) {
    if (re.test(t)) {
      return {
        allowed: false,
        category: 'sexual',
        reason:
          'Dating / appearance / flirting talk is blocked. Study Match is for focused learning only.',
        source: 'heuristic',
      };
    }
  }
  if (OFF_PLATFORM.test(t)) {
    return {
      allowed: false,
      category: 'off_platform',
      reason: 'Keep conversation inside Memora — no off-platform contact requests.',
      source: 'heuristic',
    };
  }
  if (/(?:\d[\s-]*){8,}/.test(t)) {
    return {
      allowed: false,
      category: 'off_platform',
      reason: 'Do not share phone numbers in Study Match.',
      source: 'heuristic',
    };
  }
  return { allowed: true, category: 'ok', reason: '', source: 'heuristic' };
}
