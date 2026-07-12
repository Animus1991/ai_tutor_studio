import localforage from 'localforage';
import { loadLibrary } from './libraryStorage';

const PACK_KEY = 'memora_offline_study_pack';

export interface OfflineStudyPack {
  version: 1;
  exportedAt: string;
  courses: unknown[];
  stats: { courseCount: number; fileCount: number };
}

export async function buildOfflineStudyPack(): Promise<OfflineStudyPack> {
  const lib = await loadLibrary();
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    courses: lib.courses,
    stats: { courseCount: lib.courses.length, fileCount: lib.uploadedFiles.length },
  };
}

export async function saveOfflineStudyPack(): Promise<OfflineStudyPack> {
  const pack = await buildOfflineStudyPack();
  await localforage.setItem(PACK_KEY, pack);
  if ('caches' in window) {
    const cache = await caches.open('memora-offline-pack-v1');
    await cache.put(
      '/offline-study-pack.json',
      new Response(JSON.stringify(pack), { headers: { 'Content-Type': 'application/json' } })
    );
  }
  return pack;
}

export async function loadOfflineStudyPack(): Promise<OfflineStudyPack | null> {
  return localforage.getItem<OfflineStudyPack>(PACK_KEY);
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
