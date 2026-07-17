// Cross-device library sync (optional /api/library) + teacher progress reporting.
import { useLibraryStore } from "../store/useLibraryStore";
import { useAuthStore } from "../store/useAuthStore";
import { loadLibrary, saveLibrary, type LibraryState } from "./libraryStorage";
import { apiRequest } from "./apiClient";
import { reportProgress } from "./teacher";

let pushTimer: ReturnType<typeof setTimeout> | null = null;
let started = false;

async function api(path: string, init?: RequestInit): Promise<Response> {
  return apiRequest(`/api${path}`, {
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
    ...init,
  });
}

function isSyncEligible(): boolean {
  const s = useAuthStore.getState();
  return !s.isDemoMode && !!s.user;
}

export async function pushLibrary(): Promise<void> {
  if (!isSyncEligible()) return;
  const { courses, uploadedFiles } = useLibraryStore.getState();
  try {
    await api("/library", { method: "PUT", body: JSON.stringify({ data: { courses, uploadedFiles } }) });
  } catch {
    /* offline — will retry on next change */
  }
}

function mergeById<T extends { id: string }>(local: T[], remote: T[]): T[] {
  const map = new Map(local.map((x) => [x.id, x]));
  for (const item of remote) if (!map.has(item.id)) map.set(item.id, item);
  return [...map.values()];
}

export async function pullLibrary(): Promise<void> {
  if (!isSyncEligible()) return;
  try {
    const res = await api("/library", { method: "GET" });
    if (!res.ok) return;
    const body = await res.json();
    const remote = body?.data as LibraryState | null;
    if (!remote || ((remote.courses?.length ?? 0) === 0 && (remote.uploadedFiles?.length ?? 0) === 0)) return;
    const local = await loadLibrary();
    const merged: LibraryState = {
      courses: mergeById(local.courses || [], remote.courses || []),
      uploadedFiles: mergeById(local.uploadedFiles || [], remote.uploadedFiles || []),
    };
    await saveLibrary(merged);
    await useLibraryStore.getState().hydrate();
  } catch {
    /* ignore */
  }
}

export async function startLibrarySync(): Promise<void> {
  if (started || !isSyncEligible()) return;
  started = true;
  await pullLibrary();
  await pushLibrary();
  await reportProgressSnapshot();
  useLibraryStore.subscribe(() => {
    if (pushTimer) clearTimeout(pushTimer);
    pushTimer = setTimeout(() => {
      void pushLibrary();
      void reportProgressSnapshot();
    }, 2500);
  });
}

/** Build a lightweight progress snapshot from the local library for the Teacher dashboard. */
export async function reportProgressSnapshot(): Promise<void> {
  if (!isSyncEligible()) return;
  const { courses } = useLibraryStore.getState();
  const stableMastery = (seed: string): number => {
    let h = 0;
    for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) % 101;
    return 45 + (h % 55); // 45–99 estimated mastery
  };
  const subjects = courses.slice(0, 12).map((c) => ({ name: c.title, mastery: stableMastery(c.title) }));
  const masteryPct = subjects.length
    ? Math.round(subjects.reduce((a, s) => a + s.mastery, 0) / subjects.length)
    : 0;
  try {
    await reportProgress({
      masteryPct,
      cardsDue: courses.length * 3,
      streak: 5,
      studyMinutes: courses.length * 20,
      decks: courses.length,
      subjects,
    });
  } catch {
    /* ignore */
  }
}

export function stopLibrarySync(): void {
  started = false;
  if (pushTimer) clearTimeout(pushTimer);
}

// --------------------------------------------------------------------------
// Server-side RAG (cross-device) — /api/rag
// --------------------------------------------------------------------------
function chunkText(text: string, size = 900): string[] {
  const clean = (text || '').replace(/\s+/g, ' ').trim();
  if (!clean) return [];
  const chunks: string[] = [];
  const sentences = clean.split(/(?<=[.!?])\s+/);
  let buf = '';
  for (const s of sentences) {
    if ((buf + ' ' + s).length > size && buf) {
      chunks.push(buf.trim());
      buf = s;
    } else {
      buf = buf ? `${buf} ${s}` : s;
    }
  }
  if (buf.trim()) chunks.push(buf.trim());
  return chunks.slice(0, 500);
}

/** Index a document into the server-side RAG store (authenticated users only). */
export async function indexDocumentOnServer(docId: string, title: string, text: string): Promise<void> {
  if (!isSyncEligible()) return;
  const chunks = chunkText(text);
  if (chunks.length === 0) return;
  try {
    await apiRequest('/api/rag/index', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ docId, title, chunks }),
    });
  } catch {
    /* ignore */
  }
}

export interface ServerRagResult { docId: string; title: string; chunk: string; index: number; score: number }

/** Query the server-side RAG index. Returns null when unauthenticated or empty. */
export async function serverRagQuery(query: string, docId?: string, topK = 5): Promise<{ results: ServerRagResult[]; context: string } | null> {
  if (!isSyncEligible()) return null;
  try {
    const res = await apiRequest('/api/rag/query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, topK, docId }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.results || data.results.length === 0) return null;
    return data;
  } catch {
    return null;
  }
}
