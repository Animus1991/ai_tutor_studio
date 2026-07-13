/**
 * Keyphrase extraction: RAKE × TextRank with heading boost and dedup.
 */

import {
  WORD_RE, isContentWord, contentTokens, normalizeConcept,
} from './nlpCore';

export interface Keyphrase { phrase: string; score: number; }

function candidatePhrases(text: string): string[][] {
  const segments = text.toLowerCase().split(/[^\p{L}\p{N}\s''-]+/u);
  const phrases: string[][] = [];
  for (const seg of segments) {
    const words = seg.match(WORD_RE) ?? [];
    let cur: string[] = [];
    for (const raw of words) {
      const w = raw.replace(/^[-'']+|[-'']+$/g, '');
      if (isContentWord(w)) cur.push(w);
      else if (cur.length) { phrases.push(cur); cur = []; }
    }
    if (cur.length) phrases.push(cur);
  }
  return phrases;
}

function rakeWordScores(phrases: string[][]): Map<string, number> {
  const freq = new Map<string, number>();
  const degree = new Map<string, number>();
  for (const p of phrases) {
    for (const w of p) {
      freq.set(w, (freq.get(w) ?? 0) + 1);
      degree.set(w, (degree.get(w) ?? 0) + p.length);
    }
  }
  const scores = new Map<string, number>();
  for (const [w, f] of freq) scores.set(w, (degree.get(w) ?? 0) / Math.max(1, f));
  return scores;
}

function textRankWordScores(tokens: string[], window = 4): Map<string, number> {
  const adj = new Map<string, Map<string, number>>();
  const link = (a: string, b: string) => {
    if (a === b) return;
    const m = adj.get(a) ?? new Map<string, number>();
    m.set(b, (m.get(b) ?? 0) + 1);
    adj.set(a, m);
  };
  for (let i = 0; i < tokens.length; i++) {
    for (let j = i + 1; j < Math.min(i + window, tokens.length); j++) {
      link(tokens[i]!, tokens[j]!);
      link(tokens[j]!, tokens[i]!);
    }
  }
  const nodes = [...adj.keys()];
  if (nodes.length === 0) return new Map();
  const outWeight = new Map<string, number>();
  for (const n of nodes) {
    let s = 0;
    for (const w of adj.get(n)!.values()) s += w;
    outWeight.set(n, s || 1);
  }
  const d = 0.85;
  let score = new Map(nodes.map((n) => [n, 1] as [string, number]));
  for (let iter = 0; iter < 25; iter++) {
    const next = new Map<string, number>();
    for (const v of nodes) {
      let sum = 0;
      for (const u of nodes) {
        const w = adj.get(u)?.get(v);
        if (w) sum += (w / outWeight.get(u)!) * score.get(u)!;
      }
      next.set(v, 1 - d + d * sum);
    }
    score = next;
  }
  return score;
}

export function rankKeyphrases(
  text: string, max = 30, headingText = '',
): Keyphrase[] {
  const phrases = candidatePhrases(text);
  if (phrases.length === 0) return [];
  const rake = rakeWordScores(phrases);
  const tr = textRankWordScores(contentTokens(text));
  const headingWords = new Set(
    (headingText.toLowerCase().match(WORD_RE) ?? []).filter(isContentWord),
  );

  const raw = new Map<string, { phrase: string; rake: number; tr: number }>();
  for (const p of phrases) {
    if (p.length > 3) continue;
    const phrase = p.join(' ');
    const key = normalizeConcept(phrase);
    if (!key) continue;
    const rakeScore = p.reduce((a, w) => a + (rake.get(w) ?? 0), 0);
    const trScore = p.reduce((a, w) => a + (tr.get(w) ?? 0), 0);
    const prev = raw.get(key);
    if (!prev || rakeScore > prev.rake)
      raw.set(key, { phrase, rake: rakeScore, tr: trScore });
  }

  const entries = [...raw.values()];
  if (entries.length === 0) return [];
  const maxRake = Math.max(...entries.map((e) => e.rake), 1);
  const maxTr = Math.max(...entries.map((e) => e.tr), 1);

  return entries
    .map((e) => {
      const words = e.phrase.split(/\s+/);
      let s = 0.5 * (e.rake / maxRake) + 0.5 * (e.tr / maxTr);
      if (words.length > 1) s *= 1.18;
      if (words.some((w) => headingWords.has(w))) s *= 1.4;
      return { phrase: e.phrase, score: s };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, max);
}

export { candidatePhrases, rakeWordScores, textRankWordScores };
