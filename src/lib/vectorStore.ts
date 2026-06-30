import { openDB, IDBPDatabase } from 'idb';

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
  id: string; // docId + chunkIndex
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

// Cosine similarity
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

// Generate embedding via our local server
export async function generateEmbedding(text: string): Promise<number[]> {
  const res = await fetch('/api/embed', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text })
  });
  if (!res.ok) throw new Error('Failed to generate embedding');
  const data = await res.json();
  return data.embedding;
}

// Simple chunking strategy
export function chunkText(text: string, chunkSize: number = 500, overlap: number = 100): string[] {
  const words = text.split(/\s+/);
  const chunks: string[] = [];
  let i = 0;
  while (i < words.length) {
    chunks.push(words.slice(i, i + chunkSize).join(' '));
    i += chunkSize - overlap;
  }
  return chunks;
}

// Main function to search
export async function searchVectors(query: string, limit: number = 5): Promise<VectorDoc[]> {
  const queryEmbedding = await generateEmbedding(query);
  const allDocs = await getAllEmbeddings();
  
  const scoredDocs = allDocs.map(doc => ({
    ...doc,
    score: cosineSimilarity(queryEmbedding, doc.embedding)
  }));
  
  scoredDocs.sort((a, b) => b.score - a.score);
  return scoredDocs.slice(0, limit);
}
