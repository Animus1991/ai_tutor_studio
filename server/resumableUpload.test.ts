import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  __resetResumableUploadsForTests,
  __setQuarantineRootForTests,
  appendResumableChunkHandler,
  getResumableUploadHandler,
  initResumableUploadHandler,
} from './resumableUpload.js';

function mockRes() {
  const res: {
    locals: { user: { uid: string; claims: object } };
    statusCode: number;
    body: unknown;
    status: (n: number) => typeof res;
    json: (b: unknown) => typeof res;
  } = {
    locals: { user: { uid: 'u-upload', claims: {} } },
    statusCode: 200,
    body: null,
    status(n: number) {
      this.statusCode = n;
      return this;
    },
    json(b: unknown) {
      this.body = b;
      return this;
    },
  };
  return res;
}

describe('resumableUpload', () => {
  let dir: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'upload-q-'));
    __setQuarantineRootForTests(dir);
  });

  afterEach(() => {
    __resetResumableUploadsForTests();
  });

  it('init → chunk → ready with MIME sniff', async () => {
    const res = mockRes();
    const pdf = Buffer.from('%PDF-1.4 minimal');
    await initResumableUploadHandler(
      {
        body: { filename: 'notes.pdf', mimeType: 'application/pdf', totalBytes: pdf.byteLength },
      } as never,
      res as never,
    );
    expect(res.statusCode).toBe(201);
    const uploadId = (res.body as { uploadId: string }).uploadId;

    const res2 = mockRes();
    await appendResumableChunkHandler(
      { params: { id: uploadId }, body: { base64: pdf.toString('base64') } } as never,
      res2 as never,
    );
    const body = res2.body as { status: string; sniffedMime?: string; avStatus: string };
    expect(body.status).toBe('ready');
    expect(body.sniffedMime).toBe('application/pdf');
    expect(body.avStatus).toBe('skipped');

    const res3 = mockRes();
    await getResumableUploadHandler({ params: { id: uploadId } } as never, res3 as never);
    expect((res3.body as { sha256: string }).sha256).toHaveLength(64);
  });
});
