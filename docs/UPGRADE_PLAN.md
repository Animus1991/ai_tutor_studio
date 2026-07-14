# Memora AI Tutor Studio — Comprehensive Upgrade Plan

> **Principle:** Preserve and enrich every existing feature. No removals unless replaced by a strictly superior equivalent.

## 1. Executive Summary

Memora is a full-stack AI tutoring workspace (React 19 + Vite + Express + Gemini + Firebase) with 7 main routes, 11 Study Workspace tools, hybrid RAG, content pipeline, collab (Yjs), and demo sandbox. This plan maps current maturity, gaps, and phased upgrades toward production readiness.

---

## 2. Architecture Inventory

| Layer | Status | Notes |
|-------|--------|-------|
| **Frontend** | Mature UI | Dashboard, Library, Tasks, Agent, Collab, Workspace, Study Workspace |
| **Backend** | 15+ API routes | Gemini-dependent; rate-limited |
| **Auth** | Dual path | Google OAuth + local demo sandbox |
| **Storage** | Hybrid | Firebase Firestore + localforage/IndexedDB |
| **RAG** | Implemented | BM25 + semantic (`rag.ts`, `vectorStore.ts`) |
| **PWA** | Prod only | Disabled in dev to avoid stale cache |
| **Tests** | Partial | Pipeline + algorithms; needs E2E |

---

## 3. Route-by-Route Assessment

### `/` Dashboard
- **Done:** Streak, goals, charts, drag-reorder sections, PDF export, demo tasks/activity
- **Upgrade:** Wire charts to live task/session data; link cards to Study Workspace

### `/library` Library
- **Done:** Upload pipeline, AI courses section, bento grid, modals (clipper, occlusion, flashcards)
- **Upgrade:** Merge demo/Firebase/library courses in one grid; navigate to `/study/:id`; real export stats

### `/tasks` Tasks
- **Done:** FSRS, Pomodoro, demo CRUD, Firebase sync, voice summarize
- **Upgrade:** Replace mock analytics with computed metrics from tasks + session history

### `/agent` Agent
- **Done:** Hybrid RAG, citations, offline fallback
- **Upgrade:** Course-scoped context picker; conversation persistence in demo mode

### `/collab` Collab Space
- **Done:** Yjs CRDT, whiteboard, chat, quiz mock
- **Upgrade:** Self-hosted Yjs websocket; demo room without Firebase

### `/workspace` Workspace Sync
- **Done:** Calendar/contacts demo services, voice notes, focus mode
- **Upgrade:** Load without Google token in demo; show library courses

### `/study/:courseId` Study Workspace
- **Done:** 11 grounded tools, resizable panels, lesson steps, keyboard shortcuts
- **Upgrade:** Feynman API integration; quiz scoring; progress persistence

### `/admin` Admin
- **Done:** Role-gated route
- **Upgrade:** Audit log viewer; user metrics

---

## 4. Backend API Matrix

| Endpoint | Purpose | Gap |
|----------|---------|-----|
| `/api/agent/rag` | Grounded chat | Needs GEMINI_API_KEY |
| `/api/ingest/*` | PDF/URL ingest | YouTube only for URLs |
| `/api/feynman-check` | Feynman grading | Not wired in Study Workspace UI |
| `/api/logs` | Client error logging | **Added in Phase 3** |
| `/api/health` | Health + client errors | OK |

---

## 5. Demo Sandbox Maturity

| Feature | Demo Support |
|---------|--------------|
| Tasks CRUD | ✅ localforage |
| Activities/streak | ✅ seeded |
| Library course | ✅ Microeconomics + Data Analysis |
| Study Workspace | ✅ `/study/demo-course-*` |
| Workspace page | ✅ **Phase 3: no token required** |
| Agent RAG | ⚠️ Needs API key or offline fallback |
| Collab | ⚠️ External websocket fails (offline CRDT OK) |

---

## 6. Phased Implementation Roadmap

### Phase 3 — Continuity (current sprint)
- [x] Full-width layout + PWA dev fix + Layout hooks fix
- [x] `/api/logs` + `/api/logs/batch`
- [x] Task analytics from real data
- [x] Library course merge + Study Workspace navigation
- [x] Workspace demo without OAuth token
- [x] Second demo course seed

### Phase 4 — Data fidelity
- [x] Dashboard charts from `studySessionsHistory` (D3ActivityChart, DashboardStats, TaskCompletionChart demo fix)
- [x] Library export uses real streak/pomodoro from store
- [x] Agent: per-mode chat persistence (demo/auth scopes) + clear chat
- [x] Study Workspace: Feynman API + offline fallback + mastery score
- [x] Study Workspace: quiz scoring feedback (QuizStepPanel, XP, localforage persistence)

### Phase 5 — Production hardening
- [x] Firestore rules audit + emulator tests (`firestore.rules`, `tests/firestore.rules.test.ts`, `firebase.json`)
- [x] E2E tests (Playwright): demo flow, upload modal, study workspace (`e2e/demo-flow.spec.ts`)
- [x] Self-hosted Yjs server on `/yjs` (`yjsServer.ts`, `collabProvider.ts`, demo IndexedDB fallback)
- [x] CI: lint + test + build on PR (`.github/workflows/ci.yml`)
- [x] Firebase `persistentLocalCache` (replaces deprecated `enableIndexedDbPersistence`)

### Phase 6 — Enrichment
- [x] Google Classroom real OAuth (optional alongside demo) — `classroomService.ts`, Classroom scope in `auth.ts`, Library import
- [x] OCR for image uploads — `/api/ocr`, `uploadPipeline.ts`
- [x] xAPI LRS integration — `/api/xapi/statements` proxy, `xapiTracker.ts` forwards when `XAPI_LRS_*` set
- [x] Mobile PWA install prompts + offline study pack — `PwaInstallBanner.tsx`, `offlineStudyPack.ts`
- [x] CRDT WebSocket uses local `/yjs` instead of `demos.yjs.dev` — `crdt.ts`

### Phase 7 — Operations & Intelligence
- [x] Admin dashboard with real local metrics (`adminMetrics.ts`, `Admin.tsx`)
- [x] Filterable audit log viewer + server audit ring buffer (`/api/audit`, `/api/admin/audit`)
- [x] Agent course-scoped RAG context picker (`agentCourseContext.ts`, `sourceContext.ts` `docIds`)
- [x] Generic URL article ingest via cheerio (`/api/ingest/url`)
- [x] Dashboard “Continue Studying” links to `/study/:id` (`ContinueStudyingCard.tsx`)

### Phase 8 — Launch readiness
- [x] Study Roadmap from real tasks (demo / Firebase / local) — `studyRoadmap.ts`, `StudyRoadmap.tsx`
- [x] Multi-user admin signals — unique users from audit logs (client + server `/api/admin/metrics`)
- [x] Docker production image — `Dockerfile`, `.dockerignore`
- [x] Deployment guide — `docs/DEPLOYMENT.md`

### Phase 9 — Cloud & platform admin
- [x] Persistent audit store on disk (`auditStore.ts`, `AUDIT_STORE_PATH`, Fly volume)
- [x] Firestore platform audit + tenant metrics (`firebaseAdmin.ts`, `platform_audit`, `/api/admin/tenant-metrics`)
- [x] Cloud deploy configs — `railway.toml`, `fly.toml`, `cloudbuild.yaml`
- [x] Production E2E — `npm run test:e2e:prod` (build + Playwright against prod server)

### Phase 10 — Intelligence & demo fidelity
- [x] Smart Schedule from real `studySessionsHistory` (`predictOptimalStudyTime`, `OptimalStudyTimes.tsx`)
- [x] Library transcribe/analyze media via `/api/summarize-audio` + `/api/analyze-media` (`mediaPipeline.ts`)
- [x] Collab demo mode: local messages/quizzes (`collabDemoStorage.ts`, `CollabRoom.tsx`)
- [x] Library course quiz → Study Workspace navigation (replaces mock Google Form URL)
- [x] Vite `manualChunks` for cytoscape, tldraw, katex, firebase, charts, diagrams
- [x] `@y/y` dependency + Docker build hardening (commit `571fb83`)

### Phase 11 — Performance, streaming & accessibility
- [x] Lazy-load heavy routes: Library, Study Workspace, Collab, Workspace, Admin (`App.tsx`, `RouteFallback.tsx`)
- [x] Agent SSE streaming via `/api/agent/chat/stream` + `streamChatWithAgent` (fallback to non-stream)
- [x] YouTube batch lecture ingest: `/api/ingest/youtube/batch` + Upload modal tab + `processYoutubeBatch`
- [x] WCAG baseline: skip link, `#main-content` landmark, dialog `role`/`aria-*` on upload modal

---

### Phase 12 — Accessibility, performance & interactivity

- [x] Reusable `useFocusTrap` hook (`src/hooks/useFocusTrap.ts`): traps Tab/Shift+Tab, moves initial focus into dialog, restores focus on close, handles Escape
- [x] Focus trap + `role="dialog"`/`aria-modal`/`aria-labelledby` applied to `ShortcutsModal`, `SettingsModal`, `FeedbackModal` (+ `aria-label` on close buttons)
- [x] Chart alt text: `D3ActivityChart` exposes computed `role="img"` `aria-label` summary + `sr-only` text for screen readers
- [x] Performance: `Whiteboard` (tldraw) and new `ConceptMapGraph` are `React.lazy`-loaded inside Study Workspace, so tldraw/@xyflow bundles load only when their tool tab is opened (Suspense fallback)
- [x] Interactivity: concept-map tool upgraded from a static text list to a data-driven interactive `@xyflow` graph (`ConceptMapGraph.tsx`) with radial layout, relation-typed edges, legend, and minimap — built from the same `bundle.conceptMap` data (no functionality removed)
- [x] Ingest: YouTube **playlist auto-expand** — `expandYoutubePlaylist()` in `server.ts` scrapes playlist video IDs; wired into `/api/ingest/youtube/batch` (expand + de-dupe, cap 50) and `/api/ingest/url` (concatenate first 10 transcripts, `type: 'youtube-playlist'`)

### Phase 13 — Accessibility coverage sweep

- [x] Focus trap + `role="dialog"`/`aria-modal`/`aria-labelledby` extended to `QuickAddModal`, `UploadCourseModal`, `WebClipperModal`, `FlashcardGeneratorModal`, `ImageOcclusionModal` (all with `aria-label` close buttons); `QuickAddModal` retains its Cmd+K toggle
- [x] Chart alt text (`role="img"` + computed `aria-label`) added to `TaskCompletionChart`, `StudyProgressChart`, `TopicCompletionChart` (in addition to `D3ActivityChart` from Phase 12)

### Phase 14 — Backlog completion (a11y, agent grounding, i18n, integrations)

- [x] Focus trap + `role="dialog"`/`aria-modal`/`aria-labelledby` + close `aria-label` on the final modals: `PostSessionModal`, `PDFViewerModal`, `ImageGeneratorModal` (all 11 dialogs now trapped)
- [x] **Agent SSE grounding/citations**: `/api/agent/chat/stream` now enables `googleSearch` grounding and streams each `citation` event + a final `urls` list; `streamChatWithAgent` accepts a handlers object (`onChunk`/`onCitation`/`onDone`, back-compatible with the plain callback); `Agent.tsx` renders web-source chips incrementally during streaming (previously only the non-stream path had sources)
- [x] **i18n foundation**: `src/lib/i18n.tsx` — `LanguageProvider` + `useLanguage()` (safe no-provider fallback) + `t(en, el?)`; persisted to `localStorage` (`memora-lang`), browser-locale aware, sets `<html lang>`. Wrapped in `main.tsx`. Language toggle (EN/ΕΛ) added to `SettingsModal`; `SettingsModal` + `ShortcutsModal` strings translated as the reference implementation
- [x] **YouTube playlist pagination**: `expandYoutubePlaylist` follows InnerTube (`youtubei/v1/browse`) continuation tokens (up to 20 pages / 200 videos); batch route paginates then truncates to 100 (with `truncated`/`expandedCount` in the response) instead of rejecting large playlists
- [x] **Real Google Forms/Meet API**: `POST /api/google/forms` (Forms API) + `POST /api/google/meet` (Meet `v2/spaces`) — use an OAuth token from `body.accessToken`/`GOOGLE_ACCESS_TOKEN` when available, else return graceful fallback URLs (`forms/create`, `meet.google.com/new`). `CollabRoom` quiz + Meet handlers wired to these endpoints

## 9. Remaining gaps (Phase 15+ backlog)

| Area | Gap | Priority |
|------|-----|----------|
| **i18n** | Translate remaining pages/components beyond Settings/Shortcuts reference | Medium |
| **Google APIs** | OAuth consent flow to obtain `forms.body` / `meetings.space.created` scoped tokens in-app (server scaffold + fallback shipped) | Low |
| **Accessibility** | Live-region announcements for async toasts/streaming | Low |
| **Ingest** | Playlists beyond 200 videos (raise continuation page cap) | Low |

---

## 7. Quality Gates

Before each release:
1. `npm run lint` — zero TS errors
2. `npm run test` — all unit tests pass
3. Demo flow: `/?demo=1` → Library → Study Workspace → Tasks
4. No React hooks violations in Layout or conditional renders
5. Hard refresh confirms layout (no SW cache in dev)

---

## 8. Environment Checklist

| Variable | Required for |
|----------|--------------|
| `GEMINI_API_KEY` | AI agent, embeddings, summaries, OCR |
| `XAPI_LRS_ENDPOINT` / `XAPI_LRS_KEY` | Optional xAPI forwarding |
| `VITE_YJS_WS_URL` | Optional Yjs WebSocket override |
| `GOOGLE_ACCESS_TOKEN` | Optional — real Google Forms/Meet creation (`forms.body`, `meetings.space.created` scopes); falls back to `forms/create` + `meet.google.com/new` when unset |
| Firebase authorized domains | Google sign-in on localhost |
| `PORT` | Default 3010 |

See `.env.local.example` for template.

---

*Last updated: Phase 14 — focus trap + ARIA across all 11 modals, SSE agent grounding/citations, i18n foundation (EN/ΕΛ), InnerTube playlist pagination, real Google Forms/Meet endpoints with graceful fallback.*
