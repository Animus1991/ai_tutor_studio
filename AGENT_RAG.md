--- AGENT_RAG.md ---
# Agent & RAG (Retrieval-Augmented Generation)

How Synapse grounds the **Agent**, **Feynman**, and lesson tools in uploaded notes — offline by default, with optional semantic rerank when a proxy/key is configured.

## Overview

```
Uploads (extractedText)
        │
        ▼
  rag.ts — chunk + BM25 corpus
        │
        ├─► sourceContext.ts — excerpts + hybrid rerank
        │         │
        │         ▼
        │   Agent.tsx / FeynmanCheck / lessonGenerator
        │
        └─► Citations (file, ¶, heading, snippet)
```

Retrieval runs **client-side by default** (no server needed). An **optional** server RAG endpoint also exists — `POST /v1/rag/query` (`server/src/routes/rag.ts` → `server/src/lib/ragServer.ts`) embeds the query plus client-supplied chunks and returns cosine-ranked hits — for deployments that prefer server-side reranking. The client currently uses the local path; wiring the server path for large libraries is tracked in `PRODUCT_SCALE_PLAN.md` §7.1 / §7.3.

## Modules

| Module | Role |
| ------ | ---- |
| `src/lib/rag.ts` | Chunking, tokenization, BM25 scoring, citation formatting |
| `src/lib/sourceContext.ts` | High-level API: excerpts, query retrieval, embedding rerank |
| `src/lib/llmClient.ts` | OpenAI-compatible chat + embeddings (direct or via proxy) |
| `src/components/Agent.tsx` | Chat UI; injects retrieved context into system prompt |

## Chunking (`rag.ts`)

1. Each `UploadedFile.extractedText` is split into ~900-char chunks with 160-char overlap.
2. Chunks carry provenance: `fileId`, `fileName`, char offsets, optional page/heading.
3. A corpus cache is keyed by a signature of file ids + text lengths (invalidates on upload).

## Retrieval

### Lexical (always available)

`retrieveSources(files, query, opts)`:

- Tokenizes query + chunks (Greek + English stopwords).
- Scores with BM25; returns top-k chunks up to `maxChars`.
- Builds a human-readable excerpt and structured `Citation[]`.

Used by lesson panels, workspace note bundles, and offline Agent templates.

### Hybrid (optional)

`retrieveForQueryHybrid` in `sourceContext.ts`:

1. BM25 top hits (same as above).
2. If `isLlmAvailable(settings)`, embed query + candidate snippets via `/v1/embeddings`.
3. Blend lexical (50%) + cosine similarity (50%); sort and return.

Falls back to pure BM25 when embeddings fail or no key/proxy is set.

## Agent flow

1. User sends a message in **Agent**.
2. `retrieveForQueryHybrid(uploadedFiles, message, settings, { concept, courseId })` fetches relevant chunks.
3. System prompt includes the excerpt + instruction to cite sources.
4. If `useLlm !== false` and a proxy/key exists, `llmClient.chat` streams the reply; otherwise an offline template answers from the same excerpt.
5. Citations render via `formatCitation()` (file name + locator like `¶4`).

## Settings that affect RAG

| Setting | Effect |
| -------- | ------ |
| Managed proxy URL / auth token | Routes embeddings + chat through server; enables hybrid rerank |
| Use LLM for Agent & Feynman | When off, Agent uses offline templates only (retrieval still runs) |
| Language (`el` / `en`) | UI strings; BM25 handles both scripts in the same corpus |

## `hasSource` gate

Workspace and lesson views check that uploaded material exists for the active course/concept before showing grounded tools. Without source text, components show an upload empty state instead of demo filler.

## Extension points

- **Server-side index**: keep the same `Citation` shape; replace `buildCorpus` with a remote search API.
- **Stronger rerank**: swap `embeddingReranker` for a cross-encoder or provider-specific rerank API.
- **Course-scoped filter**: pass `courseId` in retrieval opts to prefer files tagged to that course.

## Related docs

- [CONTENT_PIPELINE.md](CONTENT_PIPELINE.md) — how `extractedText` is produced
- [ARCHITECTURE.md](ARCHITECTURE.md) — store and upload flow
- [server/README.md](server/README.md) — proxy auth and metering

