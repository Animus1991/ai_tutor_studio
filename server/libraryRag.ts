/**
 * Cross-device library sync + lightweight server RAG backed by Firebase Admin
 * when configured, otherwise local JSON files under data/.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import type { Request, Response } from 'express';
import { getAdminFirestore } from '../firebaseAdmin.js';

const DATA_ROOT = path.join(process.cwd(), 'data');
const LIBRARY_DIR = path.join(DATA_ROOT, 'library-sync');
const RAG_DIR = path.join(DATA_ROOT, 'rag-index');

type LibraryPayload = {
  courses?: unknown[];
  uploadedFiles?: unknown[];
};

type RagChunk = {
  docId: string;
  title: string;
  chunk: string;
  index: number;
};

function uidFrom(res: Response): string | null {
  const uid = (res.locals.user as { uid?: string } | undefined)?.uid;
  return uid && typeof uid === 'string' ? uid : null;
}

async function ensureDir(dir: string) {
  await fs.mkdir(dir, { recursive: true });
}

async function readJsonFile<T>(file: string, fallback: T): Promise<T> {
  try {
    const raw = await fs.readFile(file, 'utf8');
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

async function writeJsonFile(file: string, data: unknown) {
  await ensureDir(path.dirname(file));
  await fs.writeFile(file, JSON.stringify(data), 'utf8');
}

export async function getLibraryHandler(req: Request, res: Response) {
  const uid = uidFrom(res);
  if (!uid) {
    res.status(401).json({ error: 'Authentication required for library sync' });
    return;
  }

  const firestore = await getAdminFirestore();
  if (firestore) {
    const snap = await firestore.collection('userLibrary').doc(uid).get();
    res.json({ data: snap.exists ? snap.data()?.data ?? null : null });
    return;
  }

  const file = path.join(LIBRARY_DIR, `${uid}.json`);
  const data = await readJsonFile<LibraryPayload | null>(file, null);
  res.json({ data });
}

export async function putLibraryHandler(req: Request, res: Response) {
  const uid = uidFrom(res);
  if (!uid) {
    res.status(401).json({ error: 'Authentication required for library sync' });
    return;
  }

  const data = (req.body?.data ?? null) as LibraryPayload | null;
  if (!data || typeof data !== 'object') {
    res.status(400).json({ error: 'body.data is required' });
    return;
  }

  const courses = Array.isArray(data.courses) ? data.courses.slice(0, 500) : [];
  const uploadedFiles = Array.isArray(data.uploadedFiles)
    ? data.uploadedFiles.slice(0, 500)
    : [];
  const payload = { courses, uploadedFiles };

  const firestore = await getAdminFirestore();
  if (firestore) {
    await firestore.collection('userLibrary').doc(uid).set({
      data: payload,
      updatedAt: new Date().toISOString(),
      ownerId: uid,
    });
    res.json({ ok: true, backend: 'firestore' });
    return;
  }

  await writeJsonFile(path.join(LIBRARY_DIR, `${uid}.json`), payload);
  res.json({ ok: true, backend: 'local' });
}

/** Lightweight BM25-ish term scoring (no external deps). */
function scoreChunk(query: string, chunk: string): number {
  const q = query.toLowerCase().split(/\W+/).filter((t) => t.length > 2);
  if (q.length === 0) return 0;
  const terms = chunk.toLowerCase().split(/\W+/).filter((t) => t.length > 2);
  if (terms.length === 0) return 0;
  const tf = new Map<string, number>();
  for (const t of terms) tf.set(t, (tf.get(t) ?? 0) + 1);
  const avgLen = 80;
  const k1 = 1.2;
  const b = 0.75;
  let score = 0;
  for (const term of q) {
    const f = tf.get(term) ?? 0;
    if (f === 0) continue;
    const idf = 1.2; // uniform prior without corpus DF
    score += idf * ((f * (k1 + 1)) / (f + k1 * (1 - b + b * (terms.length / avgLen))));
  }
  return score;
}

export async function ragIndexHandler(req: Request, res: Response) {
  const uid = uidFrom(res);
  if (!uid) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  const docId = String(req.body?.docId ?? '').slice(0, 128);
  const title = String(req.body?.title ?? 'Untitled').slice(0, 200);
  const chunksIn = Array.isArray(req.body?.chunks) ? req.body.chunks : [];
  if (!docId || chunksIn.length === 0) {
    res.status(400).json({ error: 'docId and chunks required' });
    return;
  }

  const chunks: RagChunk[] = chunksIn.slice(0, 500).map((c: unknown, index: number) => ({
    docId,
    title,
    chunk: String(c).slice(0, 4000),
    index,
  }));

  const firestore = await getAdminFirestore();
  if (firestore) {
    const batch = firestore.batch();
    const col = firestore.collection('userRag').doc(uid).collection('chunks');
    // Replace prior chunks for this docId (best-effort: delete marker + rewrite)
    const existing = await col.where('docId', '==', docId).limit(500).get();
    for (const d of existing.docs) batch.delete(d.ref);
    for (const ch of chunks) {
      const ref = col.doc(`${docId}_${ch.index}`);
      batch.set(ref, { ...ch, ownerId: uid, updatedAt: new Date().toISOString() });
    }
    await batch.commit();
    res.json({ ok: true, indexed: chunks.length, backend: 'firestore' });
    return;
  }

  const file = path.join(RAG_DIR, `${uid}.json`);
  const all = await readJsonFile<RagChunk[]>(file, []);
  const kept = all.filter((c) => c.docId !== docId);
  await writeJsonFile(file, [...kept, ...chunks]);
  res.json({ ok: true, indexed: chunks.length, backend: 'local' });
}

export async function ragQueryHandler(req: Request, res: Response) {
  const uid = uidFrom(res);
  if (!uid) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  const queryText = String(req.body?.query ?? '').trim().slice(0, 2000);
  const topK = Math.min(Number(req.body?.topK) || 5, 20);
  const docId = req.body?.docId ? String(req.body.docId).slice(0, 128) : '';
  if (!queryText) {
    res.status(400).json({ error: 'query required' });
    return;
  }

  let chunks: RagChunk[] = [];
  const firestore = await getAdminFirestore();
  if (firestore) {
    let q = firestore.collection('userRag').doc(uid).collection('chunks').limit(500);
    if (docId) q = q.where('docId', '==', docId).limit(500) as typeof q;
    const snap = await q.get();
    chunks = snap.docs.map((d) => d.data() as RagChunk);
  } else {
    const file = path.join(RAG_DIR, `${uid}.json`);
    chunks = await readJsonFile<RagChunk[]>(file, []);
    if (docId) chunks = chunks.filter((c) => c.docId === docId);
  }

  const ranked = chunks
    .map((c) => ({
      ...c,
      chunkId: `${c.docId}_${c.index}`,
      score: scoreChunk(queryText, c.chunk),
    }))
    .filter((c) => c.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);

  const context = ranked
    .map((r) => `[${r.title} ¶${r.index + 1} | ${r.chunkId}]\n${r.chunk}`)
    .join('\n\n');
  res.json({
    results: ranked,
    context,
    grounded: ranked.length > 0,
    citationHint: 'Cite as [Title ¶N] using the paragraph markers above.',
  });
}

export async function listRoomReportsHandler(req: Request, res: Response) {
  const uid = uidFrom(res);
  if (!uid) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  const roomId = String(req.query.roomId ?? '').slice(0, 128);
  if (!/^[a-zA-Z0-9_-]{8,128}$/.test(roomId)) {
    res.status(400).json({ error: 'Valid roomId query param required' });
    return;
  }

  const firestore = await getAdminFirestore();
  if (!firestore) {
    res.status(503).json({
      error: 'FIREBASE_SERVICE_ACCOUNT_JSON required to triage reports',
      reports: [],
    });
    return;
  }

  const snap = await firestore
    .collection('rooms')
    .doc(roomId)
    .collection('reports')
    .orderBy('createdAt', 'desc')
    .limit(100)
    .get();

  res.json({
    roomId,
    reports: snap.docs.map((d) => ({ id: d.id, ...d.data() })),
  });
}
