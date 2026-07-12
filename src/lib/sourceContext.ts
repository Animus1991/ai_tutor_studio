import {
  assembleRetrieval,
  blendScores,
  CorpusDoc,
  RetrievalResult,
  retrieveLexical,
  ScoredChunk,
} from './rag';
import {
  cosineSimilarity,
  generateEmbedding,
  getAllEmbeddings,
  VectorDoc,
} from './vectorStore';

function toCorpusDoc(doc: VectorDoc): CorpusDoc {
  const chunkIndex = parseInt(doc.id.split('_chunk_')[1] ?? '0', 10) || 0;
  return {
    id: doc.id,
    docId: doc.docId,
    docTitle: doc.docTitle,
    text: doc.text,
    chunkIndex,
    embedding: doc.embedding,
  };
}

async function retrieveSemantic(
  query: string,
  docs: CorpusDoc[],
  topK = 5,
): Promise<ScoredChunk[]> {
  if (docs.length === 0) return [];
  let queryEmbedding: number[];
  try {
    queryEmbedding = await generateEmbedding(query);
  } catch {
    return [];
  }

  const scored = docs
    .filter((d) => d.embedding && d.embedding.length > 0)
    .map((d) => ({
      id: d.id,
      docId: d.docId,
      docTitle: d.docTitle,
      text: d.text,
      chunkIndex: d.chunkIndex,
      score: cosineSimilarity(queryEmbedding, d.embedding!),
      lexicalScore: 0,
      semanticScore: cosineSimilarity(queryEmbedding, d.embedding!),
    }))
    .sort((a, b) => b.score - a.score);

  const maxScore = scored[0]?.semanticScore || 1;
  return scored.slice(0, topK).map((s) => ({
    ...s,
    semanticScore: maxScore > 0 ? s.semanticScore / maxScore : 0,
    score: maxScore > 0 ? s.semanticScore / maxScore : 0,
  }));
}

export interface RetrieveOptions {
  topK?: number;
  useEmbeddings?: boolean;
  maxChars?: number;
}

/**
 * Hybrid retrieval: BM25 lexical search blended with optional semantic rerank.
 * Falls back to pure BM25 when embeddings are unavailable.
 */
export async function retrieveForQueryHybrid(
  query: string,
  opts: RetrieveOptions = {},
): Promise<RetrievalResult> {
  const { topK = 5, useEmbeddings = true } = opts;
  const allDocs = await getAllEmbeddings();
  const corpus = allDocs.map(toCorpusDoc);

  if (corpus.length === 0) {
    return { excerpt: '', citations: [], chunks: [] };
  }

  const lexical = retrieveLexical(query, corpus, topK);

  if (!useEmbeddings) {
    return assembleRetrieval(lexical);
  }

  try {
    const semantic = await retrieveSemantic(query, corpus, topK);
    const blended = blendScores(lexical, semantic, topK);
    return assembleRetrieval(blended.length > 0 ? blended : lexical);
  } catch {
    return assembleRetrieval(lexical);
  }
}

/** Offline template answer when LLM is unavailable but retrieval succeeded. */
export function offlineAnswerFromExcerpt(query: string, result: RetrievalResult): string {
  if (!result.excerpt) {
    return 'I could not find relevant material in your uploaded notes for this question. Try uploading study materials in the Library first.';
  }
  const cites = result.citations.map((c) => `[${c.docTitle} ${c.locator}]`).join(', ');
  return `Based on your notes (${cites}):\n\n${result.chunks[0]?.text ?? result.excerpt.slice(0, 800)}\n\n---\n*Offline mode — connect to Gemini for a fuller tutor response.*\n\nYour question: "${query}"`;
}
