import localforage from 'localforage';
import { apiRequest } from './apiClient';
import { summarizeAudio } from './services/audioService';

export async function transcribeMediaFile(file: File): Promise<string> {
  return summarizeAudio(file);
}

export async function analyzeMediaFile(
  file: File,
): Promise<{ summary: string; text?: string }> {
  const form = new FormData();
  form.append('media', file);
  const res = await apiRequest('/api/analyze-media', { method: 'POST', body: form });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? 'Media analysis failed');
  }
  return res.json();
}

/** Append HTML snippet to shared document notes (Library / DocumentWorkspace). */
export async function appendToDocNotes(html: string): Promise<void> {
  const notesStr = await localforage.getItem<string>('memora-doc-notes');
  const existing = (notesStr ?? '').replace(/^"|"$/g, '');
  await localforage.setItem('memora-doc-notes', JSON.stringify(existing + html));
}

export function buildMediaSummaryHtml(title: string, body: string): string {
  const safeTitle = title.replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const safeBody = body.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br/>');
  return `<p><strong>[${safeTitle}]</strong><br/>${safeBody}</p>`;
}
