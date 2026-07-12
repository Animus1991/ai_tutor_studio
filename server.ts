import * as cheerio from "cheerio";
import 'dotenv/config';
import express from 'express';
import http from 'http';
import path from 'path';
import cors from 'cors';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import multer from 'multer';
import { YoutubeTranscript } from 'youtube-transcript';
import { createRequire } from 'module';
import { appendPersistedAudit, loadPersistedAudit } from './auditStore.js';
import {
  fetchPlatformAuditFromFirestore,
  fetchTenantMetricsFromFirestore,
  persistAuditToFirestore,
} from './firebaseAdmin.js';
const _require = createRequire(typeof import.meta !== 'undefined' && import.meta.url ? import.meta.url : 'file://' + process.cwd() + '/server.ts');
const pdfParse = _require('pdf-parse');

if (!process.env.GEMINI_API_KEY) {
  console.warn('[Memora] GEMINI_API_KEY is not set — AI endpoints will fail until configured.');
}

// Initialize Gemini
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY ?? '' });
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });

/** Simple in-memory rate limiter per IP for AI routes. */
function createRateLimiter(maxRequests: number, windowMs: number) {
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
      return res.status(429).json({ error: 'Too many requests. Please wait a moment and try again.' });
    }
    entry.count++;
    return next();
  };
}

const aiRateLimit = createRateLimiter(30, 60_000);

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
  const res = await fetch(url, {
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

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3010;

  app.use(cors());
  app.use(express.json({ limit: '50mb' }));
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
        model: 'gemini-3.5-flash',
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
        model: 'gemini-3.5-flash',
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
      const statement = req.body;
      const lrsUrl = process.env.XAPI_LRS_ENDPOINT;
      const lrsKey = process.env.XAPI_LRS_KEY;

      if (lrsUrl && lrsKey) {
        const auth = Buffer.from(`${lrsKey}:`).toString('base64');
        const forward = await fetch(`${lrsUrl.replace(/\/$/, '')}/statements`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Basic ${auth}`,
            'X-Experience-API-Version': '1.0.3',
          },
          body: JSON.stringify(statement),
        });
        if (!forward.ok) {
          const detail = await forward.text();
          return res.status(502).json({ error: 'LRS rejected statement', detail });
        }
      }

      res.status(204).end();
    } catch (error) {
      console.error('xAPI Error:', error);
      res.status(500).json({ error: 'Failed to record xAPI statement' });
    }
  });

  app.post('/api/ingest/file', upload.single('file'), async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ error: 'File is required' });
      
      const buffer = req.file.buffer;
      const mimeType = req.file.mimetype;

      let text = '';
      if (mimeType === 'application/pdf') {
        const data = await pdfParse(buffer);
        text = data.text;
      } else if (mimeType.startsWith('text/')) {
        text = buffer.toString('utf-8');
      } else {
        return res.status(400).json({ error: 'Unsupported file type. Please upload a PDF or Text file.' });
      }

      res.json({ text, filename: req.file.originalname });
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
        model: 'text-embedding-004',
        contents: text
      });
      
      res.json({ embedding: response.embeddings[0].values });
    } catch (error) {
      console.error('Embed Error:', error);
      res.status(500).json({ error: 'Failed to generate embedding' });
    }
  });

  // AI Agent Route
  app.post('/api/agent/chat', async (req, res) => {
    try {
      const { messages, systemInstruction, model } = req.body;
      const response = await ai.models.generateContent({
        model: model || 'gemini-3.5-flash',
        contents: messages,
        config: {
          systemInstruction,
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
      
      res.json({ text, urls });
    } catch (error) {
      console.error('Gemini API Error:', error);
      res.status(500).json({ error: 'Failed to generate response' });
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
      const stream = await ai.models.generateContentStream({
        model: model || 'gemini-3.5-flash',
        contents: messages,
        config: { systemInstruction },
      });

      for await (const chunk of stream) {
        const text = chunk.text ?? '';
        if (text) {
          res.write(`data: ${JSON.stringify({ text })}\n\n`);
        }
      }
      res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
      res.end();
    } catch (error) {
      console.error('Gemini Stream Error:', error);
      res.write(`data: ${JSON.stringify({ error: 'Failed to stream response' })}\n\n`);
      res.end();
    }
  });

  // YouTube batch lecture ingest
  app.post('/api/ingest/youtube/batch', async (req, res) => {
    try {
      const { urls } = req.body;
      if (!Array.isArray(urls) || urls.length === 0) {
        return res.status(400).json({ error: 'urls array is required' });
      }
      if (urls.length > 20) {
        return res.status(400).json({ error: 'Maximum 20 URLs per batch' });
      }

      const results = await Promise.all(
        urls.map(async (url: string) => {
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

      res.json({ results });
    } catch (error) {
      console.error('YouTube Batch Error:', error);
      res.status(500).json({ error: 'Batch ingest failed' });
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
        model: 'gemini-3.5-flash',
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
        model: 'gemini-3.5-flash',
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
        model: 'gemini-3.5-flash',
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
        model: 'gemini-3.5-flash',
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
        model: 'gemini-3.5-flash',
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
        model: 'gemini-3.5-flash',
        contents: `Analyze the following text and generate a structured course blueprint. Break it into manageable study modules (Pomodoro sized). Identify key terms for a glossary. Extract core concepts for a knowledge graph ontology. Return JSON.\n\n${text}`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: "OBJECT",
            properties: {
              modules: {
                type: "ARRAY",
                items: {
                  type: "OBJECT",
                  properties: {
                    title: { type: "STRING" },
                    durationMinutes: { type: "INTEGER" },
                    description: { type: "STRING" }
                  },
                  required: ["title", "durationMinutes", "description"]
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
            required: ["modules", "glossary", "ontology"]
          }
        }
      });
      
      res.json(JSON.parse(response.text || '{"modules":[],"glossary":[],"ontology":{"nodes":[],"links":[]}}'));
    } catch (error) {
      console.error('Course Blueprint Error:', error);
      res.status(500).json({ error: 'Failed to generate blueprint' });
    }
  });
  app.post('/api/extract-ontology', async (req, res) => {
    try {
      const { text } = req.body;
      const response = await ai.models.generateContent({
        model: 'gemini-3.5-flash',
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
        model: 'gemini-3.5-flash',
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
      
      const response = await fetch(url);
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

  // Image Occlusion Route
  app.post('/api/occlusion', upload.single('image'), async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ error: 'Image file is required' });
      // Mock response for image occlusion (since API might fail with quota limits)
      const mockLabels = [
        { text: "Label 1", box: [100, 150, 140, 250] },
        { text: "Label 2", box: [300, 200, 340, 320] },
      ];
      await new Promise(r => setTimeout(r, 1000));
      res.json({ labels: mockLabels });
    } catch (error) {
      console.error('Image Occlusion Error:', error);
      res.status(500).json({ error: 'Failed to process image occlusion' });
    }
  });

  // Client logging (used by src/utils/logger.ts)
  app.post('/api/audit', express.json(), (req, res) => {
    if (req.body?.id && req.body?.action) {
      pushServerAudit(req.body);
    }
    res.status(204).end();
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

  app.post('/api/logs', express.json(), (req, res) => {
    console.error('[Client Log]', JSON.stringify(req.body));
    res.json({ status: 'ok' });
  });

  app.post('/api/logs/batch', express.json(), (req, res) => {
    const errors = req.body?.errors ?? [];
    console.error('[Client Log Batch]', errors.length, 'entries');
    res.json({ status: 'ok', received: errors.length });
  });

  // Health route
  app.post('/api/health', express.json({type: '*/*'}), (req, res) => {
    _require('fs').writeFileSync('client-error.log', JSON.stringify(req.body));
    console.error("CLIENT ERROR REPORT:", req.body);
    res.json({ status: 'ok' });
  });
  app.get('/api/health', (req, res) => {
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
    attachYjsWebSocketServer(httpServer);
    console.log(`Yjs websocket on ws://localhost:${PORT}/yjs`);
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
