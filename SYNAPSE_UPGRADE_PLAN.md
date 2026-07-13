# Synapse-Learning → AI Tutor Studio: Comprehensive Upgrade Plan

## Executive Summary

This document details all dimensions where `ai_tutor_studio` is deficient relative to the mature `synapse-learning` codebase, and prescribes a phased implementation plan to reach feature parity and beyond. **No existing functionality will be removed** — only enriched.

---

## 1. ARCHITECTURE & INFRASTRUCTURE GAPS

### 1.1 Backend Server (CRITICAL)
| Synapse | AI Tutor Studio | Gap |
|---------|----------------|-----|
| Dedicated Express+Postgres server (`server/`) with 28 route files | Monolithic `server.ts` (40KB single file, no DB) | **Severe** |
| PostgreSQL with migrations | No database (localStorage only) | **Severe** |
| Redis for caching/rate-limiting | None | Major |
| MCP Protocol server (OAuth 2.1 + JSON-RPC tools) | None | Major |
| LTI 1.3 integration (LMS grade passback) | None | Moderate |
| Study Rooms (real-time collab via Yjs server-side) | Yjs present but only client-side | Moderate |
| Billing/subscription routes | None | Low (MVP) |

**Plan:**
- Phase A1: Extract `server.ts` into modular Express router structure (`server/src/routes/`)
- Phase A2: Add PostgreSQL via Prisma (user accounts, library, progress)
- Phase A3: Redis layer for session caching + rate limiting
- Phase A4: MCP server with tools (list_courses, get_progress, generate_quiz)

### 1.2 Workers & Performance
| Synapse | AI Tutor Studio | Gap |
|---------|----------------|-----|
| Web Workers: PDF thumbnail, OCR recognition, workspace compute | None | Major |
| `preloadCriticalChunks.ts` + `preloadWorkspaceToolChunks.ts` | None | Moderate |
| `lazyWithRetry.ts` (chunk failure recovery) | Basic lazy loading | Moderate |
| `chunkErrorReporter.ts` (Sentry integration) | None | Moderate |

**Plan:**
- Phase B1: Add `pdfThumbnail.worker.ts` for PDF cover generation
- Phase B2: Add workspace compute worker (heavy text analysis off main thread)
- Phase B3: Implement chunk preloading + retry with error boundary

### 1.3 Mobile / Capacitor
| Synapse | AI Tutor Studio | Gap |
|---------|----------------|-----|
| Full Capacitor config (iOS + Android) | PWA only | Moderate |
| Network status detection | `OfflineIndicator` (basic) | Minor |
| Fastlane build pipelines | None | Low |

**Plan:**
- Phase C1: Add Capacitor config + platform stubs
- Phase C2: Network status hook with offline queue

---

## 2. WORKSPACE TOOL COMPLETENESS

### 2.1 Tools Present in Synapse but Missing/Partial in AI Tutor Studio

| Tool | Synapse Implementation | AI Tutor Status | Priority |
|------|----------------------|----------------|----------|
| **Annotations** | Full AnnotationOverlay (27KB) + margin rail + toolbar + CRDT sync + remap | Rudimentary (in SourcePanel only) | **HIGH** |
| **Quiz** (in-workspace) | WorkspaceQuiz.tsx (10KB) + QuizPanel.tsx (9.6KB) + IRT scoring + remediation | QuizStepPanel (basic) | **HIGH** |
| **Dashboard** (in-workspace) | MiniDashboard (16KB) + DashboardPanel (12.5KB) + session model | Not present as workspace tool | **HIGH** |
| **Exam Prep** | ExamPrepPanel (12KB) + presets + countdown + syllabus coverage | None | **HIGH** |
| **Study Room** | StudyRoomPanel (9KB) + Jitsi embed + shared notes | CollabRoom exists but not workspace-integrated | Moderate |
| **Cognitive Reader** | CognitiveReader (57KB!): OCR overlay, heatmap, math blocks, TTS, bilingual, table layout | ReaderPanel (6KB, basic sections only) | **CRITICAL** |
| **Concept Map** | DraggableConceptMap (42KB): CRDT collab, hierarchy, force layout, export, cursor sync | ConceptMapGraph (5KB, basic) | **HIGH** |
| **Whiteboard** | StudyWhiteboard (32KB): diagram coach, LaTeX stamps, layers, blueprint coverage | Whiteboard (18KB, tldraw wrapper) | Moderate |
| **Leitner** | LeitnerBox (18KB) + LeitnerPanel (9KB) + due queue + FSRS rail + custom cards + occlusion | LeitnerPanel (9KB, good) | Moderate |
| **Scratchpad** | FormulaScratchpad (23KB): Pyodide/SymPy, graph viz, notes panel | ScratchpadPanel (6KB, basic calc) | **HIGH** |

### 2.2 Workspace Infrastructure Missing

| Feature | Synapse | AI Tutor Studio |
|---------|---------|----------------|
| Tool Cross-Links | `workspaceToolCrossLinks.ts` (13KB) | None |
| Tool Agent Chips | `workspaceToolAgentChips.ts` (3KB) | None |
| Workspace Discoverability | `workspaceDiscoverability.ts` (11KB) + Panel | None |
| Weak Areas Focus Rail | `WeakAreasFocusRail.tsx` (5KB) | None |
| Workspace Intel Side Sheet | 7KB | None |
| Learning Action Bar | 5KB | None |
| Selection Action Bar | 3KB | None |
| Mobile Intelligence Tabs | 2.5KB | None |
| Mobile Tool Drawer | 6KB | Basic mobile bar |
| Workspace Command Palette | 8KB | None (global only) |
| Source Status Bar | 9KB | None |
| Context Strip | 5KB | None |
| Step Rail | 4KB | None |
| Product Tour | `productTour.ts` + component | None |

**Plan:**
- Phase D1: Annotations system (AnnotationOverlay + store + anchoring)
- Phase D2: Enhanced CognitiveReader (OCR overlay, math blocks, heatmap, TTS)
- Phase D3: In-workspace Quiz with IRT scoring + remediation
- Phase D4: In-workspace Dashboard/Progress panel
- Phase D5: Exam Prep panel (presets, countdown, syllabus coverage)
- Phase D6: Enhanced Concept Map (hierarchy, force layout, CRDT)
- Phase D7: Enhanced Scratchpad (Pyodide/SymPy integration, graph)
- Phase D8: Workspace Tool Cross-Links + Discoverability

---

## 3. CONTENT ANALYSIS & PIPELINE

### 3.1 Text Processing
| Feature | Synapse (size) | AI Tutor Studio |
|---------|---------------|----------------|
| `contentAnalysis.ts` | **53KB** — full NLP pipeline | 6KB (basic) |
| `noteContentExtractors.ts` | **52KB** — debates, comparisons, formulas, flashcards | 5KB (minimal) |
| `textSegmentation.ts` | 25KB — sophisticated chunking | 2KB (basic) |
| `greekTextRepair.ts` | 25KB — OCR corruption fix for Greek | None |
| OCR ensemble (bilingual) | `bilingualOcrEnsemble.ts` (8KB) | None |
| Handwriting OCR | `handwritingOcr.ts` (6KB) | None |
| PDF layout blocks | `pdfLayoutBlocks.ts` (5.5KB) + math zones (7KB) | None |
| Document model | `documentModel.ts` (16KB) + snapshot (4KB) | None |
| Vision OCR | `visionOcr.test.ts` (uses LLM for OCR) | None |
| `formulaSolver.ts` | 13KB — CAS-like solver | None |
| Math OCR | `mathOcrClient.ts` (4KB) + normalize + repair | None |

### 3.2 Intelligence Features
| Feature | Synapse | AI Tutor Studio |
|---------|---------|----------------|
| Adaptive Scheduler | `unifiedAdaptiveScheduler.ts` (14KB) + retention model | Basic FSRS only |
| Quiz IRT | `quizIrt.ts` (7KB) — Item Response Theory | None |
| Behavior Inference | `behaviorInference.ts` (8KB) | None |
| Next Action Engine | `nextActionEngine.ts` (5KB) + dashboard | None |
| Proactive Agent Alerts | `proactiveAgentAlerts.ts` (4.5KB) | None |
| Knowledge Flow Analytics | `knowledgeFlowAnalytics.ts` (17KB) | None |
| Progress Insights | `progressInsights.ts` (10KB) | None |
| Retention Analytics | `retentionAnalytics.ts` (4KB) | None |

**Plan:**
- Phase E1: Port enhanced `contentAnalysis.ts` (full NLP pipeline)
- Phase E2: Port enhanced `noteContentExtractors.ts` (richer extraction)
- Phase E3: Greek text repair + bilingual OCR ensemble
- Phase E4: Unified Adaptive Scheduler + Quiz IRT
- Phase E5: Next Action Engine + Proactive Alerts
- Phase E6: Knowledge Flow + Retention Analytics
- Phase E7: Formula solver (Pyodide/SymPy)

---

## 4. AI AGENT SYSTEM

| Feature | Synapse | AI Tutor Studio |
|---------|---------|----------------|
| Agent component | 47KB with 15 modes | 33KB (good but fewer modes) |
| Agent modes | socratic, direct, beginner, exam-coach, deep-theory, practical, error-diagnosis, feynman, debate, oral-exam, math-tutor, coding-tutor, writing-coach, memory-coach, motivation | Fewer modes |
| Agent commands | `/quiz`, `/explain`, `/compare`, `/summarize` + workspace context | Basic |
| Workspace context bridge | `agentWorkspaceContext.ts` (9KB) | Basic |
| Grounding system | `grounding/` folder, faithfulness scoring, claim verification | None |
| RAG system | `rag.ts` (16KB) + server-side graph RAG | `rag.ts` (5KB, basic) |
| Multi-doc synthesis | `agentMultiDocSynthesize.ts` | None |
| Content citation | Structured citations with click-to-source | None |

**Plan:**
- Phase F1: Add missing agent modes (oral-exam, math-tutor, coding-tutor, writing-coach, memory-coach)
- Phase F2: Port grounding system (claim verification, faithfulness)
- Phase F3: Enhanced RAG with graph search + server-side index
- Phase F4: Agent workspace context bridge (bi-directional)
- Phase F5: Agent slash commands in workspace

---

## 5. UI/UX PLATFORM FEATURES

### 5.1 Pages & Views
| Synapse | AI Tutor Studio | Gap |
|---------|----------------|-----|
| Landing page (20KB) + FAQ + Footer + Trust strip | None (app-only) | Moderate |
| Onboarding (25KB) — multi-step, preference capture | None | **HIGH** |
| Analytics page (43KB) — visual lab, sankey, treemap | None | **HIGH** |
| Course View (51KB) — topic tree, lesson cards | Library page serves this | Moderate |
| Teacher Dashboard (54KB) — cohort heatmaps, roster | Admin page (basic) | Moderate |
| Exam Prep View (31KB) | None | **HIGH** |
| Note Analysis View (19KB) | None | Major |
| Settings (32KB) — 30+ configurable parameters | SettingsModal (11KB) | Moderate |
| Student Org (19KB) — announcements, calendar | None | Low |

### 5.2 Design System
| Feature | Synapse | AI Tutor Studio |
|---------|---------|----------------|
| Theme system | 5 themes (dark/light/system/spectrum/blueprint) | dark/light only |
| Design tokens | `designTokens.ts` (1.2KB) + CSS 165KB | `index.css` 9.5KB |
| UI primitives | `primitives.tsx` (11KB) — buttons, inputs, badges | Inline Tailwind |
| Platform chrome | `platformChrome.tsx` (13KB) — unified shell | layout/ folder |
| Motion sections | MotionSection, ViewTransition | Basic framer-motion |
| UX shimmer skeleton | Dedicated loading states | Minimal |
| Blueprint surface | Unique visual treatment | None |

### 5.3 Shell & Navigation
| Feature | Synapse | AI Tutor Studio |
|---------|---------|----------------|
| Shell (30KB) | Responsive shell with breadcrumbs, skip-links, notifications | Basic AppShell |
| Command Palette | 13KB — global + workspace-scoped | 20KB (good) |
| Notification system | `notificationBus.ts` + toast stack + panel | sonner toasts only |
| Product Tour | Guided onboarding tour | None |
| Error Boundary | ErrorBoundary + ErrorNotebook | Basic |

**Plan:**
- Phase G1: Onboarding flow (multi-step, preference capture)
- Phase G2: Analytics page (knowledge flow, retention, mastery heatmap)
- Phase G3: Exam Prep view (presets, countdown, syllabus tracker)
- Phase G4: Note Analysis view (diagnostics, structure report)
- Phase G5: Extended settings (30+ parameters, LLM config)
- Phase G6: Notification bus + toast stack + badge
- Phase G7: Product Tour system

---

## 6. DATA LAYER & PERSISTENCE

| Feature | Synapse | AI Tutor Studio |
|---------|---------|----------------|
| Store | 106KB Zustand monolith with full learner model | 5KB store + separate slices |
| IndexedDB | `indexedDbStorage.ts` (4KB) — blob cache | idb package (present) |
| Library sync | `libraryRemoteSync.ts` + `librarySync.ts` | `libraryStorage.ts` (basic) |
| Session sync | `sessionSync.ts` (6KB) — cross-tab | None |
| Offline queue | `offlineSyncQueue.ts` (2.5KB) | Basic offline indicator |
| Concept Graph (domain) | `courseConceptGraph.ts` (11KB) + `conceptGraph.ts` (12KB) | `ConceptGraph.tsx` (8KB, UI only) |
| Learner Model | Full `LearnerModel` type with 25+ fields | `useMasteryStore` (basic) |

**Plan:**
- Phase H1: Enrich Zustand store with full LearnerModel
- Phase H2: Cross-tab session sync
- Phase H3: Offline sync queue with retry
- Phase H4: Course concept graph (prerequisite DAG, locking)
- Phase H5: Enriched library sync with remote backup

---

## 7. TESTING & QUALITY

| Dimension | Synapse | AI Tutor Studio |
|-----------|---------|----------------|
| Unit tests | 1029+ (vitest) | 37 |
| E2E tests | 45+ Playwright specs | Minimal |
| Test coverage | Extensive per-module | Sparse |
| Visual regression | Snapshot tests | None |
| A11y tests | 8 dedicated a11y specs (axe-core) | None |
| Performance budget | `workspace-perf-budget.spec.ts` | None |
| Doc linting | `doc-lint.mjs`, `i18n-lint.mjs` | None |

**Plan:**
- Phase I1: Add unit tests for all workspace tools (target: 100+ tests)
- Phase I2: E2E tests for critical flows (upload → workspace → quiz)
- Phase I3: A11y audit specs (axe-core)
- Phase I4: Performance budget tests
- Phase I5: i18n lint script

---

## 8. GOOGLE TECHNOLOGIES INTEGRATION

| Feature | Synapse | AI Tutor Studio |
|---------|---------|----------------|
| Google OAuth | Full OAuth flow + token refresh | `useGoogleOAuth` hook |
| Google Calendar | Sync tasks ↔ calendar events | None integrated |
| Google Drive | Import/export | None |
| Google Classroom | LTI integration | `classroomService.ts` (basic) |
| Vision OCR (Google) | `visionOcr` via LLM | None |
| Gemini/GenAI | Via proxy | `@google/genai` (direct) ✅ |

**Plan:**
- Phase J1: Google Calendar task sync (create/update events)
- Phase J2: Google Drive import/export
- Phase J3: Enhanced Classroom integration

---

## 9. INTERNATIONALIZATION

| Feature | Synapse | AI Tutor Studio |
|---------|---------|----------------|
| i18n file | **247KB** — exhaustive coverage | 2.4KB (hook + basic) |
| Coverage | Every string in app | ~70% coverage |
| i18n lint | Automated CI check | None |
| Locale format | `localeFormat.ts` (numbers, dates, durations) | None |

**Plan:**
- Phase K1: Port comprehensive i18n dictionary (Greek + English)
- Phase K2: Add `localeFormat.ts` for numbers/dates/durations
- Phase K3: i18n lint script for CI

---

## 10. IMPORT/EXPORT ECOSYSTEM

| Feature | Synapse | AI Tutor Studio |
|---------|---------|----------------|
| NotebookLM import | Full bridge (import + export + audio) | None |
| ChatGPT import | `chatGptImport.ts` (8KB) | None |
| Anki import/export | APKG parsing + export | None |
| Study guide export | PDF/markdown | None |
| Concept map export | SVG/PNG/JSON | None |
| Whiteboard export | SVG/PNG | None |
| Progress export | PDF report | None |
| Outline preview | Upload structure preview | None |

**Plan:**
- Phase L1: Anki APKG import/export
- Phase L2: NotebookLM bridge (import transcripts + audio)
- Phase L3: ChatGPT conversation import
- Phase L4: Study guide PDF export
- Phase L5: Progress report PDF export

---

## IMPLEMENTATION PRIORITY MATRIX

### Phase 1 — Critical (Week 1-2)
1. **D2** Enhanced CognitiveReader (OCR, math blocks, heatmap)
2. **D1** Full Annotations system
3. **E1** Enhanced content analysis pipeline
4. **E2** Enhanced note content extractors
5. **D3** In-workspace Quiz + IRT

### Phase 2 — High (Week 3-4)
6. **D4** In-workspace Dashboard panel
7. **D5** Exam Prep panel
8. **G1** Onboarding flow
9. **D6** Enhanced Concept Map
10. **F1** Additional agent modes

### Phase 3 — Major (Week 5-6)
11. **D7** Enhanced Scratchpad (Pyodide)
12. **E4** Unified Adaptive Scheduler
13. **G2** Analytics page
14. **F2** Grounding system
15. **D8** Tool cross-links + discoverability

### Phase 4 — Moderate (Week 7-8)
16. **A1-A2** Server modularization + database
17. **B1-B3** Web Workers + chunk recovery
18. **H1-H2** Enhanced store + session sync
19. **G3-G4** Exam Prep view + Note Analysis
20. **E5-E6** Next Action Engine + Analytics

### Phase 5 — Enhancement (Week 9-10)
21. **F3-F5** Enhanced RAG + agent workspace bridge
22. **I1-I5** Testing suite expansion
23. **J1-J3** Google Calendar/Drive integration
24. **K1-K3** Full i18n expansion
25. **L1-L5** Import/export ecosystem

---

## CONSTRAINTS & PRINCIPLES

1. **Zero functionality removal** — all existing features preserved
2. **Google tech maintained** — Gemini, Firebase, OAuth all kept
3. **Bilingual (EN/EL)** — all new text uses `t()` function
4. **Architecture consistency** — glass-card, font-display, icon-in-box patterns
5. **TypeScript strict** — no `any`, no implicit
6. **Build must pass** — `tsc --noEmit` + `npm run build` after each phase
7. **Progressive enhancement** — features degrade gracefully without backend

---

## METRICS OF SUCCESS

- TypeScript strict: 0 errors
- Unit tests: 200+ (from 37)
- E2E tests: 20+ (from 0 meaningful)
- i18n coverage: 100%
- Lighthouse Performance: >90
- Workspace tools: 13 (from 11) with full depth
- Content pipeline: 10x richer extraction
- Agent modes: 15 (from current)
