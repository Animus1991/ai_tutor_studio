# Platform Spine — blueprint adoption

Cross-cutting trust contracts mapped to the full Memora enhancement model.
Checklist for every route/API:

`Auth → Validate → Authorize → Moderate → Persist (versioned) → Observe → Pedagogy event → Privacy TTL`

## Phase status

| # | Layer / surface | Status | Implementation |
|---|-----------------|--------|----------------|
| 0 | Identity & trust | **Partial** | Firebase Bearer middleware · optional App Check (`VITE_APPCHECK_SITE_KEY`, `APP_CHECK_ENFORCE`) · verified email gates on Match |
| 0 | Authorization | **Partial** | `server/authz.ts` room ACL · Firestore rules · Yjs membership when `REQUIRE_API_AUTH` |
| 0 | Data contracts | **Partial** | `validateObject` contracts (`server/requestSpine.ts`) · Match `notesVersion` concurrency |
| 0 | Safety | **Live spine** | Heuristics→Gemini · `POST /api/moderate` (+ `board`) · Match + Collab + Agent + Voice + whiteboard stickies |
| 0 | Reliability | **Partial** | Gemini circuit breaker · Idempotency-Key middleware · Firestore Match queue when Admin SDK present |
| 0 | Observability | **Partial** | `X-Request-Id` trace middleware · audit / room-reports / social-reports / match metrics |
| 0 | Pedagogy telemetry | **Existing** | xAPI tracker + FSRS/mastery client stores · `/api/learning/*` |
| 0 | Privacy | **Partial** | `GET /api/privacy/export` · `POST /api/privacy/delete-request` · Settings UI · no peer PII |
| 0 | Deploy | **Done** | Dockerfile ships `server/` + `dist/server.cjs` · authenticated Yjs |
| 1 | Auth / Google | **Partial** | App Check hooks · OAuth scopes exist · claims assignment still external |
| 4 / 7 | Agent / Voice | **Learning wired** | Mode contracts · exam-coach refusal · hybrid server RAG · groundedness · STT/TTS mod |
| 2–3 / 15 | Dashboard / Tasks / Mastery | **Partial** | Joint FSRS×mastery scheduler · Due reviews widget · MasteryDashboard · `/api/learning/*` |
| 8–10 | Collab / Circles / Match | **Social spine** | Unified `socialPolicy` · dual Meet consent on Collab · Circle↔Match bridge · guidelines on Circles · board text mod · admin triage taxonomy |
| 11 | Teacher / Classroom | **Institution spine** | Class-scoped progress · peer-PII redaction for students · DP aggregates · at-risk heuristics · Classroom roster consent sync · assignment→Memora maps · domain tenancy |
| 5–6,12–14,16–17 | Remaining | **Next** | Evidence / offline / Workspace spines |

## Modules

| Module | Purpose |
|--------|---------|
| `server/firebaseToken.ts` | Shared ID-token verify |
| `server/authz.ts` | Roles + room membership |
| `server/platformModeration.ts` | Content moderation spine |
| `server/socialPolicy.ts` | Circles+Match+Collab reports, triage, room Meet dual-consent |
| `src/lib/socialPolicy.ts` | Client capability matrix, bridge URLs, board moderation |
| `server/institutionCore.ts` | DP aggregates, at-risk, domain tenancy helpers |
| `server/teacher.ts` | Class ACL, Classroom sync, assignment maps, student-safe detail |
| `server/requestSpine.ts` | Trace IDs, idempotency, contracts |
| `server/circuitBreaker.ts` | Gemini breaker |
| `server/appCheck.ts` | Optional App Check enforce |
| `server/privacy.ts` | Export / deletion queue |
| `yjsServer.ts` | Authenticated WS upgrades |

## Env knobs

| Variable | Effect |
|----------|--------|
| `REQUIRE_API_AUTH=true` | Bearer required + Yjs auth required |
| `APP_CHECK_ENFORCE=true` | Reject API without valid App Check |
| `VITE_APPCHECK_SITE_KEY` | Client App Check (reCAPTCHA v3) |
| `VITE_APPCHECK_DEBUG_TOKEN` | Dev debug token |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | Durable queue, privacy export, App Check verify, Teacher, social triage |

## API additions

- `POST /api/moderate` (kinds include `board`)
- `POST /api/social/report`
- `POST /api/social/rooms/:roomId/meet-consent`
- `POST /api/social/rooms/:roomId/meet`
- `GET /api/admin/social-reports`
- `PATCH /api/admin/social-reports/:reportId`
- `POST /api/classes/:classId/classroom/sync`
- `POST /api/classes/:classId/assignments/map`
- `GET /api/classes/:classId/assignments`
- `POST /api/progress` (optional `classId` → class-scoped write)
- `GET /api/privacy/export`
- `POST /api/privacy/delete-request`
- Headers: `X-Request-Id`, `Idempotency-Key`, `X-Firebase-AppCheck`

## Next implementation order

1. Trust — claims service, App Check enforce in prod, referrer keys
2. Evidence — eval harnesses + xAPI retention jobs
3. Offline packs — signed manifests + conflict UI
4. Chaos/load — Match queue + Yjs
