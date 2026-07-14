# Gemini API — cross-project setup (Memora, synapse-learning, others)

Use the **same** `.env.local` block in every Node/Vite project that calls Gemini.

## 1. Copy env block

```env
# ── Gemini (server reads on startup; restart required) ─────────────
GEMINI_API_KEY=your_key_here
GEMINI_CHAT_MODEL=gemini-2.0-flash
GEMINI_EMBED_MODEL=gemini-embedding-001

# Aliases also supported by Memora server:
# GOOGLE_API_KEY=
# GOOGLE_GENERATIVE_AI_API_KEY=

# Vite frontends only see VITE_* — Memora uses server proxy, so usually not needed:
# VITE_GEMINI_API_KEY=   ← avoid exposing keys in browser; prefer server routes
```

## 2. Verify key (any repo root)

From **Memora** (or copy `scripts/verify-gemini-key.mjs` into another project):

```bash
node scripts/verify-gemini-key.mjs
```

Or hit Memora diagnostic while `npm run dev` is running:

```bash
curl http://localhost:3010/api/health/gemini
```

Expected when billing/credits OK:

```json
{ "ok": true, "model": "gemini-2.0-flash", "sample": "OK" }
```

Expected when project credits depleted (key is valid but quota empty):

```json
{
  "ok": false,
  "code": "gemini_quota_exhausted",
  "message": "Gemini API credits exhausted..."
}
```

## 3. Key types

| Prefix | Source | Notes |
|--------|--------|-------|
| `AIza…` | Google Cloud / AI Studio classic | Standard REST key |
| `AQ.…` | AI Studio (newer express keys) | Works with `generativelanguage.googleapis.com` |

**Important:** Multiple keys in the **same Google Cloud / AI Studio project share billing quota.**  
Creating a new key does **not** reset usage. You need:

- Top-up / billing on the existing project, **or**
- A **new AI Studio project** with its own billing, then create a key there.

## 4. synapse-learning integration

If `synapse-learning` uses Gemini directly:

1. Add the env block above to `synapse-learning/.env.local`
2. Copy `scripts/verify-gemini-key.mjs` (or run it from Memora with `cd synapse-learning && node ../ai_tutor_studio/scripts/verify-gemini-key.mjs`)
3. Restart the dev server after any `.env.local` change
4. Prefer **server-side** Gemini calls (like Memora `/api/agent/chat`) — never ship keys in frontend bundles

### Minimal Node usage (any project)

```js
import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const res = await ai.models.generateContent({
  model: process.env.GEMINI_CHAT_MODEL ?? 'gemini-2.0-flash',
  contents: 'Hello',
});
console.log(res.text);
```

### Minimal REST (no SDK)

```bash
curl "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=$GEMINI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"contents":[{"parts":[{"text":"Hello"}]}]}'
```

## 5. Memora-specific routes

| Route | Purpose |
|-------|---------|
| `GET /api/health` | Server up |
| `GET /api/health/gemini` | Key + model + quota diagnostic |
| `POST /api/agent/chat` | Tutor chat |
| `POST /api/embed` | Embeddings for RAG |

## 6. Offline RAG (demo without Gemini)

When Gemini quota is exhausted, Memora still answers from uploaded/demo notes via BM25 hybrid RAG.  
Demo sandbox includes built-in **Cournot vs Bertrand** text — no upload required after `ensureDemoSandboxReady()`.

## 7. Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| `DemoModeError` | `VITE_REQUIRE_API_AUTH=true` in demo | Set both auth flags `false` or sign in with Google |
| `gemini_quota_exhausted` | Project billing / prepay empty | New project + billing or top-up |
| Empty offline RAG | Demo library not seeded | Restart app; click **Try Demo Sandbox** once |
| Key “unused” but 429 | Quota is **per project**, not per key | New AI Studio **project**, not just new key |
