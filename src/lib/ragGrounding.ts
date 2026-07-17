/**
 * Groundedness checks — refuse invented citations; score overlap with retrieved chunks.
 */
import type { Citation } from './rag';

export type GroundednessVerdict = {
  grounded: boolean;
  score: number;
  reason: string;
  citedChunkIds: string[];
};

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((t) => t.length > 2);
}

/** Jaccard-ish overlap between answer tokens and source excerpt tokens. */
export function overlapScore(answer: string, source: string): number {
  const a = new Set(tokenize(answer));
  const b = new Set(tokenize(source));
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter += 1;
  return inter / Math.min(a.size, b.size);
}

export function assessGroundedness(input: {
  answer: string;
  excerpt?: string;
  citations?: Citation[];
  requireCitations?: boolean;
}): GroundednessVerdict {
  const excerpt = input.excerpt?.trim() ?? '';
  const citations = input.citations ?? [];
  const citedChunkIds = citations.map((c) => c.chunkId || c.id || `${c.docId}:${c.chunkIndex}`);

  if (!excerpt && citations.length === 0) {
    // No RAG context — groundedness N/A (general tutoring allowed)
    return {
      grounded: true,
      score: 1,
      reason: 'No document context requested',
      citedChunkIds: [],
    };
  }

  const score = excerpt ? overlapScore(input.answer, excerpt) : 0;
  const hasInlineCite = /\[[^\]]+¶\d+\]/.test(input.answer) || /¶\d+/.test(input.answer);
  const answerTokens = tokenize(input.answer).length;

  if (excerpt && input.requireCitations !== false && !hasInlineCite && score < 0.15) {
    return {
      grounded: false,
      score,
      reason:
        'Answer does not cite or overlap retrieved document context. Prefer refusing over inventing sources.',
      citedChunkIds,
    };
  }

  if (excerpt && score < 0.08 && (input.answer.length > 200 || answerTokens > 20)) {
    return {
      grounded: false,
      score,
      reason: 'Low overlap with retrieved sources — possible hallucination.',
      citedChunkIds,
    };
  }

  return {
    grounded: true,
    score,
    reason: hasInlineCite ? 'Inline citations present' : 'Adequate source overlap',
    citedChunkIds,
  };
}

export function groundingRefusalMessage(): string {
  return 'I could not ground a reliable answer in your uploaded documents for this question. Please point me to a specific section, or switch modes for general tutoring without citations.';
}
