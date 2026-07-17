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
| 0 | Safety | **Live spine** | Heuristics→Gemini · `POST /api/moderate` · Match + Collab + Agent + Voice STT/TTS |
| 0 | Reliability | **Partial** | Gemini circuit breaker · Idempotency-Key middleware · Firestore Match queue when Admin SDK present |
| 0 | Observability | **Partial** | `X-Request-Id` trace middleware · audit / room-reports / match metrics |
| 0 | Pedagogy telemetry | **Existing** | xAPI tracker + FSRS/mastery client stores (server-authoritative next) |
| 0 | Privacy | **Partial** | `GET /api/privacy/export` · `POST /api/privacy/delete-request` · Settings UI · no peer PII |
| 0 | Deploy | **Done** | Dockerfile ships `server/` + `dist/server.cjs` · authenticated Yjs |
| 1 | Auth / Google | **Partial** | App Check hooks · OAuth scopes exist · claims assignment still external |
| 8–10 | Collab / Circles / Match | **Hardened** | Yjs token+ACL · guidelines **v2** re-accept · Match moderator/social |
| 4 / 7 | Agent / Voice | **Safety wired** | User-text + transcript/TTS moderation · circuit breaker |
| 2–3,5–6,11–16 | Remaining surfaces | **Next** | Learning/social/institution/evidence spines per product blueprint |

## Modules

| Module | Purpose |
|--------|---------|
| `server/firebaseToken.ts` | Shared ID-token verify |
| `server/authz.ts` | Roles + room membership |
| `server/platformModeration.ts` | Content moderation spine |
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
| `FIREBASE_SERVICE_ACCOUNT_JSON` | Durable queue, privacy export, App Check verify, Teacher |

## API additions

- `POST /api/moderate`
- `GET /api/privacy/export`
- `POST /api/privacy/delete-request`
- Headers: `X-Request-Id`, `Idempotency-Key`, `X-Firebase-AppCheck`

## Next implementation order (unchanged)

1. Trust — claims service, App Check enforce in prod, referrer keys
2. Safety — multimodal upload moderation, board-text CRDT hooks
3. Learning — joint FSRS×mastery×RAG groundedness
4. Social — unified Circles+Match+Collab policy engine
5. Institution — Teacher tenancy + DP aggregates
6. Evidence — eval harnesses + xAPI retention jobs
