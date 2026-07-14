/**
 * Biased TextRank + MMR sentence-level extractive summarizer.
 */

import { WORD_RE, isContentWord, contentTokens, splitSentences } from './nlpCore';

export interface SummaryOptions {
  capSentences?: number;
  biasTerms?: string[];
  leadBias?: number;
  mmrLambda?: number;
}

export function extractiveSummary(
  text: string, n = 2, opts: SummaryOptions = {},
): string[] {
  const cap = opts.capSentences ?? 120;
  const sentences = splitSentences(text).slice(0, cap);
  if (sentences.length <= n) return sentences;

  const tokenSets = sentences.map((s) => new Set(contentTokens(s)));
  const sim = (i: number, j: number) => {
    const a = tokenSets[i]!, b = tokenSets[j]!;
    if (a.size === 0 || b.size === 0) return 0;
    let overlap = 0;
    for (const t of a) if (b.has(t)) overlap += 1;
    const denom = Math.log(a.size + 1) + Math.log(b.size + 1);
    return denom > 0 ? overlap / denom : 0;
  };

  const N = sentences.length;
  const weight: number[][] = Array.from({ length: N }, () => Array(N).fill(0));
  const outSum: number[] = Array(N).fill(0);
  for (let i = 0; i < N; i++) {
    for (let j = i + 1; j < N; j++) {
      const s2 = sim(i, j);
      weight[i]![j] = s2;
      weight[j]![i] = s2;
      outSum[i] += s2;
      outSum[j] += s2;
    }
  }

  // Build teleport vector
  const biasWords = new Set<string>();
  for (const phrase of opts.biasTerms ?? []) {
    for (const w of (phrase.toLowerCase().match(WORD_RE) ?? [])) {
      const stripped = w.replace(/^[-'']+|[-'']+$/g, '');
      if (stripped.length >= 3 && isContentWord(stripped)) biasWords.add(stripped);
    }
  }
  const leadBias = opts.leadBias ?? 0.15;
  const teleport: number[] = Array(N).fill(1);
  if (biasWords.size > 0) {
    for (let i = 0; i < N; i++) {
      let hits = 0;
      for (const t of tokenSets[i]!) if (biasWords.has(t)) hits += 1;
      teleport[i] = 1 + hits;
    }
  }
  if (leadBias > 0) {
    for (let i = 0; i < N; i++)
      teleport[i] *= 1 + leadBias * Math.exp(-i / Math.max(4, N / 4));
  }
  const teleportSum = teleport.reduce((a, b) => a + b, 0) || 1;
  const teleportNorm = teleport.map((t) => (t * N) / teleportSum);

  const d = 0.85;
  let score: number[] = Array(N).fill(1);
  for (let iter = 0; iter < 25; iter++) {
    const next: number[] = Array(N).fill(0);
    for (let v = 0; v < N; v++) {
      let sum2 = 0;
      for (let u = 0; u < N; u++) {
        if (u !== v && weight[u]![v]! > 0 && outSum[u]! > 0)
          sum2 += (weight[u]![v]! / outSum[u]!) * score[u]!;
      }
      next[v] = (1 - d) * teleportNorm[v]! + d * sum2;
    }
    score = next;
  }

  // MMR selection
  const lambda = Math.min(1, Math.max(0, opts.mmrLambda ?? 0.7));
  const selected: number[] = [];
  const remaining = new Set(Array.from({ length: N }, (_, i) => i));
  while (selected.length < n && remaining.size > 0) {
    let bestIdx = -1;
    let bestVal = -Infinity;
    for (const i of remaining) {
      let maxSim = 0;
      for (const j of selected) {
        if (weight[i]![j]! > maxSim) maxSim = weight[i]![j]!;
      }
      const mmr = lambda * (score[i] ?? 0) - (1 - lambda) * maxSim;
      if (mmr > bestVal) { bestVal = mmr; bestIdx = i; }
    }
    if (bestIdx < 0) break;
    selected.push(bestIdx);
    remaining.delete(bestIdx);
  }

  return selected.sort((a, b) => a - b).map((i) => sentences[i]!);
}
