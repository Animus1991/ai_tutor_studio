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
