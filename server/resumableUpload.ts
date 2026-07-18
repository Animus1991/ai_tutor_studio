/**
 * Resumable upload sessions + AV quarantine hook.
 * Chunks land in quarantine until MIME sniff + optional AV scanner pass.
 * Auth → Validate → Authorize → Moderate → Persist → Observe → Privacy TTL
 */
import fs from 'fs';
import path from 'path';
import { createHash, randomBytes } from 'crypto';
import type { Request, Response } from 'express';
import { getAuthUser } from './authz.js';
import { HttpError } from './security.js';
import { validateObject } from './requestSpine.js';
import { sniffMime } from './contentGuard.js';
import { getAdminFirestore } from '../firebaseAdmin.js';

const MAX_UPLOAD_BYTES = Number(process.env.MAX_RESUMABLE_BYTES ?? 25 * 1024 * 1024);
const CHUNK_MAX = 1024 * 1024; // 1 MiB
const SESSION_TTL_MS = 60 * 60 * 1000;

export type UploadSession = {
  id: string;
  uid: string;
  filename: string;
  declaredMime: string;
  totalBytes: number;
  receivedBytes: number;
  status: 'uploading' | 'quarantine' | 'ready' | 'rejected' | 'expired';
  createdAt: string;
  expireAt: string;
  sha256: string;
  sniffedMime?: string;
  avStatus: 'pending' | 'skipped' | 'clean' | 'infected' | 'error';
  rejectReason?: string;
};

const sessions = new Map<string, UploadSession>();
let quarantineRoot = path.join(process.cwd(), 'data', 'upload-quarantine');

export function __setQuarantineRootForTests(dir: string): void {
  quarantineRoot = dir;
  sessions.clear();
}

export function __resetResumableUploadsForTests(): void {
  sessions.clear();
  try {
    if (fs.existsSync(quarantineRoot)) {
      fs.rmSync(quarantineRoot, { recursive: true, force: true });
    }
  } catch {
    /* ignore */
  }
}

function ensureRoot(): void {
  fs.mkdirSync(quarantineRoot, { recursive: true });
}

function sessionPath(id: string): string {
  return path.join(quarantineRoot, `${id}.part`);
}

/** Optional external AV: set AV_SCAN_COMMAND='clamdscan --fdpass' or similar. */
async function runAvScan(filePath: string): Promise<UploadSession['avStatus']> {
  const cmd = process.env.AV_SCAN_COMMAND?.trim();
  if (!cmd) return 'skipped';
  try {
    const { execFile } = await import('child_process');
    const { promisify } = await import('util');
    const execFileAsync = promisify(execFile);
    const [bin, ...args] = cmd.split(/\s+/);
    await execFileAsync(bin, [...args, filePath], { timeout: 30_000 });
    return 'clean';
  } catch (e: unknown) {
    const code = (e as { code?: number }).code;
    // ClamAV exits 1 when infected
    if (code === 1) return 'infected';
    return 'error';
  }
}

function getSessionOrThrow(id: string, uid: string): UploadSession {
  const s = sessions.get(id);
  if (!s || s.uid !== uid) throw new HttpError(404, 'Upload session not found');
  if (Date.parse(s.expireAt) < Date.now()) {
    s.status = 'expired';
    throw new HttpError(410, 'Upload session expired');
  }
  return s;
}

/** POST /api/uploads/resumable — init session */
export async function initResumableUploadHandler(req: Request, res: Response): Promise<void> {
  const user = getAuthUser(res);
  const body = validateObject(req.body, {
    filename: { type: 'string', required: true, maxLength: 200 },
    mimeType: { type: 'string', required: true, maxLength: 120 },
    totalBytes: { type: 'number', required: true, min: 1, max: MAX_UPLOAD_BYTES },
  });
  const totalBytes = Number(body.totalBytes);
  if (!Number.isFinite(totalBytes) || totalBytes > MAX_UPLOAD_BYTES) {
    throw new HttpError(400, `totalBytes must be 1…${MAX_UPLOAD_BYTES}`);
  }
  const id = randomBytes(16).toString('hex');
  const now = new Date();
  const session: UploadSession = {
    id,
    uid: user.uid,
    filename: String(body.filename).replace(/[/\\]/g, '_').slice(0, 200),
    declaredMime: String(body.mimeType).slice(0, 120),
    totalBytes,
    receivedBytes: 0,
    status: 'uploading',
    createdAt: now.toISOString(),
    expireAt: new Date(now.getTime() + SESSION_TTL_MS).toISOString(),
    sha256: '',
    avStatus: 'pending',
  };
  ensureRoot();
  fs.writeFileSync(sessionPath(id), Buffer.alloc(0));
  sessions.set(id, session);

  const db = await getAdminFirestore();
  if (db) {
    await db.collection('platform_audit').add({
      category: 'upload',
      action: 'RESUMABLE_INIT',
      actorUid: user.uid,
      uploadId: id,
      totalBytes,
      at: now.toISOString(),
    });
  }

  res.status(201).json({
    uploadId: id,
    chunkMax: CHUNK_MAX,
    expireAt: session.expireAt,
    status: session.status,
  });
}

/** PUT /api/uploads/resumable/:id — append chunk (raw body or base64) */
export async function appendResumableChunkHandler(req: Request, res: Response): Promise<void> {
  const user = getAuthUser(res);
  const id = String(req.params.id ?? '').trim();
  const session = getSessionOrThrow(id, user.uid);
  if (session.status !== 'uploading') {
    throw new HttpError(409, `Upload not accepting chunks (${session.status})`);
  }

  let chunk: Buffer;
  if (Buffer.isBuffer(req.body)) {
    chunk = req.body;
  } else if (typeof req.body?.base64 === 'string') {
    chunk = Buffer.from(req.body.base64, 'base64');
  } else if (typeof req.body === 'string') {
    chunk = Buffer.from(req.body, 'binary');
  } else {
    throw new HttpError(400, 'Send raw bytes or { base64 }');
  }
  if (chunk.byteLength === 0 || chunk.byteLength > CHUNK_MAX) {
    throw new HttpError(400, `Chunk must be 1…${CHUNK_MAX} bytes`);
  }
  if (session.receivedBytes + chunk.byteLength > session.totalBytes) {
    throw new HttpError(400, 'Chunk would exceed totalBytes');
  }

  fs.appendFileSync(sessionPath(id), chunk);
  session.receivedBytes += chunk.byteLength;

  if (session.receivedBytes >= session.totalBytes) {
    await finalizeUpload(session);
  }

  res.json({
    uploadId: id,
    receivedBytes: session.receivedBytes,
    totalBytes: session.totalBytes,
    status: session.status,
    sniffedMime: session.sniffedMime,
    avStatus: session.avStatus,
    rejectReason: session.rejectReason,
  });
}

async function finalizeUpload(session: UploadSession): Promise<void> {
  const filePath = sessionPath(session.id);
  const buf = fs.readFileSync(filePath);
  session.sha256 = createHash('sha256').update(buf).digest('hex');
  const magic = sniffMime(buf);
  session.sniffedMime = magic === 'unknown' ? 'application/octet-stream' : magic;

  // MIME family must roughly match declaration (or be octet-stream / text)
  const declared = session.declaredMime.toLowerCase();
  const sniffedMime = session.sniffedMime.toLowerCase();
  const familyOk =
    sniffedMime === 'application/octet-stream' ||
    declared.split('/')[0] === sniffedMime.split('/')[0] ||
    (declared.includes('pdf') && sniffedMime.includes('pdf')) ||
    (declared.startsWith('text/') && sniffedMime.startsWith('text/'));

  session.status = 'quarantine';
  session.avStatus = await runAvScan(filePath);

  if (!familyOk) {
    session.status = 'rejected';
    session.rejectReason = `MIME mismatch: declared ${declared}, sniffed ${sniffedMime}`;
    return;
  }
  if (session.avStatus === 'infected') {
    session.status = 'rejected';
    session.rejectReason = 'AV scanner flagged malware';
    try {
      fs.unlinkSync(filePath);
    } catch {
      /* ignore */
    }
    return;
  }
  if (session.avStatus === 'error') {
    session.status = 'rejected';
    session.rejectReason = 'AV scanner unavailable';
    return;
  }

  session.status = 'ready';
}

/** GET /api/uploads/resumable/:id — status */
export async function getResumableUploadHandler(req: Request, res: Response): Promise<void> {
  const user = getAuthUser(res);
  const session = getSessionOrThrow(String(req.params.id ?? ''), user.uid);
  res.json({
    uploadId: session.id,
    filename: session.filename,
    receivedBytes: session.receivedBytes,
    totalBytes: session.totalBytes,
    status: session.status,
    sniffedMime: session.sniffedMime,
    avStatus: session.avStatus,
    sha256: session.sha256 || undefined,
    rejectReason: session.rejectReason,
    expireAt: session.expireAt,
  });
}

export function resumableUploadStats(): { sessions: number; quarantineRoot: string } {
  return { sessions: sessions.size, quarantineRoot };
}
