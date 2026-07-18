import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('localforage', () => {
  const store = new Map<string, unknown>();
  return {
    default: {
      getItem: vi.fn(async (key: string) => store.get(key) ?? null),
      setItem: vi.fn(async (key: string, value: unknown) => {
        store.set(key, value);
      }),
      removeItem: vi.fn(async (key: string) => {
        store.delete(key);
      }),
      clear: vi.fn(async () => store.clear()),
    },
  };
});

import {
  LibraryConflictError,
  loadLibrary,
  persistLibraryCourse,
  saveLibrary,
  tombstoneLibraryCourse,
} from '../libraryStorage';

describe('libraryStorage optimistic concurrency', () => {
  beforeEach(async () => {
    const { default: localforage } = await import('localforage');
    await localforage.clear();
  });

  it('increments libraryVersion on save', async () => {
    const a = await saveLibrary({ courses: [], uploadedFiles: [], libraryVersion: 0 });
    expect(a.libraryVersion).toBe(1);
    const b = await saveLibrary(a, a.libraryVersion);
    expect(b.libraryVersion).toBe(2);
  });

  it('throws on version mismatch', async () => {
    await saveLibrary({ courses: [], uploadedFiles: [], libraryVersion: 0 });
    await expect(
      saveLibrary({ courses: [], uploadedFiles: [], libraryVersion: 0 }, 0),
    ).rejects.toBeInstanceOf(LibraryConflictError);
  });

  it('tombstones course files on delete', async () => {
    const course = {
      id: 'c1',
      title: 'T',
      topics: [],
      glossary: [],
      prerequisites: [],
      uploadedFileIds: ['f1'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const file = {
      id: 'f1',
      name: 'a.pdf',
      mimeType: 'application/pdf',
      extractedText: 'hello world '.repeat(20),
      courseId: 'c1',
      pipelineVersion: '2.0.0',
      createdAt: new Date().toISOString(),
    };
    await persistLibraryCourse(course, file);
    const next = await tombstoneLibraryCourse('c1');
    expect(next.courses).toHaveLength(0);
    expect((next.uploadedFiles[0] as { tombstonedAt?: string }).tombstonedAt).toBeTruthy();
    const loaded = await loadLibrary();
    expect(loaded.libraryVersion).toBeGreaterThan(0);
  });
});
