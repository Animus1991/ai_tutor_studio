/**
 * File-backed Yjs persistence adapter for @y/websocket-server.
 * Restores CRDT state on first bind; writes durable snapshots on idle.
 *
 * Loads the same nested `yjs@14` instance that `@y/websocket-server` uses
 * (avoids dual-import constructor breakage — yjs#438).
 */
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { setPersistence } from '@y/websocket-server/utils';
import {
  loadYjsPayload,
  persistYjsPayload,
  getYjsSnapshot,
} from './yjsSnapshotStore.js';

const require = createRequire(import.meta.url);

type YModule = {
  applyUpdate: (doc: unknown, update: Uint8Array, origin?: unknown) => void;
  encodeStateAsUpdate: (doc: unknown, encodedStateVector?: Uint8Array) => Uint8Array;
};

function resolveWsYjsUrl(): string {
  const wsEntry = require.resolve('@y/websocket-server/utils');
  const pkgJson = require.resolve('yjs/package.json', { paths: [wsEntry] });
  // Match the package "import" condition used by @y/websocket-server (src/index.js).
  return pathToFileURL(path.join(path.dirname(pkgJson), 'src/index.js')).href;
}

const YPromise: Promise<YModule> = import(resolveWsYjsUrl()) as Promise<YModule>;

let installed = false;
let Y: YModule | null = null;

export async function ensureYjsPersistenceReady(): Promise<void> {
  if (!Y) Y = await YPromise;
}

export function installYjsFilePersistence(): void {
  if (installed) return;
  installed = true;

  // Kick off module load; bind/write await it.
  void ensureYjsPersistenceReady();

  setPersistence({
    provider: null,
    bindState: (docName, ydoc) => {
      const name = docName.startsWith('/') ? docName : `/${docName}`;
      void (async () => {
        const y = Y ?? (await ensureYjsPersistenceReady(), Y!);
        const payload = loadYjsPayload(name);
        if (payload && payload.byteLength > 0) {
          try {
            y.applyUpdate(ydoc, new Uint8Array(payload));
          } catch (e) {
            console.warn('[yjsPersistence] failed to apply snapshot', name, e);
          }
        }
        let timer: ReturnType<typeof setTimeout> | null = null;
        const schedule = () => {
          if (timer) clearTimeout(timer);
          timer = setTimeout(() => {
            void writeDoc(name, ydoc);
          }, 2_000);
        };
        ydoc.on('update', schedule);
      })();
    },
    writeState: async (docName, ydoc) => {
      const name = docName.startsWith('/') ? docName : `/${docName}`;
      await writeDoc(name, ydoc);
    },
  });
}

async function writeDoc(docName: string, ydoc: unknown): Promise<void> {
  const y = Y ?? (await ensureYjsPersistenceReady(), Y!);
  try {
    const update = y.encodeStateAsUpdate(ydoc);
    if (!update.byteLength) return;
    const prev = getYjsSnapshot(docName);
    await persistYjsPayload(docName, Buffer.from(update), prev?.version);
  } catch (e) {
    const code = (e as { code?: string }).code;
    if (code === 'version_conflict') {
      try {
        const update = y.encodeStateAsUpdate(ydoc);
        await persistYjsPayload(docName, Buffer.from(update));
      } catch (inner) {
        console.warn('[yjsPersistence] write retry failed', docName, inner);
      }
      return;
    }
    console.warn('[yjsPersistence] write failed', docName, e);
  }
}

export function __resetYjsPersistenceForTests(): void {
  installed = false;
  setPersistence(null);
}
