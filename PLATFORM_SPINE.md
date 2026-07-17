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
| 0 | Pedagogy telemetry | **Evidence wired** | xAPI persist + 90d TTL · local cap · `/api/learning/*` · research export |
| 0 | Privacy | **Partial** | `GET /api/privacy/export` · research export · delete-request · no peer PII |
| 0 | Deploy | **Done** | Dockerfile ships `server/` + `dist/server.cjs` · authenticated Yjs |
| 1 | Auth / Google | **Partial** | App Check hooks · OAuth scopes exist · claims assignment still external |
| 4 / 7 | Agent / Voice | **Learning wired** | Mode contracts · exam-coach refusal · hybrid server RAG · groundedness · STT/TTS mod |
| 2–3 / 15 | Dashboard / Tasks / Mastery | **Evidence wired** | Joint scheduler · Due reviews with *why now* + principle tags · calibration bins · IRT bands |
| 8–10 | Collab / Circles / Match | **Social spine** | Unified `socialPolicy` · dual Meet · Circle↔Match bridge · board mod · admin triage |
| 11 | Teacher / Classroom | **Institution spine** | Class ACL · DP aggregates · at-risk · Classroom sync · assignment maps · domain tenancy |
| 4 / 15 | Eval / research | **Evidence spine** | Golden-question harness · `/api/evidence/*` · anonymized research export · blueprint principles catalog |
| 6 | Study Workspace | **Workspace spine** | `workspaceToolRegistry` (schema, persistence, pedagogy, a11y) · typed concept-bus event log |
| 14 | Offline / PWA | **Offline spine** | Signed study packs (SHA-256/HMAC) · sync conflict UI · SW route-shell caching · BG Sync register · offline Agent local RAG only |
| 12–13,16–17 | Remaining | **Next** | Google Workspace polish · break-glass admin · a11y/CI/chaos |

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
| `server/evidence.ts` | xAPI retention, research export, eval API, purge job |
| `src/lib/evidencePrinciples.ts` | PRODUCT_BLUEPRINT §1 principle tags + why-now |
| `src/lib/evidenceEval.ts` | Golden-question evaluation harness |
| `src/lib/calibration.ts` | Confidence calibration bins / Brier / MACE |
| `src/lib/offlineStudyPack.ts` | Signed offline packs + route precache list |
| `src/lib/offlineSyncQueue.ts` | Mutation queue + conflict resolve |
| `src/lib/workspaceToolRegistry.ts` | 13-tool contracts (schema/intent/a11y) |
| `src/lib/workspaceConceptBus.ts` | Engagement map + typed event log |
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
| `FIREBASE_SERVICE_ACCOUNT_JSON` | Durable queue, privacy/research export, xAPI persist, Teacher |
| `XAPI_LRS_ENDPOINT` / `XAPI_LRS_KEY` | Optional external LRS forward |

## API additions

- `POST /api/xapi/statements` (+ durable persist / TTL when Admin SDK present; `?meta=1`)
- `GET /api/research/export`
- `GET /api/evidence/principles`
- `POST /api/evidence/eval`
- `POST /api/admin/xapi/purge-expired`
- Social / institution / privacy endpoints from prior spines
- Headers: `X-Request-Id`, `Idempotency-Key`, `X-Firebase-AppCheck`

## Next implementation order

1. Trust — claims service, App Check enforce in prod, referrer keys
2. Google Workspace — audited Meet/Forms + Contacts opt-in
3. Chaos/load — Match queue + Yjs
4. CI e2e for `/match`, `/circles`, `/voice`, `/teacher`
5. WCAG 2.2 AA hardening + RTL-ready i18n completion
