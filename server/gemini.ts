import type { GoogleGenAI } from '@google/genai';

export const geminiChatModel =
  process.env.GEMINI_CHAT_MODEL?.trim() || 'gemini-2.0-flash';

export const geminiEmbedModel =
  process.env.GEMINI_EMBED_MODEL?.trim() || 'gemini-embedding-001';

const CHAT_MODEL_FALLBACKS = [
  geminiChatModel,
  'gemini-2.0-flash',
  'gemini-1.5-flash',
].filter((model, index, all) => all.indexOf(model) === index);

export type GeminiApiErrorBody = {
  status: number;
  message: string;
  code: string;
};

export function formatGeminiApiError(error: unknown): GeminiApiErrorBody {
  const err = error as { status?: number; message?: string };
  const status = err.status ?? 500;
  const raw = String(err.message ?? error ?? '');

  if (
    status === 429 ||
    raw.includes('RESOURCE_EXHAUSTED') ||
    /depleted|quota|rate limit/i.test(raw)
  ) {
    return {
      status: 429,
      code: 'gemini_quota_exhausted',
      message:
        'Gemini API credits exhausted. Create or top up a key at https://aistudio.google.com/apikey (billing: https://ai.google.dev/gemini-api/docs/billing).',
    };
  }

  if (
    status === 401 ||
    status === 403 ||
    /API key not valid|invalid api key|permission denied/i.test(raw)
  ) {
    return {
      status: 401,
      code: 'gemini_api_key_invalid',
      message:
        'Invalid GEMINI_API_KEY. Create a key at https://aistudio.google.com/apikey and set it in .env.local.',
    };
  }

  if (status === 404 || /not found|not supported/i.test(raw)) {
    return {
      status: 502,
      code: 'gemini_model_not_found',
      message: `Gemini model unavailable. Set GEMINI_CHAT_MODEL / GEMINI_EMBED_MODEL in .env.local (current chat: ${geminiChatModel}, embed: ${geminiEmbedModel}).`,
    };
  }

  return {
    status: status >= 400 && status < 600 ? status : 500,
    code: 'gemini_api_error',
    message: 'Gemini API request failed',
  };
}

export function sendGeminiError(
  res: { status: (code: number) => { json: (body: unknown) => void } },
  error: unknown,
  logLabel: string,
): void {
  const formatted = formatGeminiApiError(error);
  if (formatted.code === 'gemini_quota_exhausted') {
    console.error(
      `${logLabel}: Gemini quota/credits exhausted for this Google Cloud project — creating a new API key in the same project does not add credits. Top up billing or use a new AI Studio project.`,
    );
  } else {
    console.error(`${logLabel}:`, error);
  }
  res.status(formatted.status).json({
    error: formatted.message,
    code: formatted.code,
  });
}

type GenerateContentParams = Parameters<GoogleGenAI['models']['generateContent']>[0];

export async function generateChatWithFallback(
  ai: GoogleGenAI,
  params: GenerateContentParams,
) {
  const requested = params.model;
  const candidates = requested
    ? [String(requested), ...CHAT_MODEL_FALLBACKS]
    : CHAT_MODEL_FALLBACKS;
  const models = candidates.filter(
    (model, index, all) => all.indexOf(model) === index,
  );

  let lastError: unknown;
  for (const model of models) {
    try {
      return await ai.models.generateContent({ ...params, model });
    } catch (error) {
      lastError = error;
      const formatted = formatGeminiApiError(error);
      if (formatted.code === 'gemini_model_not_found') continue;
      throw error;
    }
  }

  throw lastError ?? new Error('No Gemini chat model available');
}

export async function streamChatWithFallback(
  ai: GoogleGenAI,
  params: GenerateContentParams,
) {
  const requested = params.model;
  const candidates = requested
    ? [String(requested), ...CHAT_MODEL_FALLBACKS]
    : CHAT_MODEL_FALLBACKS;
  const models = candidates.filter(
    (model, index, all) => all.indexOf(model) === index,
  );

  let lastError: unknown;
  for (const model of models) {
    try {
      return await ai.models.generateContentStream({ ...params, model });
    } catch (error) {
      lastError = error;
      const formatted = formatGeminiApiError(error);
      if (formatted.code === 'gemini_model_not_found') continue;
      throw error;
    }
  }

  throw lastError ?? new Error('No Gemini chat model available');
}
