import * as cheerio from "cheerio";
import dotenv from 'dotenv';
import path from 'path';
import express from 'express';
import http from 'http';
import cors from 'cors';
import helmet from 'helmet';
import { rateLimit, ipKeyGenerator } from 'express-rate-limit';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import multer from 'multer';
import { YoutubeTranscript } from 'youtube-transcript';
import { OfficeParser } from "officeparser";
import { createRequire } from 'module';
import { appendPersistedAudit, loadPersistedAudit } from './auditStore.js';
import firebaseConfig from './firebase-applet-config.json';
import {
  fetchPlatformAuditFromFirestore,
  fetchTenantMetricsFromFirestore,
  persistAuditToFirestore,
} from './firebaseAdmin.js';
import {
  assertPublicHttpUrl,
  createFirebaseAuthMiddleware,
  HttpError,
  requiredString,
} from './server/security.js';
import { detectAndSanitizePii } from './src/lib/piiSanitizer.js';
import {
  geminiChatModel,
  geminiEmbedModel,
  formatGeminiApiError,
  generateChatWithFallback,
  sendGeminiError,
  streamChatWithFallback,
} from './server/gemini.js';
import { geminiKeyFingerprint, resolveGeminiApiKey } from './server/geminiEnv.js';
import {
  classDetailHandler,
  createClassHandler,
  joinClassHandler,
  listAssignmentMapsHandler,
  listClassesHandler,
  mapAssignmentHandler,
  reportProgressHandler,
  syncClassroomRosterHandler,
} from './server/teacher.js';
import {
  getLibraryHandler,
  listRoomReportsHandler,
  putLibraryHandler,
  ragIndexHandler,
  ragQueryHandler,
} from './server/libraryRag.js';
import {
  createMeetHandler,
  enqueueMatchHandler,
  getSessionHandler,
  leaveQueueHandler,
  leaveSessionHandler,
  matchStatusHandler,
  heartbeatHandler,
  matchMetricsHandler,
  meetConsentHandler,
  pomodoroHandler,
  postMessageHandler,
  quietFocusHandler,
  reactMessageHandler,
  respectVoteHandler,
  reportSessionHandler,
  saveNotesHandler,
} from './server/studyMatch.js';
import { moderateContentHandler, moderatePlatformContent } from './server/platformModeration.js';
import {
  createIdempotencyMiddleware,
  createTraceMiddleware,
  extractAgentUserTexts,
} from './server/requestSpine.js';
import { createAppCheckMiddleware } from './server/appCheck.js';
import {
  privacyDeleteRequestHandler,
  privacyExportHandler,
} from './server/privacy.js';
import {
  evidenceEvalHandler,
  evidencePrinciplesHandler,
  purgeExpiredXapiHandler,
  researchExportHandler,
  xapiStatementsHandler,
} from './server/evidence.js';
import {
  approveBreakGlassHandler,
  assignClaimHandler,
  listBreakGlassHandler,
} from './server/claims.js';
import {
  auditFormFromRequest,
  auditMeetFromRequest,
} from './server/googleWorkspaceAudit.js';
import {
  appendModeSafety,
  looksLikeExamAnswerDump,
  modeAllowsGoogleSearch,
  normalizeAgentMode,
} from './server/agentModes.js';
import {
  getLearningSummaryHandler,
  postLearningEventHandler,
} from './server/learningEvents.js';
import {
  listSocialReportsHandler,
  roomCreateMeetHandler,
  roomMeetConsentHandler,
  socialReportHandler,
  triageSocialReportHandler,
} from './server/socialPolicy.js';
const _require = createRequire(typeof import.meta !== 'undefined' && import.meta.url ? import.meta.url : 'file://' + process.cwd() + '/server.ts');
const pdfParse = _require('pdf-parse');

const projectRoot = process.cwd();
dotenv.config({ path: path.join(projectRoot, '.env') });
dotenv.config({ path: path.join(projectRoot, '.env.local'), override: true });

const geminiApiKey = resolveGeminiApiKey();

if (!geminiApiKey) {
  console.warn('[Memora] GEMINI_API_KEY is not set — AI endpoints will fail until configured.');
} else if (process.env.NODE_ENV !== 'production') {
  console.log(`[Memora] Gemini key loaded: ${geminiKeyFingerprint(geminiApiKey)}`);
  console.log(`[Memora] Gemini chat model: ${geminiChatModel}, embed: ${geminiEmbedModel}`);
}

// Initialize Gemini
const ai = new GoogleGenAI({ apiKey: geminiApiKey });
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });

/** Simple in-memory rate limiter per IP for AI routes. */
function createRateLimiter(maxRequests: number, windowMs: number, code = 'local_rate_limit') {
  const hits = new Map<string, { count: number; resetAt: number }>();
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const ip = req.ip ?? req.socket.remoteAddress ?? 'unknown';
    const now = Date.now();
    const entry = hits.get(ip);
    if (!entry || now > entry.resetAt) {
      hits.set(ip, { count: 1, resetAt: now + windowMs });
      return next();
    }
    if (entry.count >= maxRequests) {
      return res.status(429).json({
        error: 'Too many AI requests from this device. Wait a minute and try again.',
        code,
      });
    }
    entry.count++;
    return next();
  };
}

const isDev = process.env.NODE_ENV !== 'production';
const aiRateLimit = createRateLimiter(isDev ? 500 : 30, 60_000);

const extractVisualDocumentText = async (
  buffer: Buffer,
  mimeType: string,
): Promise<string> => {
  const response = await ai.models.generateContent({
    model: geminiChatModel,
    contents: [
      {
        role: "user",
        parts: [
          {
            inlineData: {
              mimeType,
              data: buffer.toString("base64"),
            },
          },
          {
            text: `Transcribe this study material faithfully.
Preserve headings, lists, formulas, table relationships, slide/page boundaries and uncertainty.
Do not summarize, enrich, correct, or invent missing text.
Mark illegible spans as [ILLEGIBLE].`,
          },
        ],
      },
    ],
  });
  return response.text?.trim() || "";
};

const sanitizeAiPayload = <T,>(value: T, depth = 0): T => {
  if (depth > 8) throw new HttpError(400, "AI payload is nested too deeply");
  if (typeof value === "string") {
    return detectAndSanitizePii(value).sanitizedText as T;
  }
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeAiPayload(item, depth + 1)) as T;
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        sanitizeAiPayload(item, depth + 1),
      ]),
    ) as T;
  }
  return value;
};

function sanitizeAiText(value: unknown, field: string, maxLength: number): string {
  const trimmed = requiredString(value, field, maxLength);
  return detectAndSanitizePii(trimmed).sanitizedText;
}

function sendRouteError(
  res: express.Response,
  error: unknown,
  logLabel: string,
  clientMessage: string,
): void {
  if (error instanceof HttpError) {
    console.error(`${logLabel}:`, error.message);
    res.status(error.status).json({ error: error.message });
    return;
  }
  console.error(`${logLabel}:`, error);
  res.status(500).json({ error: clientMessage });
}

const PUBLIC_API_PATHS = new Set([
  '/health',
  '/health/gemini',
  '/logs',
  '/logs/batch',
  '/audit',
]);

/** Paths as seen inside app.use('/api', …) — mount-relative, not /api/… */
function isPublicApiRoute(req: express.Request): boolean {
  if (PUBLIC_API_PATHS.has(req.path)) return true;
  const full = `${req.baseUrl}${req.path}`.replace(/\/+/g, '/');
  return PUBLIC_API_PATHS.has(full.replace(/^\/api/, '') || full);
}

function buildContentSecurityPolicy(isProduction: boolean) {
  const devWsSources = isProduction ? [] : ['ws:', 'wss:'];
  let yjsWsSource: string | null = null;
  try {
    if (process.env.APP_URL) {
      yjsWsSource = new URL(process.env.APP_URL.replace(/^http/i, 'ws')).origin;
    }
  } catch {
    yjsWsSource = null;
  }

  return {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: [
        "'self'",
        "'unsafe-inline'",
        ...(isProduction ? [] : ["'unsafe-eval'"]),
        'https://cdn.jsdelivr.net',
        'https://apis.google.com',
      ],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
      connectSrc: [
        "'self'",
        'https://*.googleapis.com',
        'https://*.google.com',
        'https://*.firebaseio.com',
        'https://*.firebaseapp.com',
        'wss://*.firebaseio.com',
        'wss://demos.yjs.dev',
        ...(yjsWsSource ? [yjsWsSource] : []),
        ...devWsSources,
      ],
      workerSrc: ["'self'", 'blob:', 'https://cdn.jsdelivr.net'],
      fontSrc: ["'self'", 'data:', 'https:', 'https://fonts.gstatic.com'],
      mediaSrc: ["'self'", 'blob:', 'https://cdn.pixabay.com'],
      frameSrc: [
        "'self'",
        'https://accounts.google.com',
        'https://meet.google.com',
        'https://*.firebaseapp.com',
        'https://*.google.com',
      ],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
    },
  };
}

/** Audit events: hydrated from disk, appended on each client POST. */
let serverAuditLogs: Array<Record<string, unknown>> = loadPersistedAudit();

function pushServerAudit(event: Record<string, unknown>) {
  serverAuditLogs.push(event);
  if (serverAuditLogs.length > 5000) {
    serverAuditLogs = serverAuditLogs.slice(-5000);
  }
  appendPersistedAudit(event);
  void persistAuditToFirestore(event).catch(() => {
    /* Firestore optional when service account not configured */
  });
}

async function extractArticleText(url: string): Promise<string> {
  const parsed = await assertPublicHttpUrl(url);
  const res = await fetch(parsed.href, {
    headers: { 'User-Agent': 'MemoraStudyBot/1.0 (+https://memora.app)' },
    redirect: 'follow',
  });
  if (!res.ok) throw new Error(`Failed to fetch URL (${res.status})`);
  const html = await res.text();
  const $ = cheerio.load(html);
  $('script, style, nav, footer, aside, noscript, iframe').remove();
  const article =
    $('article').text().trim() ||
    $('main').text().trim() ||
    $('[role="main"]').text().trim() ||
    $('body').text().trim();
  return article.replace(/\s+/g, ' ').slice(0, 120_000);
}

function extractPlaylistId(url: string): string | null {
  const m = url.match(/[?&]list=([\w-]+)/);
  // Ignore auto-generated "Radio"/mix playlists which are not expandable.
  if (!m || /^(RD|UL|LL|WL)/.test(m[1])) return null;
  return m[1];
}

function collectVideoIds(source: string, ids: string[], seen: Set<string>, max: number) {
  const re = /"videoId":"([\w-]{11})"/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(source)) !== null && ids.length < max) {
    const id = match[1];
    if (!seen.has(id)) {
      seen.add(id);
      ids.push(`https://www.youtube.com/watch?v=${id}`);
    }
  }
}

function findContinuationToken(source: string): string | null {
  const m =
    source.match(/"continuationCommand":\{"token":"([^"]+)"/) ||
    source.match(/"token":"([^"]+)","request":"CONTINUATION_REQUEST_TYPE_BROWSE"/);
  return m?.[1] ?? null;
}

/**
 * Expand a YouTube playlist URL into an ordered, de-duplicated list of
 * watch URLs by scraping the playlist page's embedded video IDs.
 *
 * Beyond the first page, it follows InnerTube (`youtubei/v1/browse`)
 * continuation tokens so playlists larger than ~100 items are fully expanded
 * up to `max`. Returns [] when the URL is not an expandable playlist.
 */
async function expandYoutubePlaylist(url: string, max = 500): Promise<string[]> {
  const playlistId = extractPlaylistId(url);
  if (!playlistId) return [];
  try {
    const res = await fetch(`https://www.youtube.com/playlist?list=${playlistId}`, {
      headers: {
        'User-Agent': 'MemoraStudyBot/1.0 (+https://memora.app)',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      redirect: 'follow',
    });
    if (!res.ok) return [];
    const html = await res.text();

    const ids: string[] = [];
    const seen = new Set<string>();
    collectVideoIds(html, ids, seen, max);

    // Follow continuation tokens for longer playlists.
    const apiKey = html.match(/"INNERTUBE_API_KEY":"([^"]+)"/)?.[1];
    const clientVersion =
      html.match(/"INNERTUBE_CONTEXT_CLIENT_VERSION":"([^"]+)"/)?.[1] ||
      html.match(/"clientVersion":"([\d.]+)"/)?.[1];
    let continuation = findContinuationToken(html);
    let guard = 0; // hard cap on continuation requests

    while (continuation && apiKey && clientVersion && ids.length < max && guard < 50) {
      guard += 1;
      const contRes = await fetch(
        `https://www.youtube.com/youtubei/v1/browse?key=${apiKey}&prettyPrint=false`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'MemoraStudyBot/1.0 (+https://memora.app)',
          },
          body: JSON.stringify({
            context: { client: { clientName: 'WEB', clientVersion } },
            continuation,
          }),
        },
      );
      if (!contRes.ok) break;
      const contText = await contRes.text();
      const before = ids.length;
      collectVideoIds(contText, ids, seen, max);
      const next = findContinuationToken(contText);
      // Stop if no progress was made to avoid infinite loops.
      if (ids.length === before || next === continuation) break;
      continuation = next;
    }

    return ids;
  } catch {
    return [];
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;
  const isProduction = process.env.NODE_ENV === 'production';

  app.disable('x-powered-by');
  app.set('trust proxy', Number(process.env.TRUST_PROXY_HOPS || 1));
  app.use(
    helmet({
      contentSecurityPolicy: buildContentSecurityPolicy(isProduction),
      crossOriginEmbedderPolicy: false,
    }),
  );
  app.use(cors());
  app.use(express.json({ limit: '50mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.get('/api/health/gemini', async (_req, res) => {
    if (!geminiApiKey) {
      res.status(503).json({
        ok: false,
        code: 'missing_key',
        message:
          'Set GEMINI_API_KEY in .env.local (also accepts GOOGLE_API_KEY / GOOGLE_GENERATIVE_AI_API_KEY).',
      });
      return;
    }

    try {
      const response = await ai.models.generateContent({
        model: geminiChatModel,
        contents: 'Reply with exactly: OK',
      });
      res.json({
        ok: true,
        model: geminiChatModel,
        embedModel: geminiEmbedModel,
        key: geminiKeyFingerprint(geminiApiKey),
        sample: (response.text ?? '').trim().slice(0, 80),
      });
    } catch (error) {
      const formatted = formatGeminiApiError(error);
      res.status(formatted.status).json({
        ok: false,
        code: formatted.code,
        message: formatted.message,
        model: geminiChatModel,
        key: geminiKeyFingerprint(geminiApiKey),
      });
    }
  });

  const generalApiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 300,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
  });
  const logLimiter = rateLimit({
    windowMs: 60 * 1000,
    limit: isProduction ? 10 : 500,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
  });
  const requireApiAuth = process.env.REQUIRE_API_AUTH === 'true';
  if (process.env.NODE_ENV !== 'production') {
    console.log(`[Memora] API auth required: ${requireApiAuth}`);
  }
  const firebaseProjectId =
    process.env.FIREBASE_PROJECT_ID ||
    (firebaseConfig as { projectId?: string }).projectId ||
    '';
  const firebaseAuth = createFirebaseAuthMiddleware(
    firebaseProjectId,
    requireApiAuth,
  );
  const protectedApiLimiter = rateLimit({
    windowMs: 60 * 1000,
    limit: isDev ? 500 : 60,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    keyGenerator: (req, res) =>
      (res.locals.user as { uid?: string } | undefined)?.uid ||
      ipKeyGenerator(req.ip || '127.0.0.1'),
    message: {
      error: 'Too many API requests. Wait a moment and try again.',
      code: 'local_rate_limit',
    },
  });

  app.post('/api/logs', logLimiter, (req, res) => {
    console.error('[Client Log]', JSON.stringify(req.body));
    res.status(202).json({ status: 'accepted' });
  });

  app.post('/api/logs/batch', logLimiter, (req, res) => {
    const errors = req.body?.errors ?? [];
    console.error('[Client Log Batch]', errors.length, 'entries');
    res.status(202).json({ status: 'accepted', received: errors.length });
  });

  // Client audit beacons — always public (registered before auth middleware)
  app.post('/api/audit', (req, res) => {
    if (req.body?.id && req.body?.action) {
      pushServerAudit(req.body);
    }
    res.status(204).end();
  });

  app.use(createTraceMiddleware());
  app.use('/api', generalApiLimiter);

  const enforceAppCheck = process.env.APP_CHECK_ENFORCE === 'true';
  app.use('/api', createAppCheckMiddleware(enforceAppCheck));

  app.use('/api', (req, res, next) => {
    if (isPublicApiRoute(req)) {
      next();
      return;
    }
    firebaseAuth(req, res, (authErr) => {
      if (authErr) {
        next(authErr);
        return;
      }
      protectedApiLimiter(req, res, (limitErr) => {
        if (limitErr) {
          next(limitErr);
          return;
        }
        createIdempotencyMiddleware()(req, res, next);
      });
    });
  });

  app.use((req, res, next) => {
    if (
      req.path.startsWith('/api/agent') ||
      req.path.startsWith('/api/embed') ||
      req.path.startsWith('/api/generate')
    ) {
      return aiRateLimit(req, res, next);
    }
    next();
  });

  // Intelligent Ingestion Routes
  app.post('/api/ingest/url', async (req, res) => {
    try {
      const { url } = req.body;
      if (!url) return res.status(400).json({ error: 'URL is required' });

      if (url.includes('youtube.com') || url.includes('youtu.be')) {
        const playlistVideos = await expandYoutubePlaylist(url, 10);
        if (playlistVideos.length > 0) {
          // Playlist: concatenate transcripts of the first videos.
          const parts = await Promise.all(
            playlistVideos.map(async (videoUrl) => {
              try {
                const t = await YoutubeTranscript.fetchTranscript(videoUrl);
                return t.map((x) => x.text).join(' ');
              } catch {
                return '';
              }
            }),
          );
          const text = parts.filter(Boolean).join('\n\n');
          if (text.length < 80) {
            return res.status(400).json({ error: 'Could not extract transcripts from this playlist.' });
          }
          return res.json({ text, type: 'youtube-playlist', videoCount: playlistVideos.length });
        }
        const transcript = await YoutubeTranscript.fetchTranscript(url);
        const text = transcript.map(t => t.text).join(' ');
        res.json({ text, type: 'youtube' });
      } else {
        const text = await extractArticleText(url);
        if (text.length < 80) {
          return res.status(400).json({ error: 'Could not extract enough text from this page.' });
        }
        res.json({ text, type: 'article', url });
      }
    } catch (error) {
      console.error('Ingest URL Error:', error);
      res.status(500).json({ error: 'Failed to extract content from URL' });
    }
  });

  app.post('/api/ocr', upload.single('image'), async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ error: 'Image file is required' });
      if (!req.file.mimetype.startsWith('image/')) {
        return res.status(400).json({ error: 'Only image files are supported for OCR' });
      }

      const base64Image = req.file.buffer.toString('base64');
      const response = await ai.models.generateContent({
        model: geminiChatModel,
        contents: [
          {
            role: 'user',
            parts: [
              {
                inlineData: {
                  mimeType: req.file.mimetype,
                  data: base64Image,
                },
              },
              {
                text: 'Extract all readable text from this image for study notes. Preserve headings and lists. Return plain text only.',
              },
            ],
          },
        ],
      });

      res.json({ text: response.text ?? '', filename: req.file.originalname });
    } catch (error) {
      console.error('OCR Error:', error);
      res.status(500).json({ error: 'Failed to extract text from image' });
    }
  });

  app.post('/api/analyze-media', upload.single('media'), async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ error: 'Media file is required' });
      const mime = req.file.mimetype;
      if (!mime.startsWith('image/') && !mime.startsWith('video/') && !mime.startsWith('audio/')) {
        return res.status(400).json({ error: 'Only image, video, or audio files are supported' });
      }

      const base64 = req.file.buffer.toString('base64');
      const response = await ai.models.generateContent({
        model: geminiChatModel,
        contents: [
          {
            role: 'user',
            parts: [
              { inlineData: { mimeType: mime, data: base64 } },
              {
                text: 'Analyze this study media. Return a concise summary for study notes (key concepts, definitions, examples). If there is readable text, include it.',
              },
            ],
          },
        ],
      });

      const summary = response.text ?? '';
      res.json({
        summary,
        text: mime.startsWith('image/') ? summary : undefined,
        filename: req.file.originalname,
      });
    } catch (error) {
      console.error('Analyze Media Error:', error);
      res.status(500).json({ error: 'Failed to analyze media' });
    }
  });

  app.post('/api/xapi/statements', async (req, res) => {
    try {
      await xapiStatementsHandler(req, res);
    } catch (error) {
      sendRouteError(res, error, 'xAPI Error', 'Failed to record xAPI statement');
    }
  });

  app.post('/api/ingest/file', upload.single('file'), async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ error: 'File is required' });
      
      const buffer = req.file.buffer;
      const mimeType = req.file.mimetype;

      let text = '';
      let extractionMethod = "plain-text";
      if (mimeType === 'application/pdf') {
        const data = await pdfParse(buffer);
        text = data.text;
        extractionMethod = "pdf-text";
        if (text.trim().length < 50) {
          text = await extractVisualDocumentText(buffer, mimeType);
          extractionMethod = "vision-ocr";
        }
      } else if (mimeType.startsWith('text/')) {
        text = buffer.toString('utf-8');
      } else if (mimeType.startsWith("image/")) {
        text = await extractVisualDocumentText(buffer, mimeType);
        extractionMethod = "vision-ocr";
      } else if (
        [
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          "application/vnd.openxmlformats-officedocument.presentationml.presentation",
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "application/vnd.oasis.opendocument.text",
          "application/vnd.oasis.opendocument.presentation",
          "application/rtf",
        ].includes(mimeType)
      ) {
        const document = await OfficeParser.parseOffice(buffer);
        text = (await document.to("text")).value;
        extractionMethod = "office-parser";
      } else {
        return res.status(400).json({
          error:
            "Unsupported file type. Upload text, PDF, image, Word, PowerPoint, spreadsheet, OpenDocument, or RTF material.",
        });
      }

      if (!text.trim()) {
        throw new HttpError(422, "No readable text was found in this file");
      }
      res.json({
        text,
        filename: req.file.originalname,
        extractionMethod,
      });
    } catch (error) {
      console.error('Ingest File Error:', error);
      res.status(500).json({ error: 'Failed to extract content from file' });
    }
  });

  // Vector Embeddings Route
  app.post('/api/embed', async (req, res) => {
    try {
      const { text } = req.body;
      if (!text) return res.status(400).json({ error: 'Text is required' });

      const response = await ai.models.embedContent({
        model: geminiEmbedModel,
        contents: text
      });
      
      res.json({ embedding: response.embeddings[0].values });
    } catch (error) {
      sendGeminiError(res, error, 'Embed Error');
    }
  });

  // AI Agent Route
  app.post('/api/agent/chat', async (req, res) => {
    try {
      const { messages, systemInstruction, model } = req.body;
      const mode = normalizeAgentMode(req.body?.mode);
      const userTexts = extractAgentUserTexts(messages);
      for (const t of userTexts.slice(-3)) {
        const mod = await moderatePlatformContent(t, 'chat');
        if (!mod.allowed) throw new HttpError(400, mod.reason);
      }
      const instruction = appendModeSafety(String(systemInstruction ?? ''), mode);
      const tools = modeAllowsGoogleSearch(mode) ? [{ googleSearch: {} }] : [];
      const response = await generateChatWithFallback(ai, {
        model: model || geminiChatModel,
        contents: messages,
        config: {
          systemInstruction: instruction,
          ...(tools.length
            ? {
                tools,
                toolConfig: { includeServerSideToolInvocations: true },
              }
            : {}),
        }
      });
      
      let text = response.text || '';
      if (mode === 'exam-coach' && looksLikeExamAnswerDump(text)) {
        text =
          'Exam Coach policy: I will not provide a complete submit-ready answer. Attempt the question first, then I can score your reasoning and share a rubric.';
      }
      let urls: any[] = [];
      const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
      if (chunks) {
        urls = chunks.map((c: any) => c.web?.uri).filter(Boolean);
      }
      
      res.json({ text, urls, mode, traceId: res.locals.traceId });
    } catch (error) {
      if (error instanceof HttpError) {
        sendRouteError(res, error, 'Agent Moderation', error.message);
        return;
      }
      sendGeminiError(res, error, 'Gemini API Error');
    }
  });

  // AI Agent streaming (SSE)
  app.post('/api/agent/chat/stream', async (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    try {
      const { messages, systemInstruction, model } = req.body;
      const mode = normalizeAgentMode(req.body?.mode);
      const userTexts = extractAgentUserTexts(messages);
      for (const t of userTexts.slice(-3)) {
        const mod = await moderatePlatformContent(t, 'chat');
        if (!mod.allowed) {
          res.write(`data: ${JSON.stringify({ error: mod.reason, code: 'moderation_blocked' })}\n\n`);
          res.write('data: [DONE]\n\n');
          res.end();
          return;
        }
      }
      const instruction = appendModeSafety(String(systemInstruction ?? ''), mode);
      const tools = modeAllowsGoogleSearch(mode) ? [{ googleSearch: {} }] : [];
      const stream = await streamChatWithFallback(ai, {
        model: model || geminiChatModel,
        contents: messages,
        config: {
          systemInstruction: instruction,
          ...(tools.length
            ? {
                tools,
                toolConfig: { includeServerSideToolInvocations: true },
              }
            : {}),
        },
      });

      // Grounding metadata usually arrives in later chunks; keep the richest set.
      let groundingUrls: string[] = [];
      const seenUrls = new Set<string>();

      for await (const chunk of stream) {
        const text = chunk.text ?? '';
        if (text) {
          res.write(`data: ${JSON.stringify({ text })}\n\n`);
        }

        const gChunks = chunk.candidates?.[0]?.groundingMetadata?.groundingChunks;
        if (gChunks) {
          for (const c of gChunks as any[]) {
            const uri = c.web?.uri;
            const title = c.web?.title;
            if (uri && !seenUrls.has(uri)) {
              seenUrls.add(uri);
              groundingUrls.push(uri);
              // Stream each citation as it is discovered so the UI can render
              // grounding chips incrementally.
              res.write(`data: ${JSON.stringify({ citation: { uri, title } })}\n\n`);
            }
          }
        }
      }

      res.write(`data: ${JSON.stringify({ done: true, urls: groundingUrls })}\n\n`);
      res.end();
    } catch (error) {
      const formatted = formatGeminiApiError(error);
      console.error('Gemini Stream Error:', error);
      res.write(
        `data: ${JSON.stringify({ error: formatted.message, code: formatted.code })}\n\n`,
      );
      res.end();
    }
  });

  // YouTube batch lecture ingest
  app.post('/api/ingest/youtube/batch', async (req, res) => {
    try {
      const { urls, max: maxParam } = req.body;
      if (!Array.isArray(urls) || urls.length === 0) {
        return res.status(400).json({ error: 'urls array is required' });
      }

      // Auto-expand any playlist URLs into their constituent video URLs.
      // Playlists are fully paginated (up to MAX_BATCH_VIDEOS) then the total
      // batch is truncated rather than rejected, so large playlists succeed.
      // Callers may pass `max` (1-500) to control how many videos to fetch.
      const MAX_BATCH_VIDEOS = Math.min(500, Math.max(1, Number(maxParam) || 200));
      const expanded: string[] = [];
      const seenUrls = new Set<string>();
      for (const rawUrl of urls as string[]) {
        if (expanded.length >= MAX_BATCH_VIDEOS) break;
        const playlistVideos = await expandYoutubePlaylist(rawUrl, MAX_BATCH_VIDEOS);
        const toAdd = playlistVideos.length > 0 ? playlistVideos : [rawUrl];
        for (const u of toAdd) {
          if (expanded.length >= MAX_BATCH_VIDEOS) break;
          if (!seenUrls.has(u)) {
            seenUrls.add(u);
            expanded.push(u);
          }
        }
      }

      const truncated = expanded.length >= MAX_BATCH_VIDEOS;

      const results = await Promise.all(
        expanded.map(async (url: string) => {
          try {
            if (!url.includes('youtube.com') && !url.includes('youtu.be')) {
              return { url, error: 'Not a YouTube URL' };
            }
            const transcript = await YoutubeTranscript.fetchTranscript(url);
            const text = transcript.map((t) => t.text).join(' ');
            const videoIdMatch = url.match(/(?:v=|youtu\.be\/|shorts\/)([\w-]{11})/);
            const videoId = videoIdMatch?.[1];
            return {
              url,
              videoId,
              title: videoId ? `YouTube ${videoId}` : 'YouTube Lecture',
              text,
            };
          } catch (err) {
            return {
              url,
              error: err instanceof Error ? err.message : 'Transcript fetch failed',
            };
          }
        }),
      );

      res.json({ results, expandedCount: expanded.length, truncated });
    } catch (error) {
      console.error('YouTube Batch Error:', error);
      res.status(500).json({ error: 'Batch ingest failed' });
    }
  });

  // Real Google Forms creation with graceful fallback + room/class audit link.
  app.post('/api/google/forms', async (req, res) => {
    const { title, accessToken } = req.body ?? {};
    const token = accessToken || process.env.GOOGLE_ACCESS_TOKEN;
    const formTitle = title || `Study Quiz - ${new Date().toLocaleDateString()}`;

    if (!token) {
      const result = {
        fallback: true,
        editUrl: 'https://docs.google.com/forms/create',
        responderUrl: null as string | null,
        formId: null as string | null,
        title: formTitle,
      };
      await auditFormFromRequest(req, res, result);
      return res.json(result);
    }

    try {
      const createRes = await fetch('https://forms.googleapis.com/v1/forms', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ info: { title: formTitle, documentTitle: formTitle } }),
      });
      if (!createRes.ok) throw new Error(`Forms API ${createRes.status}`);
      const form = (await createRes.json()) as {
        formId?: string;
        responderUri?: string;
      };
      const formId = form.formId ?? null;
      const result = {
        fallback: false,
        formId,
        editUrl: formId ? `https://docs.google.com/forms/d/${formId}/edit` : null,
        responderUrl: form.responderUri ?? null,
        title: formTitle,
      };
      await auditFormFromRequest(req, res, result);
      res.json(result);
    } catch (error) {
      console.error('Google Forms Error:', error);
      const result = {
        fallback: true,
        editUrl: 'https://docs.google.com/forms/create',
        responderUrl: null as string | null,
        formId: null as string | null,
        title: formTitle,
        error: error instanceof Error ? error.message : 'Forms API failed',
      };
      await auditFormFromRequest(req, res, result);
      res.json(result);
    }
  });

  // Real Google Meet space creation with graceful fallback + room/class audit link.
  app.post('/api/google/meet', async (req, res) => {
    const token = (req.body && req.body.accessToken) || process.env.GOOGLE_ACCESS_TOKEN;

    if (!token) {
      const result = { fallback: true, meetUrl: 'https://meet.google.com/new' };
      await auditMeetFromRequest(req, res, result);
      return res.json(result);
    }

    try {
      const spaceRes = await fetch('https://meet.googleapis.com/v2/spaces', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });
      if (!spaceRes.ok) throw new Error(`Meet API ${spaceRes.status}`);
      const space = (await spaceRes.json()) as { meetingUri?: string };
      const result = {
        fallback: false,
        meetUrl: space.meetingUri ?? 'https://meet.google.com/new',
      };
      await auditMeetFromRequest(req, res, result);
      res.json(result);
    } catch (error) {
      console.error('Google Meet Error:', error);
      const result = {
        fallback: true,
        meetUrl: 'https://meet.google.com/new',
        error: error instanceof Error ? error.message : 'Meet API failed',
      };
      await auditMeetFromRequest(req, res, result);
      res.json(result);
    }
  });

  // Image Generation Route
  app.post('/api/generate-image', async (req, res) => {
    try {
      const { prompt } = req.body;
      const response = await ai.models.generateContent({
        model: 'gemini-3.1-flash-image',
        contents: {
          parts: [
            { text: prompt },
          ],
        },
        config: {
          imageConfig: {
            aspectRatio: "16:9",
            imageSize: "1K"
          },
        },
      });

      let base64Image = '';
      for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) {
          base64Image = part.inlineData.data;
          break;
        }
      }
      
      if (base64Image) {
        res.json({ image: `data:image/png;base64,${base64Image}` });
      } else {
        res.status(500).json({ error: 'Failed to generate image' });
      }
    } catch (error) {
      console.error('Image Generation Error:', error);
      res.status(500).json({ error: 'Failed to generate image' });
    }
  });

  // Simple local "RAG" keyword scoring
  const getRelevantChunks = (text: string, query: string, topK: number = 3) => {
    // Split into paragraphs/chunks
    const chunks = text.split(/\n\s*\n/).filter(c => c.trim().length > 50);
    if (chunks.length <= topK) return chunks.map((c, i) => `[Chunk ${i+1}]: ${c}`);
    
    const queryWords = query.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/).filter(w => w.length > 2);
    
    // Score each chunk
    const scored = chunks.map((chunk, index) => {
      const chunkLower = chunk.toLowerCase();
      let score = 0;
      queryWords.forEach(word => {
        const regex = new RegExp(`\\b${word}\\b`, 'g');
        const matches = chunkLower.match(regex);
        if (matches) score += matches.length;
      });
      return { index, chunk, score };
    });
    
    // Sort and get top K
    return scored.sort((a, b) => b.score - a.score)
                 .slice(0, topK)
                 .map(s => `[Chunk ${s.index + 1}]: ${s.chunk}`);
  };

  // RAG / Ask Document Route
  app.post('/api/agent/rag', async (req, res) => {
    try {
      const { context, query } = req.body;
      const response = await ai.models.generateContent({
        model: geminiChatModel,
        contents: `You are an AI assistant answering a student's question based strictly on their notes below.
Do not use outside knowledge. If the answer is not in the notes, say so.
Include citations to the notes in the format [Citation: Chunk X] to point out where you found the information.

Notes / Context:
${context}

Question: ${query}`
      });
      res.json({ text: response.text || '' });
    } catch (error) {
      console.error('Gemini RAG Error:', error);
      res.status(500).json({ error: 'Failed to answer from document' });
    }
  });

  // Flashcards Generation Route
  app.post('/api/generate-flashcards', async (req, res) => {
    try {
      const { text } = req.body;
      const response = await ai.models.generateContent({
        model: geminiChatModel,
        contents: `Generate 5 flashcards from the following study notes:\n\n${text}`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: "ARRAY",
            items: {
              type: "OBJECT",
              properties: {
                question: { type: "STRING" },
                answer: { type: "STRING" }
              },
              required: ["question", "answer"]
            }
          }
        }
      });
      
      res.json({ flashcards: JSON.parse(response.text || '[]') });
    } catch (error) {
      console.error('Flashcard Generation Error:', error);
      res.status(500).json({ error: 'Failed to generate flashcards' });
    }
  });

  // Summarize Audio Route
  app.post('/api/summarize-audio', upload.single('audio'), async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ error: 'Audio file is required' });

      const base64Audio = req.file.buffer.toString('base64');
      const mimeType = req.file.mimetype;

      const response = await ai.models.generateContent({
        model: geminiChatModel,
        contents: [
          {
            role: 'user',
            parts: [
              {
                inlineData: {
                  mimeType: mimeType,
                  data: base64Audio
                }
              },
              { text: 'Please transcribe and summarize this audio note concisely.' }
            ]
          }
        ]
      });

      res.json({ summary: response.text || '' });
    } catch (error) {
      console.error('Audio Summarize Error:', error);
      res.status(500).json({ error: 'Failed to summarize audio' });
    }
  });

  // Summarize Notes Route
  app.post('/api/summarize-notes', async (req, res) => {
    try {
      const { text } = req.body;
      const response = await ai.models.generateContent({
        model: geminiChatModel,
        contents: `Summarize the following study notes into concise bullet-point highlights:\n\n${text}`
      });
      
      res.json({ summary: response.text || '' });
    } catch (error) {
      console.error('Summarize Error:', error);
      res.status(500).json({ error: 'Failed to summarize notes' });
    }
  });

  // Feynman Technique Check Route
  app.post('/api/feynman-check', async (req, res) => {
    try {
      const { source, explanation } = req.body;
      const response = await ai.models.generateContent({
        model: geminiChatModel,
        contents: `You are an expert tutor using the Feynman technique. 
        Original source text: ${source}
        
        Student's explanation in their own words: ${explanation}
        
        Compare the student's explanation to the original text. Give them a brief encouraging praise, and identify any critical knowledge gaps (things they missed or misunderstood).`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: "OBJECT",
            properties: {
              praise: { type: "STRING" },
              gaps: { type: "ARRAY", items: { type: "STRING" } }
            },
            required: ["praise", "gaps"]
          }
        }
      });
      
      res.json(JSON.parse(response.text || '{"praise":"Good try!","gaps":[]}'));
    } catch (error) {
      console.error('Feynman Check Error:', error);
      res.status(500).json({ error: 'Failed to check explanation' });
    }
  });

  // Course Blueprint Route
  app.post('/api/generate-blueprint', async (req, res) => {
    try {
      const { text } = req.body;
      const response = await ai.models.generateContent({
        model: geminiChatModel,
        contents: `Build a notes-grounded course blueprint from the source below.
1. Infer whether the overall course is theory, practice, or mixed from the tasks implied by the source—not from learner stereotypes.
2. Order modules by explicit prerequisite relationships.
3. Give each module measurable objectives across appropriate Bloom levels.
4. Distinguish theory activities (explanation, comparison, retrieval) from practice activities (worked example, completion problem, sandbox, transfer task).
5. Keep every claim faithful to the source. Do not add external facts in this endpoint.
6. Break work into manageable, cognitively coherent sessions rather than arbitrary equal chunks.
Return the required JSON.\n\nSOURCE:\n${text}`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: "OBJECT",
            properties: {
              courseMode: { type: "STRING" },
              designRationale: { type: "STRING" },
              modules: {
                type: "ARRAY",
                items: {
                  type: "OBJECT",
                  properties: {
                    title: { type: "STRING" },
                    durationMinutes: { type: "INTEGER" },
                    description: { type: "STRING" },
                    mode: { type: "STRING" },
                    prerequisites: {
                      type: "ARRAY",
                      items: { type: "STRING" }
                    },
                    objectives: {
                      type: "ARRAY",
                      items: {
                        type: "OBJECT",
                        properties: {
                          bloomLevel: { type: "STRING" },
                          objective: { type: "STRING" }
                        },
                        required: ["bloomLevel", "objective"]
                      }
                    },
                    activities: {
                      type: "ARRAY",
                      items: {
                        type: "OBJECT",
                        properties: {
                          type: { type: "STRING" },
                          prompt: { type: "STRING" },
                          successCriteria: { type: "STRING" }
                        },
                        required: ["type", "prompt", "successCriteria"]
                      }
                    }
                  },
                  required: [
                    "title",
                    "durationMinutes",
                    "description",
                    "mode",
                    "prerequisites",
                    "objectives",
                    "activities"
                  ]
                }
              },
              prerequisiteEdges: {
                type: "ARRAY",
                items: {
                  type: "OBJECT",
                  properties: {
                    prerequisite: { type: "STRING" },
                    dependent: { type: "STRING" },
                    rationale: { type: "STRING" }
                  },
                  required: ["prerequisite", "dependent", "rationale"]
                }
              },
              glossary: {
                type: "ARRAY",
                items: {
                  type: "OBJECT",
                  properties: {
                    term: { type: "STRING" },
                    definition: { type: "STRING" }
                  },
                  required: ["term", "definition"]
                }
              },
              ontology: {
                type: "OBJECT",
                properties: {
                  nodes: {
                    type: "ARRAY",
                    items: {
                      type: "OBJECT",
                      properties: {
                        id: { type: "STRING" },
                        label: { type: "STRING" },
                        group: { type: "INTEGER" },
                        radius: { type: "INTEGER" }
                      },
                      required: ["id", "label", "group", "radius"]
                    }
                  },
                  links: {
                    type: "ARRAY",
                    items: {
                      type: "OBJECT",
                      properties: {
                        source: { type: "STRING" },
                        target: { type: "STRING" },
                        value: { type: "INTEGER" }
                      },
                      required: ["source", "target", "value"]
                    }
                  }
                },
                required: ["nodes", "links"]
              }
            },
            required: [
              "courseMode",
              "designRationale",
              "modules",
              "prerequisiteEdges",
              "glossary",
              "ontology"
            ]
          }
        }
      });
      
      res.json(JSON.parse(response.text || '{"courseMode":"mixed","designRationale":"","modules":[],"prerequisiteEdges":[],"glossary":[],"ontology":{"nodes":[],"links":[]}}'));
    } catch (error) {
      console.error('Course Blueprint Error:', error);
      res.status(500).json({ error: 'Failed to generate blueprint' });
    }
  });

  app.post('/api/enrich-course', async (req, res) => {
    try {
      const text = sanitizeAiText(req.body?.text, "Text", 200_000);
      const focus =
        typeof req.body?.focus === "string"
          ? sanitizeAiText(req.body.focus, "Focus", 2_000)
          : "clarify important concepts and connect them to current evidence";
      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: `Enrich the user's study notes without rewriting or contradicting them.
Clearly separate SOURCE-GROUNDED statements from EXTERNAL ENRICHMENT.
For every external factual claim, rely only on sources returned by Google Search grounding.
State uncertainty and disagreements. Never invent citations.
Requested focus: ${focus}

USER NOTES:
${text}`,
        config: {
          tools: [{ googleSearch: {} }],
          toolConfig: { includeServerSideToolInvocations: true },
        },
      });
      const groundingChunks =
        response.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];
      const urls = groundingChunks
        .map((chunk) => chunk.web?.uri)
        .filter((url): url is string => typeof url === "string");
      res.json({
        enrichment: response.text || "",
        urls: [...new Set(urls)],
        reviewRequired: true,
      });
    } catch (error) {
      sendRouteError(
        res,
        error,
        "Course Enrichment Error",
        "Failed to generate grounded enrichment",
      );
    }
  });

  app.post('/api/extract-ontology', async (req, res) => {
    try {
      const { text } = req.body;
      const response = await ai.models.generateContent({
        model: geminiChatModel,
        contents: `Extract a knowledge graph ontology (core concepts and their relationships) from the following text:\n\n${text}\n\nGroup related concepts numerically (e.g. 1, 2, 3) and assign radii based on importance (10 to 30). Return JSON.`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: "OBJECT",
            properties: {
              nodes: {
                type: "ARRAY",
                items: {
                  type: "OBJECT",
                  properties: {
                    id: { type: "STRING" },
                    label: { type: "STRING" },
                    group: { type: "INTEGER" },
                    radius: { type: "INTEGER" }
                  },
                  required: ["id", "label", "group", "radius"]
                }
              },
              links: {
                type: "ARRAY",
                items: {
                  type: "OBJECT",
                  properties: {
                    source: { type: "STRING" },
                    target: { type: "STRING" },
                    value: { type: "INTEGER" }
                  },
                  required: ["source", "target", "value"]
                }
              }
            },
            required: ["nodes", "links"]
          }
        }
      });
      
      res.json(JSON.parse(response.text || '{"nodes":[],"links":[]}'));
    } catch (error) {
      console.error('Ontology Extraction Error:', error);
      res.status(500).json({ error: 'Failed to extract ontology' });
    }
  });

  let cachedStudyTip: { tip: string, urls: any[], timestamp: number } | null = null;
  const CACHE_TTL = 1000 * 60 * 60 * 24; // 24 hours

  // Study Tips Route
  app.get('/api/study-tips', async (req, res) => {
    if (cachedStudyTip && (Date.now() - cachedStudyTip.timestamp < CACHE_TTL)) {
      return res.json({ tip: cachedStudyTip.tip, urls: cachedStudyTip.urls });
    }

    try {
      const response = await ai.models.generateContent({
        model: geminiChatModel,
        contents: "Find a highly effective, scientifically-backed daily productivity or study tip from a trusted academic source.",
        config: {
          tools: [{ googleSearch: {} }],
          toolConfig: { includeServerSideToolInvocations: true }
        }
      });
      
      let text = response.text || '';
      let urls: any[] = [];
      const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
      if (chunks) {
        urls = chunks.map((c: any) => c.web?.uri).filter(Boolean);
      }
      
      cachedStudyTip = { tip: text, urls, timestamp: Date.now() };
      res.json({ tip: text, urls });
    } catch (error: any) {
      // Fallback study tip when quota is exceeded or API fails
      res.json({
        tip: "Spaced repetition is a highly effective learning technique that involves reviewing information at gradually increasing intervals. Research shows it significantly improves long-term retention compared to cramming.",
        urls: []
      });
    }
  });


  // Web Clipper Endpoint
  app.post('/api/clipper', async (req, res) => {
    try {
      const { url } = req.body;
      if (!url) return res.status(400).json({ error: 'URL is required' });

      const parsed = await assertPublicHttpUrl(url);
      const response = await fetch(parsed.href);
      const html = await response.text();
      const $ = cheerio.load(html);
      
      $('script, style, nav, footer, header, aside').remove();
      const title = $('title').text() || 'Clipped Article';
      let content = $('body').text().replace(/\s+/g, ' ').trim();
      
      res.json({ title, content: content.substring(0, 5000) });
    } catch (error) {
      console.error('Clipper Error:', error);
      res.status(500).json({ error: 'Failed to clip URL' });
    }
  });

  // Image Occlusion Route — Gemini vision with manual-draw fallback on client
  app.post('/api/occlusion', upload.single('image'), async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ error: 'Image file is required' });
      if (!req.file.mimetype.startsWith('image/')) {
        return res.status(400).json({ error: 'Only image files are supported' });
      }

      const base64Image = req.file.buffer.toString('base64');
      const response = await ai.models.generateContent({
        model: geminiChatModel,
        contents: [
          {
            role: 'user',
            parts: [
              {
                inlineData: {
                  mimeType: req.file.mimetype,
                  data: base64Image,
                },
              },
              {
                text: `Identify study-relevant labels on this diagram or image for occlusion flashcards.
Return ONLY valid JSON: {"labels":[{"text":"string","box":[y1,x1,y2,x2],"confidence":0.0}]}
Use pixel coordinates relative to the image. Include 1-12 labels. confidence is 0-1.`,
              },
            ],
          },
        ],
      });

      const raw = response.text?.trim() ?? '';
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return res.status(422).json({
          error: 'Could not parse occlusion labels from the model response',
          labels: [],
        });
      }

      const parsed = JSON.parse(jsonMatch[0]) as {
        labels?: Array<{
          text?: string;
          box?: number[];
          confidence?: number;
        }>;
      };

      const labels = (parsed.labels ?? [])
        .filter(
          (label) =>
            typeof label.text === 'string' &&
            label.text.trim().length > 0 &&
            Array.isArray(label.box) &&
            label.box.length === 4 &&
            label.box.every((value) => typeof value === 'number'),
        )
        .map((label) => ({
          text: label.text!.trim().slice(0, 120),
          box: label.box as [number, number, number, number],
          confidence:
            typeof label.confidence === 'number'
              ? Math.min(1, Math.max(0, label.confidence))
              : 0.7,
        }))
        .filter((label) => label.confidence >= 0.35);

      res.json({ labels, source: 'gemini-vision' });
    } catch (error) {
      console.error('Image Occlusion Error:', error);
      sendRouteError(
        res,
        error,
        'Image Occlusion Error',
        'Failed to process image occlusion',
      );
    }
  });

  // Voice tutor — Gemini STT + optional client TTS fallback
  app.post('/api/transcribe', upload.single('audio'), async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ error: 'Audio file is required' });

      const response = await ai.models.generateContent({
        model: geminiChatModel,
        contents: [
          {
            role: 'user',
            parts: [
              {
                inlineData: {
                  mimeType: req.file.mimetype || 'audio/webm',
                  data: req.file.buffer.toString('base64'),
                },
              },
              {
                text: 'Transcribe the spoken words in this audio faithfully. Return only the transcript text with no commentary.',
              },
            ],
          },
        ],
      });

      const text = (response.text ?? '').trim();
      if (text) {
        const mod = await moderatePlatformContent(text, 'chat');
        if (!mod.allowed) {
          return res.status(400).json({
            error: mod.reason,
            code: 'moderation_blocked',
            text: '',
          });
        }
      }
      res.json({ text, retention: 'ephemeral_client', traceId: res.locals.traceId });
    } catch (error) {
      sendRouteError(res, error, 'Transcribe Error', 'Failed to transcribe audio');
    }
  });

  app.post('/api/tts', async (req, res) => {
    try {
      const text = String(req.body?.text ?? '').trim();
      if (!text) return res.status(400).json({ error: 'Text is required' });
      const mod = await moderatePlatformContent(text, 'chat');
      if (!mod.allowed) {
        return res.status(400).json({ error: mod.reason, code: 'moderation_blocked' });
      }

      const voice = String(req.body?.voice ?? 'Kore');
      const geminiVoiceMap: Record<string, string> = {
        alloy: 'Kore',
        nova: 'Aoede',
        shimmer: 'Leda',
        echo: 'Charon',
        fable: 'Fenrir',
        onyx: 'Puck',
      };
      const voiceName = geminiVoiceMap[voice.toLowerCase()] ?? voice;

      try {
        const response = await ai.models.generateContent({
          model: process.env.GEMINI_TTS_MODEL?.trim() || 'gemini-2.5-flash-preview-tts',
          contents: [{ role: 'user', parts: [{ text: text.slice(0, 4000) }] }],
          config: {
            responseModalities: ['AUDIO'],
            speechConfig: {
              voiceConfig: { prebuiltVoiceConfig: { voiceName } },
            },
          },
        });

        const parts = response.candidates?.[0]?.content?.parts ?? [];
        const audioPart = parts.find((part) => part.inlineData?.mimeType?.startsWith('audio/'));
        if (audioPart?.inlineData?.data) {
          const mime = audioPart.inlineData.mimeType || 'audio/mp3';
          res.json({ audio: `data:${mime};base64,${audioPart.inlineData.data}` });
          return;
        }
      } catch (ttsError) {
        console.warn('[Memora] Gemini TTS unavailable, using client fallback:', ttsError);
      }

      res.json({ clientFallback: true, text: text.slice(0, 4000) });
    } catch (error) {
      sendRouteError(res, error, 'TTS Error', 'Failed to synthesize speech');
    }
  });

  // Teacher / class dashboard (Firestore via Admin SDK)
  app.post('/api/classes', async (req, res) => {
    try {
      await createClassHandler(req, res);
    } catch (error) {
      sendRouteError(res, error, 'Create Class Error', 'Failed to create class');
    }
  });

  app.get('/api/classes', async (req, res) => {
    try {
      await listClassesHandler(req, res);
    } catch (error) {
      sendRouteError(res, error, 'List Classes Error', 'Failed to list classes');
    }
  });

  app.post('/api/classes/join', async (req, res) => {
    try {
      await joinClassHandler(req, res);
    } catch (error) {
      sendRouteError(res, error, 'Join Class Error', 'Failed to join class');
    }
  });

  app.get('/api/classes/:classId', async (req, res) => {
    try {
      await classDetailHandler(req, res);
    } catch (error) {
      sendRouteError(res, error, 'Class Detail Error', 'Failed to load class');
    }
  });

  app.post('/api/progress', async (req, res) => {
    try {
      await reportProgressHandler(req, res);
    } catch (error) {
      sendRouteError(res, error, 'Progress Error', 'Failed to report progress');
    }
  });

  // Institution spine — Classroom roster consent sync + assignment maps
  app.post('/api/classes/:classId/classroom/sync', async (req, res) => {
    try {
      await syncClassroomRosterHandler(req, res);
    } catch (error) {
      sendRouteError(res, error, 'Classroom Sync Error', 'Failed to sync Classroom roster');
    }
  });
  app.post('/api/classes/:classId/assignments/map', async (req, res) => {
    try {
      await mapAssignmentHandler(req, res);
    } catch (error) {
      sendRouteError(res, error, 'Assignment Map Error', 'Failed to map assignment');
    }
  });
  app.get('/api/classes/:classId/assignments', async (req, res) => {
    try {
      await listAssignmentMapsHandler(req, res);
    } catch (error) {
      sendRouteError(res, error, 'Assignment List Error', 'Failed to list assignment maps');
    }
  });

  // Study Match — server-side focus-buddy matchmaking (no public queue)
  app.post('/api/match/enqueue', async (req, res) => {
    try {
      await enqueueMatchHandler(req, res);
    } catch (error) {
      sendRouteError(res, error, 'Match Enqueue Error', 'Failed to join match queue');
    }
  });
  app.delete('/api/match/queue', async (req, res) => {
    try {
      await leaveQueueHandler(req, res);
    } catch (error) {
      sendRouteError(res, error, 'Match Queue Error', 'Failed to leave match queue');
    }
  });
  app.get('/api/match/status', async (req, res) => {
    try {
      await matchStatusHandler(req, res);
    } catch (error) {
      sendRouteError(res, error, 'Match Status Error', 'Failed to load match status');
    }
  });
  app.get('/api/match/session/:sessionId', async (req, res) => {
    try {
      await getSessionHandler(req, res);
    } catch (error) {
      sendRouteError(res, error, 'Match Session Error', 'Failed to load session');
    }
  });
  app.post('/api/match/session/:sessionId/leave', async (req, res) => {
    try {
      await leaveSessionHandler(req, res);
    } catch (error) {
      sendRouteError(res, error, 'Match Leave Error', 'Failed to leave session');
    }
  });
  app.post('/api/match/session/:sessionId/report', async (req, res) => {
    try {
      await reportSessionHandler(req, res);
    } catch (error) {
      sendRouteError(res, error, 'Match Report Error', 'Failed to submit report');
    }
  });
  app.post('/api/match/session/:sessionId/meet-consent', async (req, res) => {
    try {
      await meetConsentHandler(req, res);
    } catch (error) {
      sendRouteError(res, error, 'Meet Consent Error', 'Failed to update Meet consent');
    }
  });
  app.post('/api/match/session/:sessionId/meet', async (req, res) => {
    try {
      await createMeetHandler(req, res);
    } catch (error) {
      sendRouteError(res, error, 'Match Meet Error', 'Failed to create Meet link');
    }
  });
  app.patch('/api/match/session/:sessionId/notes', async (req, res) => {
    try {
      await saveNotesHandler(req, res);
    } catch (error) {
      sendRouteError(res, error, 'Match Notes Error', 'Failed to save notes');
    }
  });
  app.post('/api/match/session/:sessionId/message', async (req, res) => {
    try {
      await postMessageHandler(req, res);
    } catch (error) {
      sendRouteError(res, error, 'Match Chat Error', 'Failed to send message');
    }
  });
  app.post('/api/match/session/:sessionId/heartbeat', async (req, res) => {
    try {
      await heartbeatHandler(req, res);
    } catch (error) {
      sendRouteError(res, error, 'Match Heartbeat Error', 'Failed to update presence');
    }
  });
  app.post('/api/match/session/:sessionId/pomodoro', async (req, res) => {
    try {
      await pomodoroHandler(req, res);
    } catch (error) {
      sendRouteError(res, error, 'Match Pomodoro Error', 'Failed to update Pomodoro phase');
    }
  });
  app.post('/api/match/session/:sessionId/quiet-focus', async (req, res) => {
    try {
      await quietFocusHandler(req, res);
    } catch (error) {
      sendRouteError(res, error, 'Quiet Focus Error', 'Failed to update quiet focus');
    }
  });
  app.get('/api/match/metrics', async (req, res) => {
    try {
      await matchMetricsHandler(req, res);
    } catch (error) {
      sendRouteError(res, error, 'Match Metrics Error', 'Failed to load match metrics');
    }
  });

  // Platform spine — shared content moderation preflight
  app.post('/api/moderate', async (req, res) => {
    try {
      await moderateContentHandler(req, res);
    } catch (error) {
      sendRouteError(res, error, 'Moderation Error', 'Failed to moderate content');
    }
  });

  // Learning spine — server-authoritative pedagogy events
  app.post('/api/learning/events', async (req, res) => {
    try {
      await postLearningEventHandler(req, res);
    } catch (error) {
      sendRouteError(res, error, 'Learning Event Error', 'Failed to record learning event');
    }
  });
  app.get('/api/learning/summary', async (req, res) => {
    try {
      await getLearningSummaryHandler(req, res);
    } catch (error) {
      sendRouteError(res, error, 'Learning Summary Error', 'Failed to load learning summary');
    }
  });

  // Privacy spine — export / delete request (no peer PII)
  app.get('/api/privacy/export', async (req, res) => {
    try {
      await privacyExportHandler(req, res);
    } catch (error) {
      sendRouteError(res, error, 'Privacy Export Error', 'Failed to export data');
    }
  });
  app.post('/api/privacy/delete-request', async (req, res) => {
    try {
      await privacyDeleteRequestHandler(req, res);
    } catch (error) {
      sendRouteError(res, error, 'Privacy Delete Error', 'Failed to queue deletion');
    }
  });

  // Evidence spine — research export, eval harness, principles, xAPI purge
  app.get('/api/research/export', async (req, res) => {
    try {
      await researchExportHandler(req, res);
    } catch (error) {
      sendRouteError(res, error, 'Research Export Error', 'Failed to export research data');
    }
  });
  app.get('/api/evidence/principles', async (req, res) => {
    try {
      await evidencePrinciplesHandler(req, res);
    } catch (error) {
      sendRouteError(res, error, 'Evidence Principles Error', 'Failed to load principles');
    }
  });
  app.post('/api/evidence/eval', async (req, res) => {
    try {
      await evidenceEvalHandler(req, res);
    } catch (error) {
      sendRouteError(res, error, 'Evidence Eval Error', 'Failed to run evaluation harness');
    }
  });
  app.post('/api/admin/xapi/purge-expired', async (req, res) => {
    try {
      await purgeExpiredXapiHandler(req, res);
    } catch (error) {
      sendRouteError(res, error, 'xAPI Purge Error', 'Failed to purge expired statements');
    }
  });

  // Claims + break-glass (two-person rule when BREAK_GLASS_REQUIRED=true)
  app.post('/api/admin/claims', async (req, res) => {
    try {
      await assignClaimHandler(req, res);
    } catch (error) {
      sendRouteError(res, error, 'Claims Error', 'Failed to assign claim');
    }
  });
  app.get('/api/admin/break-glass', async (req, res) => {
    try {
      await listBreakGlassHandler(req, res);
    } catch (error) {
      sendRouteError(res, error, 'Break-glass List Error', 'Failed to list break-glass requests');
    }
  });
  app.post('/api/admin/break-glass/:id/approve', async (req, res) => {
    try {
      await approveBreakGlassHandler(req, res);
    } catch (error) {
      sendRouteError(res, error, 'Break-glass Approve Error', 'Failed to approve break-glass request');
    }
  });

  app.post('/api/match/session/:sessionId/react', async (req, res) => {
    try {
      await reactMessageHandler(req, res);
    } catch (error) {
      sendRouteError(res, error, 'Match React Error', 'Failed to react');
    }
  });
  app.post('/api/match/session/:sessionId/respect', async (req, res) => {
    try {
      await respectVoteHandler(req, res);
    } catch (error) {
      sendRouteError(res, error, 'Match Respect Error', 'Failed to save respect vote');
    }
  });

  // Cross-device library sync (Firebase Admin or local data/library-sync)
  app.get('/api/library', async (req, res) => {
    try {
      await getLibraryHandler(req, res);
    } catch (error) {
      sendRouteError(res, error, 'Library GET Error', 'Failed to load library');
    }
  });
  app.put('/api/library', async (req, res) => {
    try {
      await putLibraryHandler(req, res);
    } catch (error) {
      sendRouteError(res, error, 'Library PUT Error', 'Failed to save library');
    }
  });

  // Lightweight per-user RAG index (complements client-side hybrid RAG)
  app.post('/api/rag/index', async (req, res) => {
    try {
      await ragIndexHandler(req, res);
    } catch (error) {
      sendRouteError(res, error, 'RAG Index Error', 'Failed to index document');
    }
  });
  app.post('/api/rag/query', async (req, res) => {
    try {
      await ragQueryHandler(req, res);
    } catch (error) {
      sendRouteError(res, error, 'RAG Query Error', 'Failed to query index');
    }
  });

  app.get('/api/admin/audit', async (req, res) => {
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const firestoreLogs = await fetchPlatformAuditFromFirestore(limit);
    const merged = [...serverAuditLogs];
    for (const e of firestoreLogs) {
      if (e.id && !merged.some((m) => m.id === e.id)) merged.push(e);
    }
    const logs = merged.slice(-limit).reverse();
    res.json({ logs, persistedPath: process.env.AUDIT_STORE_PATH ?? 'data/audit-log.jsonl' });
  });

  app.get('/api/admin/room-reports', async (req, res) => {
    try {
      await listRoomReportsHandler(req, res);
    } catch (error) {
      sendRouteError(res, error, 'Room Reports Error', 'Failed to list reports');
    }
  });

  // Social spine — unified Circles + Match + Collab policy
  app.post('/api/social/report', async (req, res) => {
    try {
      await socialReportHandler(req, res);
    } catch (error) {
      sendRouteError(res, error, 'Social Report Error', 'Failed to submit report');
    }
  });
  app.post('/api/social/rooms/:roomId/meet-consent', async (req, res) => {
    try {
      await roomMeetConsentHandler(req, res);
    } catch (error) {
      sendRouteError(res, error, 'Room Meet Consent Error', 'Failed to update Meet consent');
    }
  });
  app.post('/api/social/rooms/:roomId/meet', async (req, res) => {
    try {
      await roomCreateMeetHandler(req, res);
    } catch (error) {
      sendRouteError(res, error, 'Room Meet Error', 'Failed to create Meet link');
    }
  });
  app.get('/api/admin/social-reports', async (req, res) => {
    try {
      await listSocialReportsHandler(req, res);
    } catch (error) {
      sendRouteError(res, error, 'Social Reports Error', 'Failed to list social reports');
    }
  });
  app.patch('/api/admin/social-reports/:reportId', async (req, res) => {
    try {
      await triageSocialReportHandler(req, res);
    } catch (error) {
      sendRouteError(res, error, 'Social Triage Error', 'Failed to triage report');
    }
  });

  app.get('/api/admin/tenant-metrics', async (_req, res) => {
    const tenant = await fetchTenantMetricsFromFirestore();
    res.json(tenant ?? { firestoreEnabled: false });
  });

  app.get('/api/admin/metrics', (_req, res) => {
    const last24h = Date.now() - 24 * 60 * 60 * 1000;
    const last7d = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const recent = serverAuditLogs.filter(
      (e) => new Date(String(e.timestamp)).getTime() >= last24h,
    );
    const users7d = new Set(
      serverAuditLogs
        .filter((e) => new Date(String(e.timestamp)).getTime() >= last7d)
        .map((e) => String(e.userId ?? 'unknown')),
    );
    res.json({
      serverAuditTotal: serverAuditLogs.length,
      serverAudit24h: recent.length,
      uniqueActions: new Set(serverAuditLogs.map((e) => e.action)).size,
      uniqueUsers7d: users7d.size,
    });
  });

  // Client error report (public — no auth required)
  app.post('/api/health', express.json({ type: '*/*' }), (req, res) => {
    _require('fs').writeFileSync('client-error.log', JSON.stringify(req.body));
    console.error("CLIENT ERROR REPORT:", req.body);
    res.json({ status: 'ok' });
  });
  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const httpServer = http.createServer(app);

  try {
    const { attachYjsWebSocketServer } = await import('./yjsServer.js');
    const requireApiAuth = process.env.REQUIRE_API_AUTH === 'true';
    attachYjsWebSocketServer(httpServer, {
      projectId: firebaseConfig.projectId,
      requireAuth: requireApiAuth,
    });
    console.log(
      `Yjs websocket on ws://localhost:${PORT}/yjs (auth=${requireApiAuth ? 'required' : 'optional'})`,
    );
  } catch (err) {
    console.warn('[Memora] Yjs websocket unavailable (collab uses IndexedDB offline):', err);
  }

  httpServer.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE') {
      console.error(
        `[Memora] Port ${PORT} is already in use. Stop the other process (e.g. npm run dev) or set PORT to another value.`,
      );
      process.exit(1);
    }
    throw err;
  });

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
