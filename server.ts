import express from 'express';
import path from 'path';
import cors from 'cors';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import multer from 'multer';
import { YoutubeTranscript } from 'youtube-transcript';
import { createRequire } from 'module';
const _require = createRequire(typeof import.meta !== 'undefined' && import.meta.url ? import.meta.url : 'file://' + process.cwd() + '/server.ts');
const pdfParse = _require('pdf-parse');

// Initialize Gemini
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const upload = multer({ storage: multer.memoryStorage() });

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json({ limit: '50mb' }));

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
        // Fallback for generic URLs - just fetching the page with Gemini or raw
        res.status(400).json({ error: 'Only YouTube URLs are supported currently for transcript extraction' });
      }
    } catch (error) {
      console.error('Ingest URL Error:', error);
      res.status(500).json({ error: 'Failed to extract content from URL' });
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
      console.log('Study tips API fallback used due to error or quota limit.');
      // Fallback study tip when quota is exceeded or API fails
      res.json({
        tip: "Spaced repetition is a highly effective learning technique that involves reviewing information at gradually increasing intervals. Research shows it significantly improves long-term retention compared to cramming.",
        urls: []
      });
    }
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

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
