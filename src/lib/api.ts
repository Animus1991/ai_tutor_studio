import { apiRequest } from './apiClient';
import {
  ApiError,
  DemoModeError,
  errorFromResponse,
} from './apiErrors';

export { ApiError, DemoModeError };

async function parseResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    throw await errorFromResponse(response);
  }
  return response.json();
}

export function isGeminiUnavailable(error: unknown): boolean {
  return (
    error instanceof ApiError &&
    (error.status === 429 ||
      error.status === 401 ||
      error.code === 'gemini_quota_exhausted' ||
      error.code === 'gemini_api_key_invalid' ||
      error.code === 'gemini_model_not_found')
  );
}

export async function chatWithAgent(
  messages: { role: string; parts: { text: string }[] }[],
  systemInstruction: string,
  model = 'gemini-2.0-flash',
) {
  const response = await apiRequest('/api/agent/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages, systemInstruction, model }),
  });
  return parseResponse<{ text: string; urls?: string[] }>(response);
}

export interface AgentCitation {
  uri: string;
  title?: string;
}

export interface StreamAgentHandlers {
  /** Called for each streamed text delta. */
  onChunk: (text: string) => void;
  /** Called incrementally as each grounding citation is discovered. */
  onCitation?: (citation: AgentCitation) => void;
  /** Called once at the end with the full list of grounding URLs. */
  onDone?: (urls: string[]) => void;
}

/**
 * Stream agent tokens via SSE.
 * Accepts either a plain `onChunk` callback (back-compat) or a handlers object
 * that additionally receives grounding citations as they arrive.
 */
export async function streamChatWithAgent(
  messages: { role: string; parts: { text: string }[] }[],
  systemInstruction: string,
  onChunkOrHandlers: ((text: string) => void) | StreamAgentHandlers,
  model = 'gemini-2.0-flash',
): Promise<void> {
  const handlers: StreamAgentHandlers =
    typeof onChunkOrHandlers === 'function' ? { onChunk: onChunkOrHandlers } : onChunkOrHandlers;

  const response = await apiRequest('/api/agent/chat/stream', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages, systemInstruction, model }),
  });

  if (!response.ok) {
    await parseResponse<never>(response);
    return;
  }

  const reader = response.body?.getReader();
  if (!reader) throw new ApiError('No response body', response.status);

  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      try {
        const payload = JSON.parse(line.slice(6)) as {
          text?: string;
          error?: string;
          code?: string;
          done?: boolean;
          citation?: AgentCitation;
          urls?: string[];
        };
        if (payload.error) {
          throw new ApiError(
            payload.error,
            payload.code === 'gemini_quota_exhausted' ? 429 : 500,
            payload.code,
          );
        }
        if (payload.text) handlers.onChunk(payload.text);
        if (payload.citation) handlers.onCitation?.(payload.citation);
        if (payload.done) handlers.onDone?.(payload.urls ?? []);
      } catch (e) {
        if (e instanceof ApiError) throw e;
      }
    }
  }
}

export async function batchIngestYoutube(urls: string[]) {
  const response = await apiRequest('/api/ingest/youtube/batch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ urls }),
  });
  return parseResponse<{
    results: Array<{ url: string; videoId?: string; title?: string; text?: string; error?: string }>;
    expandedCount?: number;
    truncated?: boolean;
  }>(response);
}

export async function generateImage(prompt: string) {
  const response = await apiRequest('/api/generate-image', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt }),
  });
  return parseResponse<{ image: string }>(response);
}

export async function generateFlashcards(text: string) {
  const response = await apiRequest('/api/generate-flashcards', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });
  return parseResponse<{ flashcards: { question: string; answer: string }[] }>(response);
}

export async function summarizeNotes(text: string) {
  const response = await apiRequest('/api/summarize-notes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });
  return parseResponse<{ summary: string }>(response);
}

export async function feynmanCheck(source: string, explanation: string) {
  const response = await apiRequest('/api/feynman-check', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ source, explanation }),
  });
  return parseResponse<{ praise: string; gaps: string[] }>(response);
}

export async function checkHealth(): Promise<boolean> {
  try {
    const res = await fetch('/api/health');
    return res.ok;
  } catch {
    return false;
  }
}
export async function transcribeAudio(blob: Blob): Promise<string> {
  // Not fully implemented yet
  return "Audio transcription placeholder";
}

export async function synthesizeSpeech(text: string): Promise<Blob> {
  // Not fully implemented yet
  return new Blob(["dummy audio"], { type: "audio/mp3" });
}
