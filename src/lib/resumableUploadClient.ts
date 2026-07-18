/**
 * Client for POST/PUT /api/uploads/resumable — MIME sniff + optional AV before local extract.
 */
import { apiRequest } from './apiClient';
import { auth } from './firebase';

const CHUNK = 256 * 1024; // 256 KiB client chunks (under server 1 MiB max)

export type ResumableResult = {
  uploadId: string;
  status: string;
  sha256?: string;
  sniffedMime?: string;
  avStatus?: string;
  rejectReason?: string;
};

/**
 * Upload file through resumable pipeline when signed in.
 * Soft-skips (returns null) when unauthenticated or server rejects init.
 */
export async function uploadFileResumable(file: File): Promise<ResumableResult | null> {
  if (!auth.currentUser) return null;
  if (file.size <= 0 || file.size > 25 * 1024 * 1024) return null;

  const init = await apiRequest('/api/uploads/resumable', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      filename: file.name,
      mimeType: file.type || 'application/octet-stream',
      totalBytes: file.size,
    }),
  });
  if (!init.ok) return null;
  const { uploadId, chunkMax } = (await init.json()) as {
    uploadId: string;
    chunkMax?: number;
  };
  const maxChunk = Math.min(CHUNK, chunkMax ?? CHUNK);

  let offset = 0;
  let last: ResumableResult = { uploadId, status: 'uploading' };
  while (offset < file.size) {
    const end = Math.min(offset + maxChunk, file.size);
    const slice = file.slice(offset, end);
    const buf = new Uint8Array(await slice.arrayBuffer());
    // base64 for JSON transport (raw binary needs dedicated middleware)
    let binary = '';
    for (let i = 0; i < buf.length; i += 1) binary += String.fromCharCode(buf[i]!);
    const base64 = btoa(binary);

    const put = await apiRequest(`/api/uploads/resumable/${encodeURIComponent(uploadId)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ base64 }),
    });
    if (!put.ok) {
      const err = (await put.json().catch(() => ({}))) as { error?: string };
      throw new Error(err.error || 'Resumable chunk failed');
    }
    last = (await put.json()) as ResumableResult;
    offset = end;
  }

  if (last.status === 'rejected') {
    throw new Error(last.rejectReason || 'Upload rejected by quarantine');
  }
  return last;
}
