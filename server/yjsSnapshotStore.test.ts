import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  __resetYjsSnapshotStoreForTests,
  __setYjsSnapshotRootForTests,
  compactExpiredYjsSnapshots,
  getYjsSnapshot,
  loadYjsPayload,
  persistYjsPayload,
  touchYjsSnapshot,
} from './yjsSnapshotStore.js';

describe('yjsSnapshotStore', () => {
  let dir: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'yjs-snap-'));
    __setYjsSnapshotRootForTests(dir);
  });

  afterEach(() => {
    __resetYjsSnapshotStoreForTests();
  });

  it('persists metadata durably on touch', async () => {
    const rec = await touchYjsSnapshot('/room-abc12345', 120, { connect: true });
    expect(rec.roomId).toBe('room-abc12345');
    expect(rec.connects).toBe(1);
    expect(getYjsSnapshot('/room-abc12345')?.bytes).toBeGreaterThanOrEqual(120);
    expect(fs.existsSync(path.join(dir, '_room-abc12345.json')) || fs.existsSync(path.join(dir, 'room-abc12345.json'))).toBe(true);
  });

  it('optimistic version conflict on payload persist', async () => {
    const first = await persistYjsPayload('/doc-version1', Buffer.from('hello-yjs'));
    expect(first.version).toBe(1);
    expect(loadYjsPayload('/doc-version1')?.toString()).toBe('hello-yjs');
    await expect(persistYjsPayload('/doc-version1', Buffer.from('stale'), 0)).rejects.toMatchObject({
      code: 'version_conflict',
    });
    const second = await persistYjsPayload('/doc-version1', Buffer.from('next'), 1);
    expect(second.version).toBe(2);
  });

  it('compacts expired snapshots', async () => {
    const rec = await touchYjsSnapshot('/old-room-zzzz', 10);
    const metaFile = fs.readdirSync(dir).find((f) => f.endsWith('.json'))!;
    const raw = JSON.parse(fs.readFileSync(path.join(dir, metaFile), 'utf8'));
    raw.expireAt = new Date(Date.now() - 1000).toISOString();
    fs.writeFileSync(path.join(dir, metaFile), JSON.stringify(raw));
    expect(compactExpiredYjsSnapshots()).toBeGreaterThanOrEqual(1);
    expect(getYjsSnapshot(rec.docName)).toBeNull();
  });
});
