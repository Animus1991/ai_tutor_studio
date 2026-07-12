import { openDB, IDBPDatabase } from 'idb';
import { chunkDocument } from './rag';

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

export async function generateEmbedding(text: string): Promise<number[]> {
  const res = await fetch('/api/embed', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: text.slice(0, 8000) }),
  });
  if (!res.ok) throw new Error('Failed to generate embedding');
  const data = await res.json();
  return data.embedding;
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
