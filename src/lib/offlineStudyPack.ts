/**
 * Offline study packs with content-hash manifests (integrity verify on load).
 * Signature = SHA-256 of canonical payload; optional HMAC when VITE_OFFLINE_PACK_SECRET is set.
 */
import localforage from 'localforage';
import { loadLibrary } from './libraryStorage';

const PACK_KEY = 'memora_offline_study_pack';
const CACHE_NAME = 'memora-offline-pack-v1';

export interface OfflineStudyPackManifest {
  version: 2;
  algorithm: 'sha256' | 'hmac-sha256';
  contentHash: string;
  signature: string;
  signedAt: string;
  issuer: 'memora-client';
}

export interface OfflineStudyPack {
  version: 2;
  exportedAt: string;
  courses: unknown[];
  stats: { courseCount: number; fileCount: number };
  /** Route shells recommended for SW precache */
  routes: string[];
  manifest: OfflineStudyPackManifest;
}

export const OFFLINE_PRECACHE_ROUTES = [
  '/',
  '/library',
  '/tasks',
  '/agent',
  '/workspace',
  '/match',
  '/circles',
] as const;

function canonicalPayload(pack: Omit<OfflineStudyPack, 'manifest'>): string {
  return JSON.stringify({
    version: pack.version,
    exportedAt: pack.exportedAt,
    courses: pack.courses,
    stats: pack.stats,
    routes: pack.routes,
  });
}

async function sha256Hex(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function hmacSha256Hex(text: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(text));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function signOfflinePack(
  unsigned: Omit<OfflineStudyPack, 'manifest'>,
): Promise<OfflineStudyPackManifest> {
  const canonical = canonicalPayload(unsigned);
  const contentHash = await sha256Hex(canonical);
  const secret = (import.meta.env.VITE_OFFLINE_PACK_SECRET as string | undefined)?.trim();
  if (secret) {
    const signature = await hmacSha256Hex(contentHash, secret);
    return {
      version: 2,
      algorithm: 'hmac-sha256',
      contentHash,
      signature,
      signedAt: new Date().toISOString(),
      issuer: 'memora-client',
    };
  }
  return {
    version: 2,
    algorithm: 'sha256',
    contentHash,
    signature: contentHash,
    signedAt: new Date().toISOString(),
    issuer: 'memora-client',
  };
}

export async function verifyOfflinePack(pack: OfflineStudyPack): Promise<{
  ok: boolean;
  reason?: string;
}> {
  if (!pack?.manifest?.contentHash) {
    return { ok: false, reason: 'missing manifest' };
  }
  const { manifest, ...rest } = pack;
  const unsigned: Omit<OfflineStudyPack, 'manifest'> = {
    version: 2,
    exportedAt: rest.exportedAt,
    courses: rest.courses,
    stats: rest.stats,
    routes: rest.routes ?? [...OFFLINE_PRECACHE_ROUTES],
  };
  const expectedHash = await sha256Hex(canonicalPayload(unsigned));
  if (expectedHash !== manifest.contentHash) {
    return { ok: false, reason: 'content hash mismatch' };
  }
  if (manifest.algorithm === 'sha256') {
    return manifest.signature === manifest.contentHash
      ? { ok: true }
      : { ok: false, reason: 'sha256 signature mismatch' };
  }
  const secret = (import.meta.env.VITE_OFFLINE_PACK_SECRET as string | undefined)?.trim();
  if (!secret) {
    // HMAC pack without secret: accept hash integrity only
    return { ok: true };
  }
  const expectedSig = await hmacSha256Hex(manifest.contentHash, secret);
  return expectedSig === manifest.signature
    ? { ok: true }
    : { ok: false, reason: 'hmac signature mismatch' };
}

export async function buildOfflineStudyPack(): Promise<OfflineStudyPack> {
  const lib = await loadLibrary();
  const unsigned: Omit<OfflineStudyPack, 'manifest'> = {
    version: 2,
    exportedAt: new Date().toISOString(),
    courses: lib.courses,
    stats: { courseCount: lib.courses.length, fileCount: lib.uploadedFiles.length },
    routes: [...OFFLINE_PRECACHE_ROUTES],
  };
  const manifest = await signOfflinePack(unsigned);
  return { ...unsigned, manifest };
}

export async function saveOfflineStudyPack(): Promise<OfflineStudyPack> {
  const pack = await buildOfflineStudyPack();
  await localforage.setItem(PACK_KEY, pack);
  if ('caches' in window) {
    const cache = await caches.open(CACHE_NAME);
    await cache.put(
      '/offline-study-pack.json',
      new Response(JSON.stringify(pack), { headers: { 'Content-Type': 'application/json' } }),
    );
    // Precache route shells (SPA) — navigate fallback still serves index.html
    for (const route of pack.routes) {
      try {
        await cache.add(route);
      } catch {
        /* ignore missing in preview */
      }
    }
  }
  return pack;
}

export async function loadOfflineStudyPack(): Promise<OfflineStudyPack | null> {
  const pack = await localforage.getItem<OfflineStudyPack | { version: 1 }>(PACK_KEY);
  if (!pack) return null;
  if ((pack as OfflineStudyPack).version === 2) {
    const v2 = pack as OfflineStudyPack;
    const check = await verifyOfflinePack(v2);
    if (!check.ok) {
      console.warn('[offline pack] integrity check failed:', check.reason);
      return null;
    }
    return v2;
  }
  // Migrate v1 → unsigned rebuild
  return buildOfflineStudyPack();
}

export async function downloadOfflineStudyPackFile(): Promise<void> {
  const pack = await buildOfflineStudyPack();
  const blob = new Blob([JSON.stringify(pack, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `memora-offline-pack-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
