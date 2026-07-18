import { BM25 } from './bm25';

/** Provenance for a retrieved text chunk. */
export interface Citation {
  id: string;
  docId: string;
  docTitle: string;
  chunkIndex: number;
  snippet: string;
  locator: string;
  /** Stable chunk id for groundedness / server RAG */
  chunkId?: string;
}

export interface ScoredChunk {
  id: string;
  docId: string;
  docTitle: string;
  text: string;
  chunkIndex: number;
  score: number;
  lexicalScore: number;
  semanticScore: number;
}

export interface RetrievalResult {
  excerpt: string;
  citations: Citation[];
  chunks: ScoredChunk[];
}

const EN_STOP = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with',
  'by', 'from', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had',
  'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'must',
  'that', 'this', 'these', 'those', 'it', 'its', 'they', 'them', 'their', 'we', 'our',
  'you', 'your', 'he', 'she', 'his', 'her', 'not', 'no', 'yes', 'if', 'then', 'than',
  'as', 'so', 'such', 'can', 'all', 'each', 'every', 'both', 'few', 'more', 'most',
  'other', 'some', 'any', 'what', 'which', 'who', 'whom', 'when', 'where', 'why', 'how',
]);

const EL_STOP = new Set([
  'και', 'το', 'τα', 'η', 'οι', 'του', 'της', 'των', 'στο', 'στη', 'στα', 'από', 'για',
  'με', 'σε', 'που', 'να', 'είναι', 'ήταν', 'θα', 'έχει', 'έχουν', 'αυτό', 'αυτά', 'αυτή',
  'αυτές', 'αυτοί', 'δεν', 'μη', 'ότι', 'ως', 'αν', 'ή', 'μια', 'ένα', 'ένας', 'τι', 'πως',
]);

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s\u0370-\u03ff]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 1 && !EN_STOP.has(w) && !EL_STOP.has(w));
}

/** Split text into ~chunkSize char segments with overlap (default 900/160). */
export function chunkDocument(text: string, chunkSize = 900, overlap = 160): string[] {
  if (!text.trim()) return [];
  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    const slice = text.slice(start, end).trim();
    if (slice.length >= 40) chunks.push(slice);
    if (end >= text.length) break;
    start += chunkSize - overlap;
  }
  return chunks;
}

export function formatCitation(citation: Citation): string {
  return `[${citation.docTitle} ${citation.locator}]`;
}

export function buildExcerpt(chunks: ScoredChunk[], maxChars = 4000): string {
  let excerpt = '';
  for (const chunk of chunks) {
    const block = `[Source: ${chunk.docTitle} ¶${chunk.chunkIndex + 1}]\n${chunk.text}\n\n`;
    if (excerpt.length + block.length > maxChars) break;
    excerpt += block;
  }
  return excerpt.trim();
}

export function toCitations(chunks: ScoredChunk[]): Citation[] {
  return chunks.map((c) => ({
    id: c.id,
    docId: c.docId,
    docTitle: c.docTitle,
    chunkIndex: c.chunkIndex,
    snippet: c.text.slice(0, 200) + (c.text.length > 200 ? '…' : ''),
    locator: `¶${c.chunkIndex + 1}`,
    chunkId: c.id,
  }));
}

export interface CorpusDoc {
  id: string;
  docId: string;
  docTitle: string;
  text: string;
  chunkIndex: number;
  embedding?: number[];
}

/** Lexical BM25 retrieval over an in-memory corpus. */
export function retrieveLexical(
  query: string,
  docs: CorpusDoc[],
  topK = 5,
): ScoredChunk[] {
  if (docs.length === 0) return [];
  const texts = docs.map((d) => d.text);
  const bm25 = new BM25(texts);
  const hits = bm25.search(query, Math.min(topK * 2, docs.length));
  const maxScore = hits[0]?.score || 1;

  return hits
    .filter((h) => h.score > 0)
    .slice(0, topK)
    .map((h) => {
      const doc = docs[h.index];
      const normalized = maxScore > 0 ? h.score / maxScore : 0;
      return {
        id: doc.id,
        docId: doc.docId,
        docTitle: doc.docTitle,
        text: doc.text,
        chunkIndex: doc.chunkIndex,
        score: normalized,
        lexicalScore: normalized,
        semanticScore: 0,
      };
    });
}

/** Blend lexical (50%) + semantic cosine (50%) scores. */
export function blendScores(
  lexical: ScoredChunk[],
  semantic: ScoredChunk[],
  topK = 5,
): ScoredChunk[] {
  const merged = new Map<string, ScoredChunk>();

  for (const item of lexical) {
    merged.set(item.id, { ...item, score: item.lexicalScore * 0.5, semanticScore: 0 });
  }

  for (const item of semantic) {
    const existing = merged.get(item.id);
    if (existing) {
      existing.semanticScore = item.semanticScore;
      existing.score = existing.lexicalScore * 0.5 + item.semanticScore * 0.5;
    } else {
      merged.set(item.id, {
        ...item,
        lexicalScore: 0,
        score: item.semanticScore * 0.5,
      });
    }
  }

  return [...merged.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}

export function assembleRetrieval(chunks: ScoredChunk[]): RetrievalResult {
  const citations = toCitations(chunks);
  return {
    excerpt: buildExcerpt(chunks),
    citations,
    chunks,
  };
}
