import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../lib/libraryStorage', () => ({
  loadLibrary: vi.fn(async () => ({
    courses: [{ id: 'c1', title: 'Chem' }],
    uploadedFiles: [{ id: 'f1' }],
  })),
}));

vi.mock('localforage', () => {
  const store = new Map<string, unknown>();
  return {
    default: {
      getItem: vi.fn(async (key: string) => store.get(key) ?? null),
      setItem: vi.fn(async (key: string, value: unknown) => {
        store.set(key, value);
      }),
    },
  };
});

import {
  buildOfflineStudyPack,
  signOfflinePack,
  verifyOfflinePack,
} from '../lib/offlineStudyPack';

describe('offlineStudyPack', () => {
  beforeEach(() => {
    vi.stubGlobal('crypto', globalThis.crypto);
  });

  it('builds a signed v2 pack with content hash', async () => {
    const pack = await buildOfflineStudyPack();
    expect(pack.version).toBe(2);
    expect(pack.manifest.contentHash).toMatch(/^[a-f0-9]{64}$/);
    expect(pack.manifest.algorithm).toBe('sha256');
    expect(pack.routes).toContain('/agent');
    const check = await verifyOfflinePack(pack);
    expect(check.ok).toBe(true);
  });

  it('rejects tampered pack content', async () => {
    const pack = await buildOfflineStudyPack();
    pack.stats.courseCount = 999;
    const check = await verifyOfflinePack(pack);
    expect(check.ok).toBe(false);
  });

  it('signs canonical payload deterministically for same input', async () => {
    const unsigned = {
      version: 2 as const,
      exportedAt: '2026-01-01T00:00:00.000Z',
      courses: [],
      stats: { courseCount: 0, fileCount: 0 },
      routes: ['/'],
    };
    const a = await signOfflinePack(unsigned);
    const b = await signOfflinePack(unsigned);
    expect(a.contentHash).toBe(b.contentHash);
  });
});
