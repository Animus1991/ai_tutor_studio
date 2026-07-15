import { openDB, IDBPDatabase } from 'idb';
import { chunkDocument } from './rag';
import { apiRequest } from './apiClient';

const dbName = 'memora-vector-store';
const storeName = 'embeddings';

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDB() {
  if (!dbPromise) {
    dbPromise = openDB(dbName, 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(storeName)) {
          db.createObjectStore(storeName, { keyPath: 'id' });
        }
      },
    });
  }
  return dbPromise;
}

export interface VectorDoc {
  id: string;
  docId: string;
  docTitle: string;
  text: string;
  embedding: number[];
}

export async function saveEmbedding(doc: VectorDoc) {
  const db = await getDB();
  await db.put(storeName, doc);
}

export async function getEmbeddingsByDocId(docId: string): Promise<VectorDoc[]> {
  const db = await getDB();
  const allDocs = await db.getAll(storeName);
  return allDocs.filter((d: VectorDoc) => d.docId === docId);
}

export async function getAllEmbeddings(): Promise<VectorDoc[]> {
  const db = await getDB();
  return db.getAll(storeName);
}

export async function deleteEmbeddingsForDoc(docId: string) {
  const db = await getDB();
  const allDocs = await db.getAll(storeName);
  const tx = db.transaction(storeName, 'readwrite');
  for (const doc of allDocs) {
    if (doc.docId === docId) {
      tx.store.delete(doc.id);
    }
  }
  await tx.done;
}

export function cosineSimilarity(vecA: number[], vecB: number[]) {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/** After first embed failure (quota/network), skip further embed calls this session. */
let embeddingApiAvailable: boolean | null = null;

export function resetEmbeddingAvailability(): void {
  embeddingApiAvailable = null;
}

export async function generateEmbedding(text: string): Promise<number[]> {
  if (embeddingApiAvailable === false) {
    throw new Error('Embedding API unavailable');
  }
  const res = await apiRequest('/api/embed', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: text.slice(0, 8000) }),
  });
  if (!res.ok) {
    if (res.status === 429 || res.status === 401 || res.status === 503) {
      embeddingApiAvailable = false;
    }
    throw new Error('Failed to generate embedding');
  }
  const data = await res.json();
  embeddingApiAvailable = true;
  return data.embedding;
}

/** Index document chunks for hybrid RAG. Always stores text; embeddings optional. */
export async function indexDocumentForRag(
  docId: string,
  docTitle: string,
  text: string,
  opts?: { skipEmbeddings?: boolean },
): Promise<void> {
  const existing = await getEmbeddingsByDocId(docId);
  if (
    existing.length > 0 &&
    existing.every((d) => d.text?.trim().length >= 40)
  ) {
    return;
  }

  await deleteEmbeddingsForDoc(docId);
  const chunks = chunkDocument(text);
  for (let i = 0; i < chunks.length; i++) {
    let embedding: number[] = [];
    if (!opts?.skipEmbeddings && embeddingApiAvailable !== false) {
      try {
        embedding = await generateEmbedding(chunks[i]);
      } catch {
        /* lexical-only when embed API unavailable (e.g. Gemini quota) */
      }
    }
    await saveEmbedding({
      id: `${docId}_chunk_${i}`,
      docId,
      docTitle,
      text: chunks[i],
      embedding,
    });
  }
}

/** Character-based chunking with overlap (900 chars / 160 overlap by default). */
export function chunkText(text: string, chunkSize = 900, overlap = 160): string[] {
  return chunkDocument(text, chunkSize, overlap);
}

/** Legacy vector-only search — prefer retrieveForQueryHybrid from sourceContext. */
export async function searchVectors(query: string, limit = 5): Promise<VectorDoc[]> {
  const { retrieveForQueryHybrid } = await import('./sourceContext');
  const result = await retrieveForQueryHybrid(query, { topK: limit });
  return result.chunks.map((c) => ({
    id: c.id,
    docId: c.docId,
    docTitle: c.docTitle,
    text: c.text,
    embedding: [],
  }));
}
