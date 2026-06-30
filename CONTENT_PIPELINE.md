--- CONTENT_PIPELINE.md ---
# Content Pipeline

How uploaded material becomes a structured course and study content.

## Flow

```
UploadModal → processUpload()  [in src/store/useStore.ts]
  → extractFileContent() per file  [PDF text · DOCX · TXT/MD · image + scanned-PDF OCR]
  → generateCourseOutline() [LLM, if proxy/key]
  → analyzeContentToOutlineAsync() [offline; embedding-cluster topics when embeddings available]
  → analyzeContentToOutline() [offline; deterministic lexical fallback]
  → analyzeCourseSourceQuality() [course-level grounding / density / warning signals]
  → adaptOutlineToSourceQuality() [adaptive topic splitting / compaction]
  → buildCourseFromOutline() | mergeOutlineIntoCourse() [extend mode]
  → buildConceptSpans() [sentence-level source provenance]
  → mergeCourseTasks()
  → skill nodes + beta mastery init
  → persistLibrary()
  → CourseView diagnostics before Study Workspace
```

## Offline engine (`contentAnalysis.ts`)

- Section detection, RAKE + TextRank keyphrases
- Definition extraction, prerequisite inference
- Embedding-based topic clustering (`embeddingCluster.ts`) when embeddings are available, with deterministic lexical fallback
- Hybrid NER (`entityExtract.ts`) and concept→section binding (`conceptSectionBinding.ts`)
- `analyzeContentToOutline()` / `analyzeContentToOutlineAsync()` — no API key required

## LLM path (`courseGenerator.ts`)

- Used when `useLlm !== false` and proxy/key available
- Richer topics, objectives, glossary

## Course-level source quality (`courseSourceQuality.ts`)

- `analyzeCourseSourceQuality(text, outline)` scores the generated course on:
  word count, section count, definition density, glossary breadth, keyphrase
  breadth, formulas, comparisons, worked-example signals, and average
  concepts/topic.
- Produces `Course.sourceQuality` with:
  `score`, `band`, `needsMoreMaterial`, `warnings`, `nextActions`,
  `recommendedTopicCount`, `detectedTopicCount`, `finalTopicCount`, and
  `outlineAdjusted`.
- `adaptOutlineToSourceQuality(outline, quality)` compacts neighboring topics
  when the source is too sparse for the generated topic count, so the course is
  shaped before the learner ever opens the workspace.
- Extend mode recomputes the quality signal on the merged course, not just on
  the delta upload, so the course-level metadata stays representative.

## Source modes

| Mode | Behavior |
|------|----------|
| `strict` | Notes only — minimize enrichment |
| `enriched` | Notes primary + optional LLM enrichment |
| `notes-only` | Structure from notes, no additions |

## Incremental upload

Upload modal → **Extend existing course** → `mergeOutlineIntoCourse()` merges topics/glossary by normalized title.

After every successful upload, the learner lands on **CourseView** first.
Weak/sparse courses expose warnings and an **Add Material** path so the next
upload can strengthen the same course before deep study.

## Text normalization (reader + pipeline) — v2.5.0 (Wave 8B-β)

`normalizeDocumentText()` delegates to **`runDocumentTextPipeline()`** in
`documentTextPipeline.ts` before segmentation. Layer order:

1. **`sanitizeUnicode`** — NFKC + strip PUA/control/decorative symbols (preserves `\f` page breaks)
2. **`stripPresentationMarkup`** — flatten HTML/font spans from PDF extract
3. **`repairUtf8Mojibake`** — double-encoded UTF-8 repair
4. **Structural normalize** — form-feed → `--- page break ---`, whitespace cleanup
5. **`repairGreekDocumentText`** + **`repairSpacedLatinText`** — spaced/glued EL+EN OCR
6. **`applySpellGateDocument`** — offline lexicon + Viterbi segmentation + fuzzy OCR fix (skips chat speaker lines)
7. **`flattenReaderPresentation`** — plain text for Reader parity

Reader display uses **`repairDisplayPipeline()`** in `CognitiveReader.tsx` (same
core repair). `analyzeTextHygiene()` feeds **`courseSourceQuality`** with
`textHygieneScore` / corruption flags. `needsOcr()` also triggers when
`textLayerLooksCorrupted()` (spaced-glyphs, mojibake, PUA noise).

Reprocess bumps `pipelineVersion` to **2.5.0** and re-runs the full stack on
stored `extractedText`. Regression vectors: `greekOcrFixtures.ts` +
`documentTextPipeline.test.ts`.

## Limitations

- YouTube URLs: **transcripts ingested** via the server proxy `/v1/youtube/transcript` — captions are parsed (manual track preferred, ASR fallback) and the resulting text feeds the same outline → course pipeline as text uploads. The video metadata is preserved on the file row; the transcript becomes `extractedText` for chunking + RAG.
- Images / scanned PDFs: **OCR is wired** — `ocrExtract.ts` rasterizes pages and runs Tesseract.js, either in-browser or via the server proxy `POST /v1/ocr/pages` (languages `eng+ell`, capped at `OCR_MAX_PAGES`, default 15). Extracted text feeds the same outline → course pipeline.
- Audio: UI types only — Whisper transcription remains on the roadmap (not wired).
- Re-upload without extend mode creates a **new** course
- PDF page boundaries are preserved as `\f` (form-feed) so RAG citations resolve to `p.X`. PPTX slides use the same convention.

See [ARCHITECTURE.md](ARCHITECTURE.md) for module index.

