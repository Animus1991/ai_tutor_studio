import { openDB } from 'idb';
import { StateStorage } from 'zustand/middleware';

const dbName = 'memora-storage';
const storeName = 'zustand-store';

const dbPromise = openDB(dbName, 1, {
  upgrade(db) {
    if (!db.objectStoreNames.contains(storeName)) {
      db.createObjectStore(storeName);
    }
  },
});

export const idbStorage: StateStorage = {
  getItem: async (name: string): Promise<string | null> => {
    const db = await dbPromise;
    const value = await db.get(storeName, name);
    return value || null;
  },
  setItem: async (name: string, value: string): Promise<void> => {
    const db = await dbPromise;
    await db.put(storeName, value, name);
  },
  removeItem: async (name: string): Promise<void> => {
    const db = await dbPromise;
    await db.delete(storeName, name);
  },
};
