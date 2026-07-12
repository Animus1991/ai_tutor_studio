export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function parseResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let message = 'Network response was not ok';
    try {
      const body = await response.json();
      message = body.error ?? body.message ?? message;
    } catch {
      /* ignore parse errors */
    }
    throw new ApiError(message, response.status);
  }
  return response.json();
}

export async function chatWithAgent(
  messages: { role: string; parts: { text: string }[] }[],
  systemInstruction: string,
  model = 'gemini-3.5-flash',
) {
  const response = await fetch('/api/agent/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages, systemInstruction, model }),
  });
  return parseResponse<{ text: string; urls?: string[] }>(response);
}

/** Stream agent tokens via SSE; calls onChunk for each text delta. */
export async function streamChatWithAgent(
  messages: { role: string; parts: { text: string }[] }[],
  systemInstruction: string,
  onChunk: (text: string) => void,
  model = 'gemini-3.5-flash',
): Promise<void> {
  const response = await fetch('/api/agent/chat/stream', {
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
        const payload = JSON.parse(line.slice(6)) as { text?: string; error?: string; done?: boolean };
        if (payload.error) throw new ApiError(payload.error, 500);
        if (payload.text) onChunk(payload.text);
      } catch (e) {
        if (e instanceof ApiError) throw e;
      }
    }
  }
}

export async function batchIngestYoutube(urls: string[]) {
  const response = await fetch('/api/ingest/youtube/batch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ urls }),
  });
  return parseResponse<{ results: Array<{ url: string; videoId?: string; title?: string; text?: string; error?: string }> }>(response);
}

export async function generateImage(prompt: string) {
  const response = await fetch('/api/generate-image', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt }),
  });
  return parseResponse<{ image: string }>(response);
}

export async function generateFlashcards(text: string) {
  const response = await fetch('/api/generate-flashcards', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });
  return parseResponse<{ flashcards: { question: string; answer: string }[] }>(response);
}

export async function summarizeNotes(text: string) {
  const response = await fetch('/api/summarize-notes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });
  return parseResponse<{ summary: string }>(response);
}

export async function feynmanCheck(source: string, explanation: string) {
  const response = await fetch('/api/feynman-check', {
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
