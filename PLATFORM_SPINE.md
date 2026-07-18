# Platform Spine — blueprint adoption

Cross-cutting trust contracts mapped to the full Memora enhancement model.
Checklist for every route/API:

`Auth → Validate → Authorize → Moderate → Persist (versioned) → Observe → Pedagogy event → Privacy TTL`

## Phase status

| # | Layer / surface | Status | Implementation |
|---|-----------------|--------|----------------|
| 0 | Identity & trust | **Ops wired** | Bearer · App Check soft/enforce · health exposes mode · referrer-key runbook (`docs/APP_CHECK_AND_API_KEYS.md`) · verified email on Match |
| 0 | Authorization | **Partial** | `server/authz.ts` room ACL · Firestore rules · Yjs membership when `REQUIRE_API_AUTH` |
| 0 | Data contracts | **Partial** | `validateObject` contracts (`server/requestSpine.ts`) · Match `notesVersion` concurrency |
| 0 | Safety | **Live spine** | Heuristics→Gemini · `POST /api/moderate` (+ `board`) · Match + Collab + Agent + Voice + whiteboard stickies |
| 0 | Reliability | **Partial** | Gemini circuit breaker · Idempotency-Key middleware · Firestore Match queue when Admin SDK present |
| 0 | Observability | **Partial** | `X-Request-Id` trace middleware · audit / room-reports / social-reports / match metrics |
| 0 | Pedagogy telemetry | **Evidence wired** | xAPI persist + 90d TTL · local cap · `/api/learning/*` · research export |
| 0 | Privacy | **Partial** | `GET /api/privacy/export` · research export · delete-request · no peer PII |
| 0 | Deploy | **Done** | Dockerfile ships `server/` + `dist/server.cjs` · authenticated Yjs |
| 1 | Auth / Google | **Ops wired** | App Check hooks · scoped OAuth (Classroom/Meet/Forms/Tasks/Calendar/Contacts) · `POST /api/admin/claims` + break-glass |
| 4 / 7 | Agent / Voice | **Learning wired** | Mode contracts · exam-coach refusal · hybrid server RAG · groundedness · STT/TTS mod |
| 2–3 / 15 | Dashboard / Tasks / Mastery | **Evidence wired** | Learning OS strip · due FSRS · offline sync debt · joint scheduler · why-now · calibration |
| 8–10 | Collab / Circles / Match | **Social spine** | Unified `socialPolicy` · dual Meet · Circle↔Match bridge · board mod · admin triage |
| 11 | Teacher / Classroom | **Institution spine** | Class ACL · DP aggregates · at-risk · Classroom sync · assignment maps · domain tenancy |
| 4 / 15 | Eval / research | **Evidence spine** | Golden-question harness · `/api/evidence/*` · anonymized research export · blueprint principles catalog |
| 6 | Study Workspace | **Workspace spine** | `workspaceToolRegistry` (schema, persistence, pedagogy, a11y) · typed concept-bus event log |
| 14 | Offline / PWA | **Offline spine** | Signed study packs (SHA-256/HMAC) · sync conflict UI · SW route-shell caching · BG Sync register · offline Agent local RAG only |
| 12 | Google Workspace | **Ops wired** | Real Calendar when scoped token · Tasks LWW sync · demo mocks labeled · Contacts opt-in · Meet/Forms audit |
| 13 | Admin | **Ops wired** | Social triage · claims assign · break-glass approve · tenant metrics · audit export |
| 16 | i18n / A11y | **Hardened** | Settings EN/EL toggle · `dir` + RTL-ready · skip-link bilingual · focus traps on Settings/OAuth |
| 17 | Chaos / Ops | **Harness** | `npm run chaos:match` · Match concurrent pair stress tests · App Check CSP hosts |

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
| `server/claims.ts` | Custom claims + break-glass two-person rule |
| `server/googleWorkspaceAudit.ts` | Meet/Forms → `platform_audit` with room/class |
| `src/lib/contactsConsent.ts` | Contacts opt-in · demo email ACL guard |
| `docs/GDPR_FERPA_PLAYBOOK.md` | Retention, subject rights, DPA checklist |
| `yjsServer.ts` | Authenticated WS upgrades |

## Env knobs

| Variable | Effect |
|----------|--------|
| `REQUIRE_API_AUTH=true` | Bearer required + Yjs auth required |
| `APP_CHECK_ENFORCE=true` | Reject API without valid App Check |
| `VITE_APPCHECK_SITE_KEY` | Client App Check (reCAPTCHA v3) |
| `VITE_APPCHECK_DEBUG_TOKEN` | Dev debug token |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | Durable queue, privacy/research export, xAPI persist, Teacher, claims |
| `BREAK_GLASS_REQUIRED=true` | Claims require second-admin approval |
| `XAPI_LRS_ENDPOINT` / `XAPI_LRS_KEY` | Optional external LRS forward |

## API additions

- `POST /api/xapi/statements` (+ durable persist / TTL when Admin SDK present; `?meta=1`)
- `GET /api/research/export`
- `GET /api/evidence/principles`
- `POST /api/evidence/eval`
- `POST /api/admin/xapi/purge-expired`
- `POST /api/admin/claims` · `GET /api/admin/break-glass` · `POST /api/admin/break-glass/:id/approve`
- Meet/Forms bodies accept `roomId` / `classId` for audit linkage
- Social / institution / privacy endpoints from prior spines
- Headers: `X-Request-Id`, `Idempotency-Key`, `X-Firebase-AppCheck`

## Next implementation order

1. Turn on `APP_CHECK_ENFORCE=true` in production after site key + referrer keys (runbook done)
2. Full bilingual catalog coverage + remaining modal focus traps
3. Content pipeline virus/MIME budgets · Voice barge-in latency budgets
4. Match multimodal moderator · regional sticky queue
