import fs from 'fs';
import os from 'os';
import path from 'path';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  __resetYjsSnapshotStoreForTests,
  __setYjsSnapshotRootForTests,
  loadYjsPayload,
} from './yjsSnapshotStore.js';
import {
  __resetYjsPersistenceForTests,
  ensureYjsPersistenceReady,
  installYjsFilePersistence,
} from './yjsPersistence.js';
import { getPersistence } from '@y/websocket-server/utils';

const require = createRequire(import.meta.url);

async function loadWsYjs(): Promise<{
  Doc: new () => {
    getMap: (n: string) => { set: (k: string, v: unknown) => void; get: (k: string) => unknown };
    on: (e: string, fn: (...a: unknown[]) => void) => void;
  };
}> {
  const wsEntry = require.resolve('@y/websocket-server/utils');
  const pkgJson = require.resolve('yjs/package.json', { paths: [wsEntry] });
  const url = pathToFileURL(path.join(path.dirname(pkgJson), 'src/index.js')).href;
  return import(url) as never;
}

describe('yjsPersistence', () => {
  let dir: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'yjs-persist-'));
    __setYjsSnapshotRootForTests(dir);
    __resetYjsPersistenceForTests();
  });

  afterEach(() => {
    __resetYjsPersistenceForTests();
    __resetYjsSnapshotStoreForTests();
  });

  it('installs persistence that restores and writes CRDT payloads', async () => {
    const Y = await loadWsYjs();
    await ensureYjsPersistenceReady();
    installYjsFilePersistence();
    const persistence = getPersistence();
    expect(persistence).not.toBeNull();

    const doc = new Y.Doc();
    doc.getMap('meta').set('topic', 'chem');
    await persistence!.writeState('room-persist-1', doc as never);

    const loaded = loadYjsPayload('/room-persist-1');
    expect(loaded).not.toBeNull();
    expect(loaded!.byteLength).toBeGreaterThan(0);

    const doc2 = new Y.Doc();
    persistence!.bindState('room-persist-1', doc2 as never);
    // bindState restores asynchronously
    await new Promise((r) => setTimeout(r, 50));
    expect(doc2.getMap('meta').get('topic')).toBe('chem');
  });
});
