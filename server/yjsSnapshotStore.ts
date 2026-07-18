/**
 * Durable Yjs snapshot metadata + optional binary payload store.
 * File-backed under data/yjs-snapshots/ with Firestore mirror when Admin SDK present.
 * Auth → Validate → Authorize → … → Persist (versioned) → Observe → Privacy TTL
 */
import fs from 'fs';
import path from 'path';
import { createHash } from 'crypto';
import { getAdminFirestore } from '../firebaseAdmin.js';

export type YjsSnapshotRecord = {
  docName: string;
  roomId: string;
  version: number;
  bytes: number;
  connects: number;
  updatedAt: string;
  /** SHA-256 of last persisted payload (empty if metadata-only). */
  contentSha256: string;
  /** Soft TTL for compaction / privacy purge jobs (90d default). */
  expireAt: string;
};

const DEFAULT_TTL_MS = 90 * 24 * 60 * 60 * 1000;
const MAX_DOCS = 500;
const MAX_PAYLOAD_BYTES = 2_000_000;

let rootDir = path.join(process.cwd(), 'data', 'yjs-snapshots');
const memory = new Map<string, YjsSnapshotRecord>();

export function __setYjsSnapshotRootForTests(dir: string): void {
  rootDir = dir;
  memory.clear();
}

export function __resetYjsSnapshotStoreForTests(): void {
  memory.clear();
  try {
    if (fs.existsSync(rootDir)) {
      fs.rmSync(rootDir, { recursive: true, force: true });
    }
  } catch {
    /* ignore */
  }
}

function ensureDir(): void {
  fs.mkdirSync(rootDir, { recursive: true });
}

function metaPath(docKey: string): string {
  const safe = docKey.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 128);
  return path.join(rootDir, `${safe}.json`);
}

function payloadPath(docKey: string): string {
  const safe = docKey.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 128);
  return path.join(rootDir, `${safe}.bin`);
}

function normalizeDocName(docName: string): string {
  return docName.startsWith('/') ? docName : `/${docName}`;
}

function roomIdFromDoc(docName: string): string {
  return normalizeDocName(docName).replace(/^\//, '').slice(0, 128);
}

function readDisk(docName: string): YjsSnapshotRecord | null {
  try {
    const p = metaPath(normalizeDocName(docName));
    if (!fs.existsSync(p)) return null;
    const raw = JSON.parse(fs.readFileSync(p, 'utf8')) as YjsSnapshotRecord;
    if (!raw?.docName) return null;
    return raw;
  } catch {
    return null;
  }
}

function writeDisk(rec: YjsSnapshotRecord): void {
  ensureDir();
  fs.writeFileSync(metaPath(rec.docName), JSON.stringify(rec), 'utf8');
}

async function mirrorFirestore(rec: YjsSnapshotRecord): Promise<void> {
  const db = await getAdminFirestore();
  if (!db) return;
  try {
    await db.collection('yjsSnapshots').doc(rec.roomId).set(
      {
        ...rec,
        // Never store binary payload in Firestore — metadata only
      },
      { merge: true },
    );
  } catch {
    /* best-effort */
  }
}

function pruneMemory(): void {
  if (memory.size <= MAX_DOCS) return;
  const oldest = [...memory.entries()].sort(
    (a, b) => Date.parse(a[1].updatedAt) - Date.parse(b[1].updatedAt),
  );
  while (memory.size > MAX_DOCS && oldest.length) {
    const [key] = oldest.shift()!;
    memory.delete(key);
  }
}

/**
 * Touch / bump snapshot metadata after a connect or message burst.
 * Version increments on each compaction persist; metadata bumps keep version.
 */
export async function touchYjsSnapshot(
  docName: string,
  approxBytes: number,
  opts?: { connect?: boolean },
): Promise<YjsSnapshotRecord> {
  const name = normalizeDocName(docName);
  const prev = memory.get(name) ?? readDisk(name);
  const now = new Date().toISOString();
  const rec: YjsSnapshotRecord = {
    docName: name,
    roomId: roomIdFromDoc(name),
    version: prev?.version ?? 1,
    bytes: Math.min(8_000_000, (prev?.bytes ?? 0) + Math.max(0, approxBytes)),
    connects: (prev?.connects ?? 0) + (opts?.connect ? 1 : 0),
    updatedAt: now,
    contentSha256: prev?.contentSha256 ?? '',
    expireAt: new Date(Date.now() + DEFAULT_TTL_MS).toISOString(),
  };
  memory.set(name, rec);
  pruneMemory();
  try {
    writeDisk(rec);
  } catch {
    /* disk optional in constrained envs */
  }
  void mirrorFirestore(rec);
  return rec;
}

/**
 * Persist an opaque CRDT payload (e.g. Y.encodeStateAsUpdate) with optimistic version.
 * Rejects stale versions when `expectedVersion` is provided.
 */
export async function persistYjsPayload(
  docName: string,
  payload: Buffer,
  expectedVersion?: number,
): Promise<YjsSnapshotRecord> {
  if (!Buffer.isBuffer(payload) || payload.byteLength === 0) {
    throw new Error('Empty Yjs payload');
  }
  if (payload.byteLength > MAX_PAYLOAD_BYTES) {
    throw new Error(`Yjs payload exceeds ${MAX_PAYLOAD_BYTES} bytes`);
  }
  const name = normalizeDocName(docName);
  const prev = memory.get(name) ?? readDisk(name);
  const currentVersion = prev?.version ?? 0;
  if (expectedVersion !== undefined && expectedVersion !== currentVersion) {
    const err = new Error(
      `Yjs version conflict: expected ${expectedVersion}, have ${currentVersion}`,
    );
    (err as Error & { code: string }).code = 'version_conflict';
    throw err;
  }
  const sha = createHash('sha256').update(payload).digest('hex');
  ensureDir();
  fs.writeFileSync(payloadPath(name), payload);
  const rec: YjsSnapshotRecord = {
    docName: name,
    roomId: roomIdFromDoc(name),
    version: currentVersion + 1,
    bytes: payload.byteLength,
    connects: prev?.connects ?? 0,
    updatedAt: new Date().toISOString(),
    contentSha256: sha,
    expireAt: new Date(Date.now() + DEFAULT_TTL_MS).toISOString(),
  };
  memory.set(name, rec);
  writeDisk(rec);
  void mirrorFirestore(rec);
  return rec;
}

export function loadYjsPayload(docName: string): Buffer | null {
  const name = normalizeDocName(docName);
  const p = payloadPath(name);
  try {
    if (!fs.existsSync(p)) return null;
    return fs.readFileSync(p);
  } catch {
    return null;
  }
}

export function getYjsSnapshot(docName: string): YjsSnapshotRecord | null {
  const name = normalizeDocName(docName);
  return memory.get(name) ?? readDisk(name);
}

/** Compact: drop expired metadata/payloads; returns count removed. */
export function compactExpiredYjsSnapshots(nowMs = Date.now()): number {
  let removed = 0;
  ensureDir();
  let files: string[] = [];
  try {
    files = fs.readdirSync(rootDir).filter((f) => f.endsWith('.json'));
  } catch {
    return 0;
  }
  for (const file of files) {
    try {
      const raw = JSON.parse(
        fs.readFileSync(path.join(rootDir, file), 'utf8'),
      ) as YjsSnapshotRecord;
      const exp = Date.parse(raw.expireAt ?? '');
      if (!Number.isFinite(exp) || exp > nowMs) continue;
      fs.unlinkSync(path.join(rootDir, file));
      const bin = path.join(rootDir, file.replace(/\.json$/, '.bin'));
      if (fs.existsSync(bin)) fs.unlinkSync(bin);
      memory.delete(raw.docName);
      removed += 1;
    } catch {
      /* skip corrupt */
    }
  }
  return removed;
}

export function yjsSnapshotStats(): {
  docs: number;
  durableRoot: string;
  withPayload: number;
} {
  ensureDir();
  let withPayload = 0;
  try {
    withPayload = fs.readdirSync(rootDir).filter((f) => f.endsWith('.bin')).length;
  } catch {
    withPayload = 0;
  }
  return { docs: memory.size, durableRoot: rootDir, withPayload };
}
