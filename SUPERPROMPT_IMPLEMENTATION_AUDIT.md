# SUPERPROMPT Implementation Audit

Legend: **Implemented** = executable path + validation; **Partial** = real path
with material gaps; **Mock** = UI/demo output without production mechanism;
**Missing** = no implementation. Audit date: 13 July 2026.

## 1. Pedagogical foundation

| Requirement | Status | Evidence | Remaining |
| --- | --- | --- | --- |
| Spacing / FSRS | Partial | `Tasks.tsx`, `Flashcards.tsx`, adaptive multiplier | Unify legacy `src/lib/fsrs.ts`; causal outcome evaluation |
| Retrieval practice | Implemented | Task/flashcard review, profile events | Delayed transfer tests |
| Interleaving | Partial | Mixed task/review surfaces | Confusability-aware item selection |
| Cognitive-load management | Partial | Adaptive chunk bounds, blueprint sessions | Validated load/impasse signals |
| Scaffolding | Partial | Socratic/Feynman modes, activity contract | Worked-example fading engine |
| Dual coding / multimodal | Partial | Graph, PDF, TTS, image tools | Coherence validator and captions |
| Self-determination | Partial | user pacing/goals/focus | Autonomy-support outcome evaluation |
| Montessori transfer | Design hypothesis | `PRODUCT_BLUEPRINT.md` | Adult trials; no efficacy claim |
| Learning-style guardrail | Implemented | no VARK labels; explicit uncertainty | Monitor product copy |

## 2. Implicit learning profile

| Requirement | Status | Evidence | Remaining |
| --- | --- | --- | --- |
| Response/outcome signals | Implemented | `learningProfile.ts`, Tasks/Agent/Feynman instrumentation | More quiz item taxonomy |
| Modality engagement | Implemented | text/voice/visual/retrieval channels | Separate accessibility from efficacy |
| Drop-off / impasse | Partial | focus duration, failed reviews | Page-level abandonment events |
| Cold start | Implemented | priors + confidence shrinkage | Validate priors by population |
| Quiz frequency / chunk size | Implemented | adaptive FSRS multiplier, RAG/chunk parameters | A/B evaluation |
| Theory/practice ratio | Implemented | profile parameters + blueprint modes | Outcome-conditioned policy |
| Error-pattern analytics | Implemented | dashboard top recurring gaps | Domain ontology mapping |
| Privacy / reset | Implemented | local aggregate, 500-event/90-day buffer, Settings reset | Institutional retention controls |

## 3. Notes → course architecture

| Requirement | Status | Evidence | Remaining |
| --- | --- | --- | --- |
| Text/PDF | Implemented | `/api/ingest/file` | page-level citation spans |
| Image/handwriting OCR | Partial | Gemini vision transcription | OCR confidence/handwriting benchmark |
| Slides/Office | Implemented | `officeparser` for PPTX/DOCX/XLSX/ODF/RTF | attachment/media provenance |
| YouTube | Implemented | `/api/ingest/url` | timestamp citations |
| Concept extraction | Implemented | ontology endpoint/store | merge/deduplicate confidence |
| Prerequisite curriculum | Implemented contract | blueprint prerequisite edges | persist complete Course entity |
| Theory/practice UI distinction | Partial | module modes/activities and existing tools | dedicated lesson renderer/runner |
| External enrichment | Implemented with caveat | grounded endpoint + source trail/review warning | allowlists + claim entailment |
| Hallucination controls | Partial | notes-only blueprint, citations, PII, RAG | automated claim-level evaluation |

## 4. Interactive tools

| Tool | Status | Evidence / limitation |
| --- | --- | --- |
| FSRS flashcards | Implemented / dual legacy | Real `fsrs.js`; one simplified path remains |
| Concept maps | Partial | Real extraction plus historical seed fallback |
| Feynman | Implemented | Structured gaps/praise; no offline rubric |
| Socratic tutor | Partial | Prompt policy, not a deterministic dialogue manager |
| Code sandbox | Partial | Pyodide Python; no multi-language isolated runner |
| Adjustable pacing | Implemented implicitly | bounded profile parameters; explicit override pending |
| Multimodal alternatives | Partial | TTS/dictation/PDF/graph/image |
| Mastery dashboard | Partial | profile evidence plus some mock widgets |
| Error analytics | Implemented | `LearningProfileInsights.tsx` |
| Whiteboard/collaboration | Partial | membership-scoped Firestore; public Yjs relay remains |
| Image occlusion | Mock | endpoint returns mock labels |
| Debate/compare/formula solver | Missing | roadmap |

## 5. Competitive differentiation

**Implemented as analysis:** `PRODUCT_BLUEPRINT.md` compares Coursera Coach,
ALEKS, Knewton Alta, Docebo, DreamBox, Khanmigo and LearnLM. The defensible
hypothesis is the auditable user-notes→curriculum→implicit-adaptation chain.
No claim of validated superiority is made.

## 6. Business model

**Implemented as proposal, not software:** tiers, COGS equation, current Gemini
price inputs, MVP sequence and legal/market risks are documented. Billing,
entitlements, institutional contracts and cost metering are **Missing** and
require product/legal infrastructure.

## 7. Technical stack

| Layer | Status |
| --- | --- |
| React/TypeScript/PWA | Implemented |
| Express/Gemini proxy | Implemented |
| Firebase Auth/Rules | Implemented with emulator contracts |
| IndexedDB/local demo | Implemented |
| Hybrid retrieval | Partial (separate lexical/vector paths) |
| Offline mutation queue | Missing |
| Authenticated realtime relay | Missing external deployment |
| Observability/SLOs | Partial |
| Component/E2E/model evals | Partial |

## Objective conclusion

The SUPERPROMPT is **not fully implemented**. The repository now implements a
substantial, tested vertical slice for heterogeneous ingestion, grounded
curriculum generation, implicit local adaptation, retrieval scheduling,
error analytics and secure collaboration metadata. The largest remaining
product gaps are the dedicated theory/practice lesson runners, unified
pedagogy/FSRS service, offline sync queue, deterministic scaffolding engine,
mock replacement, authenticated Yjs infrastructure, billing and causal
learning-outcome validation.
