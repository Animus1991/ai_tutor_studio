--- ALGORITHMS.md ---
# Algorithms

This document is the authoritative reference for **every learning, retrieval,
and content-recognition algorithm** in Synapse. It cites the file and the
function so you can read the code alongside the description. Nothing here is
aspirational — every algorithm listed is on the production code path today
(unless explicitly marked as roadmap).

The design rule is: **subject-agnostic, deterministic, and citable**. No
hardcoded vocabulary on the production path; same input → same output; every
extracted concept/quiz/edge can be traced back to the sentence(s) that
produced it.

---

## 1. Note ingestion → text

| File | Function | What it does |
| ---- | -------- | ------------ |
| `src/store/useStore.ts` | `processUpload` | Orchestrator: extracts text, runs the LLM outline (if a key is present), the async embedding-cluster outline, **and** the deterministic offline outline as fallback, then builds the course, glossary, tasks, and concept-provenance spans. |
| `src/lib/pdfExtract.ts` | `extractTextFromPdf` | Streams a PDF through `pdfjs-dist`, joins page text with the form-feed character (`\f`) so RAG can attach `p.X` citations. |
| `src/lib/pdfExtract.ts` | `extractTextFromPptx` | Reads PPTX via JSZip; one slide per `\f` block. |
| `src/lib/youtubeTranscript.ts` | `fetchYoutubeTranscript` | Calls the proxy (`/v1/youtube/transcript`) which uses `server/src/lib/youtubeCaptions.ts` to download timed-text and normalize to plain text. |
| `src/lib/uploadPipeline.ts` | `extractFileContent` | Plain text / Markdown / DOCX (mammoth) / **ChatGPT JSON/ZIP** / **image + scanned-PDF OCR** routing. |
| `src/lib/chatGptImport.ts` | `importChatGptExportFile` | Parses OpenAI export JSON (single conversation or array) and ZIP archives; walks the `mapping` tree in chronological order; emits `User:` / `Assistant:` / `System:` labels via `formatConversationWithLabels` so `textSegmentation` can split Q&A turns before course creation. Sets `ingestMethod: 'chatgpt-export'`. |
| `src/lib/ocrExtract.ts` | `ocrExtract` | Rasterizes pages and runs Tesseract.js in-browser, or delegates to the server proxy `POST /v1/ocr/pages` (`eng+ell`). |

Output: a normalized UTF-8 string with `\f` between page/slide blocks,
ready for the offline content engine.

---

## 2. Offline content-recognition engine v2

`src/lib/contentAnalysis.ts` (`analyzeContentToOutline`) is the deterministic
core of course creation. **It always runs**, even when the LLM is on, so we
have a known-good fallback.

### 2.1 Segmentation (`textSegmentation.ts` v3)

Production segmentation is centralized in `src/lib/textSegmentation.ts` and
surfaced to the UI via `documentStructureReport.ts`.

- **`detectDocumentSections`** — primary section splitter used by
  `contentAnalysis`, `noteContentExtractors`, `groundedLesson`, and RAG chunking.
  Boundary kinds include:
  - Markdown / numbered / underline headings (`#`, `Chapter`, `Κεφάλαιο`, etc.)
  - Slide/page breaks (`\f` form-feed from PDF/PPTX)
  - Horizontal rules and blank-line clusters
  - **Conversation turns** — `User:` / `Assistant:` / `Q:` / `A:` lines (ChatGPT exports)
  - **Dialogue** — em-dash speaker lines
  - **Date blocks** — journal-style temporal sections
  - Code-fence awareness (headings inside fenced blocks are ignored)
- **`detectHierarchicalSections`** — nested outline for hierarchical lesson mapping.
- **`splitStructuredParagraphs`** — reader-safe paragraph splits respecting fences
  and list boundaries.
- **Legacy wrapper** — `detectSections` in `contentAnalysis.ts` delegates to
  `detectDocumentSections` for backward compatibility.

When the document is flat, the engine falls back to one giant section; the Study
Workspace still shows paragraph-flow structure in `SourceIntelligenceCard`.

### 2.2 Keyphrase extraction (RAKE + TextRank blend)

- **RAKE** (`rakeScores`) — splits each sentence on stop-words and
  punctuation to form candidate phrases; scores each word by
  `degree(w) / freq(w)` and the phrase by the sum of its word scores.
- **TextRank** (`textRankScores`) — builds a word co-occurrence graph
  over a sliding window (default 4) and runs weighted PageRank
  (damping = 0.85, ~30 iterations) to score nodes.
- **Blend** — every candidate phrase gets `0.6 · rake + 0.4 · textrank`,
  normalized into 0..1. Phrases with stop-only tokens or single common
  words are dropped.

### 2.3 Concept normalization (stem-lite)

- `canonicalConcept` lowercases, strips punctuation, removes English/Greek
  inflectional endings (`s`, `es`, `ies`, `ing`, `ed`, `ων`, `ες`, `ους`,
  `ας`, …), and collapses whitespace, so "firm"/"firms" and "market
  structure"/"market structures" merge to one canonical concept.
- A `Map<canonical, displayLabel>` keeps the most readable surface form for
  each canonical key.

### 2.4 Definition + acronym mining

- **Copula / colon patterns** — `X is/are/refers to Y`, `X: Y`,
  `X — Y`, `X means Y` (also Greek `είναι`, `αναφέρεται σε`, `ορίζεται ως`).
- **Acronyms** — `Full Term (FT)` becomes a glossary entry with the
  acronym as a synonym.
- Definitions feed `glossaryEntries` and bias the keyphrase scorer (defined
  terms get a small importance boost).

### 2.5 Extractive summarization — biased TextRank with MMR

`extractiveSummary(text, n, opts)` is a personalized TextRank with a
maximal-marginal-relevance reranker:

- Sentence similarity is `overlap / (log(|a|+1) + log(|b|+1))` over content
  tokens — a soft denominator that doesn't over-penalize long sentences.
- The teleport vector is **topic-aware** (weighted by hits on
  `opts.biasTerms` — usually the topic title + top concepts) and gets a mild
  **lead bias** so thesis-statement sentences early in a section attract
  rank mass. This replaces uniform TextRank, which on short topic bodies
  drifts toward whichever sentence cluster is largest.
- Top-K selection uses **MMR** (`opts.mmrLambda`, default 0.7) so two
  near-duplicate sentences are never both chosen — a frequent failure mode
  on short bodies that have a thesis sentence repeated as a recap.
- Selected sentences are returned in document order so the summary reads
  naturally.

Used by: course-level summary, topic descriptions, lesson `intro`/`summary`
panels, sandbox insights, the Feynman coach's reference rewrite.

### 2.6 Learning-objective synthesis (Bloom-aware)

`buildObjectives(concepts, isGreek, difficulty)` walks **down the concept
list while walking up Bloom's cognitive ladder**:

| Difficulty | Ladder |
| ---------- | ------ |
| beginner | Remember → Understand → Apply |
| intermediate | Understand → Apply → Analyze → Evaluate |
| advanced | Apply → Analyze → Evaluate → Create |

Each level has 2 templates per language (EN/EL). Higher levels (Analyze,
Evaluate, Create) reach for a *second* concept (`{{c2}}`) so they encourage
comparison/synthesis instead of monotonously repeating the focus concept.

### 2.7 Prerequisite inference

- A topic depends on an earlier one when:
  - its body references the earlier topic's title, **or**
  - it shares ≥1 introduced concept with the earlier topic and the earlier
    topic was the first to introduce that concept.
- We also fall back to sequential chaining when nothing matches; this
  keeps the dependency graph connected for the Mastery Map.

Output: a `GeneratedOutline` with the same shape produced by
`courseGenerator` (LLM path), so `buildCourseFromOutline` is the single
sink — one course model, two sources.

> Tests: `src/lib/contentAnalysis.test.ts` covers segmentation, normalization,
> phrase extraction, and the end-to-end outline.

### 2.8 Named-entity & terminology extraction (`entityExtract.ts`)

- Rule-based mining of definitions, acronyms (`X (ABC)`), and proper-noun
  candidates, scored and deduped; optional server enrichment via
  `POST /v1/nlp/entities` (hybrid rule + LLM, `server/src/lib/ner.ts`).
- Feeds glossary candidates and concept canonicalization. Bilingual (EL/EN).

### 2.9 Embedding-based topic clustering (`embeddingCluster.ts`)

- When embeddings are available (`analyzeContentToOutlineAsync`), sections are
  embedded and grouped by **agglomerative clustering**; the medoid section
  names each cluster. Used for flat/unstructured notes where heading detection
  is weak; falls back to the deterministic lexical pipeline otherwise.

### 2.10 Concept → section binding (`conceptSectionBinding.ts`)

- Associates each extracted concept with the section(s) that introduce it, so
  lessons and the concept map can deep-link back to the source region.

> Tests: `embeddingCluster.test.ts`, `entityExtract.test.ts`,
> `conceptSectionBinding.test.ts`.

---

## 3. LLM-grounded outline (when a proxy key is present)

`src/lib/courseGenerator.ts` calls the proxy with the extracted text and a
schema-bound prompt that produces:

```
{
  title, summary, level,
  topics: [{ title, summary, concepts, prerequisites, objectives, examples, … }],
  glossary: [{ term, definition, synonyms }]
}
```

The schema is deliberately the **same** as the offline engine output, so the
downstream pipeline doesn't care which path produced the outline. If the LLM
returns garbage / a malformed JSON, we fall back to the offline analyzer for
that topic.

---

## 4. Course assembly

`src/lib/uploadPipeline.ts` → `buildCourseFromOutline` materializes the
outline into the runtime types:

- `src/lib/courseSourceQuality.ts` analyzes the *whole course source* before
  assembly. It mixes word count, section count, definitions, glossary breadth,
  keyphrase breadth, formulas, comparisons, worked-example cues, and
  concept-density into a normalized **course-level source quality score**.
- The output is stored as `Course.sourceQuality`:
  `{ score, band, needsMoreMaterial, warnings, nextActions, detectedTopicCount, recommendedTopicCount, finalTopicCount, outlineAdjusted, metrics }`.
- `adaptOutlineToSourceQuality` is the upstream control loop: when the outline
  has more topics than the source can realistically support, neighboring topics
  are merged before the course is built. This prevents shallow, over-split
  courses and makes the final module count match source density.
- Incremental upload (`mergeOutlineIntoCourse`) recomputes the quality signal on
  the merged course preview, so warnings and module budgets evolve as more
  material is added.
- `Course` with `topics: Topic[]`, each `Topic` has `concepts`, `objectives`,
  `prerequisites`, `examples`, and a deterministic stable id derived from
  the canonical title + content hash.
- `glossaryEntries` are merged into the user's library (dedupe by canonical
  term + course id).
- `taskGenerator.ts` produces `Task`s from each topic's objectives so the
  Tasks page is grounded in the user's own material.
- `courseMerge.ts` handles incremental uploads (re-upload of an updated PDF
  re-runs the analyzer and merges by normalized topic title).
- `conceptProvenance.ts` (`buildConceptSpans`) locates each concept's defining
  sentence(s) in the source files and stores `Course.conceptSpans`
  (sentence-level `{fileId, charStart, charEnd}`), powering click-to-source in
  lessons and the workspace. Tests: `conceptProvenance.test.ts`.

---

## 5. Retrieval (RAG)

`src/lib/rag.ts` is the retrieval layer used by every workspace tool, the
Agent, and `noteContentExtractors`.

### 5.1 Tokenization & chunking

- `tokenize` — lowercases, strips diacritics, drops stop-words, keeps
  alphanumeric tokens of length ≥2.
- `chunkText` — splits text on `\f` (page/slide), `\n\n` (paragraph), and a
  ~600-char soft cap with sentence-aware breaking. Each chunk records its
  `pageOrParagraph` index for citation (`p.X` / `¶X`).

### 5.2 BM25 scoring

- `buildCorpus` indexes a list of chunks: builds inverted index, document
  lengths, and the average length.
- `retrieve(query, k)` runs **Okapi BM25** with `k1=1.5`, `b=0.75`. Returns
  the top-K chunks with raw BM25 scores and their citations.
- `noteContentExtractors.relevantExcerpt` and `topRelevantChunks` use a
  one-shot BM25 corpus when the source text is large, falling back to
  section-level heuristics for small texts.

### 5.3 Optional embeddings (`src/lib/sourceContext.ts`)

- When the proxy is configured, `embedQuery` and `embedDocs` call
  `/v1/embeddings`; results are cached in IndexedDB keyed by
  `(model, contentHash)`.
- The hybrid score is `0.6 · normalize(BM25) + 0.4 · cosine(embedQ,
  embedDoc)`. Without a proxy, embeddings are skipped silently.

### 5.4 Source modes

- **Strict** — Agent answers only with retrieved excerpts; cites every
  claim; refuses when the corpus has no hit.
- **Enriched** — Agent may add general background but still grounds primary
  claims in citations.

---

## 6. Workspace tool extractors

`src/lib/noteContentExtractors.ts` turns the active course/notes into the
inputs each of the eleven workspace tools needs. All extractors are
deterministic and citable.

| Extractor | Algorithm |
| --------- | --------- |
| `relevantExcerpt(text, concept)` | Hybrid score: `tokenOverlap(rag.tokenize) + phraseHit + BM25 over chunks` for large docs. Reorders top hits by document order so the excerpt reads naturally. |
| `topRelevantChunks(text, concept, k)` | Direct BM25 hits (deduped by chunk id). |
| `buildWorkspaceSourceIntelligence(...)` | Composite scoring over passage relevance, structure, explicit definitions, glossary overlap, worked examples, formulas, comparison rows, concept-map breadth, step count, and quiz availability. Emits a 0β€“100 grounding score plus a recommended workspace tool. |
| `buildConceptMapFromCourse(course)` | Topic-level nodes + edges from prerequisites + **PMI co-occurrence** edges across sliding sentence windows (`window=3`, threshold from observed mass). |
| `buildQuizFromNotes(text, concept, glossary)` | Cloze (glossary-grounded) and MC items pulled from sentences scoring high on `conceptRelevanceScore`. Distractors via `rankDistractorTerms` / `rankDistractorSentences`. Options ordered by **deterministic seeded shuffle** (`seedFromString(concept + correct)`), so the correct answer is randomly placed but the order is stable across renders. |
| `extractWorkedExamples(text)` | Detects sentences flagged by example markers (`for example`, `παράδειγμα`, `consider`, numbered "Example 1." headings). |
| `extractComparisons(text, concept)` | Three-tier extraction (in order): **(1)** Markdown comparison tables — `parseMarkdownTables` recognises pipe tables and emits one row per `(dimension, col_i, col_j)` pair; **(2)** "X vs Y" / "compared to" / "ενώ" sentence patterns; **(3)** glossary co-occurrence + standalone definitions as a fallback. |
| `buildDebateTreeFromNotes(text)` | Multi-axis sentence scoring on three independent axes — **claim** (thesis connectives + strong modals), **support** (evidence connectives + numerical density), **refute** (contrast connectives + hedging modals). The highest-scoring sentence on each axis becomes the central claim / supporting / counter-arguments, laid out left-vs-right around the claim node. Falls back to relevance-only ranking when no markers fire. |

### 6.1 Quiz distractor ranking

- `termTokens` and `termJaccard` produce a Jaccard score on normalized
  token sets.
- `rankDistractorTerms(target, glossaryTerms)` picks **near-miss** glossary
  terms — Jaccard in the `[0.15, 0.65]` band, length within ±40% — so
  options are plausible but not synonyms.
- `rankDistractorSentences(target, candidates)` adds a length-similarity
  penalty so MC distractors look like real answers.

### 6.2 PMI concept-edge inference

- For each pair of concepts `(a, b)` we count co-occurrences within a
  sliding window of 3 sentences and singletons across the document.
- `pmi = log2(P(a, b) / (P(a) · P(b)))`, dropped when `pmi < 1` or
  co-occurrence count < 2.
- The resulting edge weights drive the Concept Map's "related" links and
  the Mastery Map's secondary edges.

---

## 7. Pedagogy (mastery, repairs, calibration)

`src/lib/pedagogy.ts`:

- **Beta-mastery** — each first attempt updates a `Beta(α, β)` posterior.
  Difficulty (`beginner`/`intermediate`/`advanced`) re-weights the
  evidence; mean = `α / (α + β)` is the displayed mastery.
- **Confidence calibration** — `confidenceCalibration` builds reliability
  bins and reports overconfident / calibrated / underconfident.
- **Prerequisite repairs** — when mastery on concept C drops below 0.45 and
  we have a `prereqEdges` graph, the worst prerequisite is surfaced as a
  repair task.
- **Mastery bands** — `strong / proficient / developing / weak` thresholds
  drive the Mastery Map colors and weak-area suggestions.

`src/lib/spacedRepetition.ts`:

- Implements the **FSRS-4** scheduler (Free Spaced Repetition System) for
  Leitner cards: stability + difficulty parameters update on every
  rating; the next interval is computed analytically rather than by
  hardcoded multipliers.

`src/lib/skillNodes.ts`:

- `isSameConcept(a, b)` does **exact + Jaccard** matching over normalized
  token sets (default threshold 0.7) so "consumer surplus" matches
  "consumer-surplus" but never collides with "producer surplus" the way
  the old `slice(0, 8)` did.
- `findSkillForConcept` and `updateCourseTopicMastery` use it to project
  workspace activity back onto course topics.

---

## 8. Feynman rubric (subject-agnostic)

`src/lib/feynmanRubric.ts`:

- Inputs: the user's plain-English explanation + a `RubricContext` (concept,
  reference notes, glossary, extra terms).
- `tokens(text)` — alphanumeric + non-stopword.
- `buildKeyTerms(ctx)` — derives the canonical key-terms list from the
  concept and reference notes/glossary; deduplicated and ranked. **No
  hardcoded vocabulary** — replaces the old Cournot/Bertrand list.
- Scores:
  - **Accuracy** — sqrt curve over key-term hits.
  - **Structure** — discourse-marker presence ("first / however /
    therefore / πρώτον / επομένως" …) and sentence-count.
  - **Plain-language** — penalizes words ≥ 9 chars and jargon density.
  - **Completeness** — coverage of the requested objectives (when given).
- Output: per-axis 0..100 + a weighted overall score.

`FeynmanCheck.tsx` passes glossary + matching topic title as `extraTerms`
so the rubric is grounded in the same notes the user is studying.

---

## 9. Formula solver

`src/lib/formulaSolver.ts` — generic shunting-yard evaluator (no
hardcoded economics formulas).

- **Tokenizer** — handles unary minus, scientific notation, identifiers
  (variables, functions, constants).
- **Shunting-yard** with right-associative `^` and per-function arity.
- **Functions**: `sin`, `cos`, `tan`, `asin`, `acos`, `atan`, `log` (base
  10), `ln`, `sqrt`, `exp`, `abs`, `floor`, `ceil`, `round`, `min`, `max`.
- **Constants**: `pi`, `e`.
- **Variables** — every non-function/non-constant identifier becomes a
  free variable; `evaluateFormulaExpression` substitutes user-supplied
  values, formats the result with the variable's unit, and emits structured
  steps for the Scratchpad UI.
- Errors are typed: `division by zero`, `unknown variable X`, `unbalanced
  parentheses`, etc.

> Tests: `src/lib/formulaSolver.test.ts` (14 cases) covers precedence,
> unary minus, trig, log, sqrt, scientific notation, variable substitution,
> and every error path.

---

## 10. Identity & user state

`src/lib/identity.ts`:

- `levelFromXp(xp)` — logarithmic mapping XP → level (so demo "Level 7"
  doesn't leak; level grows naturally with real activity).
- `nameFromEmail(email)` — Title-Case the local-part, trim domain, fall
  back to "Learner" when no email is provided.
- `buildInitialUser({ settings, persistedXp, authEmail, streak })` — uses
  `mockUser` only when `shouldShowDemo()` is true; otherwise produces a
  clean identity from real inputs.
- `applyAuthIdentity(user, authEmail)` — refreshes name/email after a
  login so the sidebar updates immediately.

---

## 11. Activity → analytics

`src/lib/activityLog.ts` records every quiz attempt, Leitner rating,
Feynman explanation, and timer session as a typed event with
`(concept, taskId, ts, payload)`.

`src/lib/retentionAnalytics.ts` derives:

- **Retention curve** — accuracy by day-since-first-encounter (Ebbinghaus
  shape).
- **Weekly mastery** — rolling Beta mean by ISO week.
- **Weak areas** — concepts with mastery < 0.5 and ≥ 3 attempts.

> Tests: `src/lib/retentionAnalytics.test.ts`.

`src/components/Analytics.tsx` consumes the activity log + course graph
to build the Mastery Map dynamically (no hardcoded subject).

---

## 12. Persistence layout

See `PERSISTENCE.md` for keys. Algorithmically relevant points:

- All extractor outputs are **idempotent** given the same inputs, so
  rebuilding from `synapse:library-v1` always reproduces the same course.
- IndexedDB caches large extracted text bodies (over the localStorage
  threshold) so the JSON library payload stays small.
- Per-task scoping (`workspacePersistence.ts`) makes whiteboard /
  scratchpad / concept-map state reproducible per study session.

---

## 13. Roadmap (algorithms not yet shipped)

These are intentional gaps — listed here so contributors don't reinvent them:

- **Audio / video transcription** beyond YouTube captions (Whisper) — not yet wired.
- **Symbolic CAS layer** — replace string-based step generation with
  a tiny CAS so we can show real algebra steps for any formula, not just
  numerical evaluation.
- **Argument mining** — upgrade `buildDebateTreeFromNotes` from heuristic
  claim extraction to a proper claim-evidence-counterclaim model.
- **Multi-user collaborative annotations** — current annotations are local
  per `fileKey`; a server-side store would let teachers/learners share.
- **Adaptive scheduler** — combine FSRS-4 with the Beta-mastery posterior
  for joint spacing + difficulty selection (currently independent).

When working on any of the above, follow the rules in `CONTRIBUTING.md`:
deterministic, subject-agnostic, citable, and unit-tested.

