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
| Firebase authorized domains | Google sign-in on localhost |
| `PORT` | Default 3010 |

See `.env.local.example` for template.

---

*Last updated: Phase 8 launch readiness — real roadmap, multi-user admin signals, Docker deploy.*
