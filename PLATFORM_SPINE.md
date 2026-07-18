# Platform Spine — blueprint adoption

Cross-cutting trust contracts mapped to the full Memora enhancement model.
Checklist for every route/API:

`Auth → Validate → Authorize → Moderate → Persist (versioned) → Observe → Pedagogy event → Privacy TTL`

Machine-readable cards: `GET /api/spine/adoption` (`server/spineAdoption.ts`).

## Phase status

| # | Layer / surface | Status | Implementation |
|---|-----------------|--------|----------------|
| 0 | Identity & trust | **Ops wired** | Bearer · App Check · session revoke · durable `trustedDevices` + Settings UX · `X-Device-Id` · claims/break-glass |
| 0 | Authorization | **Hardened** | Room ACL · Yjs membership · `new_room` denied when `REQUIRE_API_AUTH` (invite allow-list first) |
| 0 | Data contracts | **Hardened** | `validateObject` · Match `notesVersion` · library `libraryVersion` · Yjs snapshot `version` · resumable uploads |
| 0 | Safety | **Live spine** | Heuristics→Gemini · moderate image/board · MIME sniff · SSRF-safe `fetchPublicText` · AV quarantine hook |
| 0 | Reliability | **Hardened** | Gemini circuit breaker + **budget alerts** · Match **DLQ/PubSub bus + consumer** · durable Yjs **CRDT persist/restore** · sticky affinity |
| 0 | Observability | **Hardened** | Health probes `/api/health/{match,yjs,gemini}` · Admin SLO strip · circuit alerts · `chaos:spine` · `release-gate` |
| 0 | Pedagogy telemetry | **Evidence wired** | xAPI + 90d TTL · `/api/learning/*` · Feynman/Debate writeback · transfer battery · Dashboard calibration |
| 0 | Privacy | **Hardened** | Export / delete-request · **automated purge drain** · **legal hold** skip · Yjs/xAPI TTL compaction · no peer PII |
| 0 | Deploy | **Done** | Dockerfile ships `server/` + `dist/server.cjs` · authenticated Yjs |
| 1 | Auth / Google | **Ops wired** | App Check hooks · scoped OAuth · claims + break-glass · Contacts opt-in |
| 4 / 7 | Agent / Voice | **Learning wired** | Mode contracts · grounded RAG · barge-in · offline Voice pack · latency headers |
| 2–3 / 15 | Dashboard / Tasks / Mastery | **Evidence wired** | Joint scheduler · why-now · calibration · pedagogy writeback |
| 5 | Library / ingest | **Guarded** | MIME sniff · budgets · `libraryVersion` · **resumable client + durable session meta + AV** |
| 8–10 | Collab / Circles / Match | **Social spine** | Unified policy · image mod · trust prior · **durable Yjs** · **Match affinity** |
| 11 | Teacher / Classroom | **Institution spine** | Class ACL · DP aggregates · at-risk · Classroom sync |
| 4 / 15 | Eval / research | **Evidence spine** | Golden-question harness · `/api/evidence/*` · principles catalog |
| 6 | Study Workspace | **Workspace spine** | 13-tool registry · concept-bus · Feynman/Debate → mastery writeback |
| 14 | Offline / PWA | **Offline spine** | Signed packs · sync conflict UI · SW shells · offline Agent local RAG |
| 12 | Google Workspace | **Ops wired** | Calendar/Tasks · Meet/Forms audit · demo stubs labeled |
| 13 | Admin | **Ops wired** | Social triage · claims · break-glass · SLO strip · transfer eval · tenant metrics · Yjs compact |
| 16 | i18n / A11y | **Hardened** | `src/locales/{en,el}.json` catalogs · `tc()` · `dir` + RTL-ready · skip-link · focus traps · Match/Voice live regions |
| 17 | Chaos / Ops | **Harness** | `npm run chaos:match` · `chaos:spine` · `release-gate` · App Check CSP hosts |

## Modules

| Module | Purpose |
|--------|---------|
| `server/firebaseToken.ts` | Shared ID-token verify |
| `server/authz.ts` | Roles + room membership |
| `server/platformModeration.ts` | Content moderation spine |
| `server/socialPolicy.ts` | Circles+Match+Collab reports, triage, Meet dual-consent |
| `server/yjsSnapshotStore.ts` | Durable Yjs metadata + payload + TTL compaction |
| `server/matchAffinity.ts` | Instance sticky / region affinity for Match queue |
| `server/resumableUpload.ts` | Chunked uploads + MIME sniff + AV hook |
| `server/spineAdoption.ts` | Adoption cards 0–17 |
| `server/sessionTrust.ts` | Revoke sessions · durable trusted devices |
| `server/appCheck.ts` | Optional App Check enforce |
| `src/lib/pedagogyWriteback.ts` | Debate/Feynman → mastery + xAPI + learning events |
| `src/locales/en.json` · `el.json` | Bilingual catalog keys |
| `yjsServer.ts` | Authenticated WS upgrades + durable snapshot touch |

## Env knobs

| Variable | Effect |
|----------|--------|
| `REQUIRE_API_AUTH=true` | Bearer required + Yjs auth required |
| `APP_CHECK_ENFORCE=true` | Reject API without valid App Check |
| `TRUST_DEVICES=true` | Require registered `device_id` claim |
| `INSTANCE_ID` / `MATCH_STICKY=true` | Match sticky affinity mode |
| `MATCH_AFFINITY_STRICT=true` | 409 when client affinity mismatches |
| `MATCH_PUBSUB_TOPIC` | Advertise pubsub affinity mode (publisher) |
| `MATCH_PUBSUB_SUBSCRIPTION` | Pull subscription for Match multi-instance consumer |
| `AV_SCAN_COMMAND` | Optional clamav (etc.) for quarantine |
| `MAX_RESUMABLE_BYTES` | Resumable upload cap (default 25MB) |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | Durable queue, privacy, xAPI, Teacher, devices |
| `BREAK_GLASS_REQUIRED=true` | Claims require second-admin approval |
| `XAPI_LRS_ENDPOINT` / `XAPI_LRS_KEY` | Optional external LRS forward |

## API additions

- `GET /api/spine/adoption` — adoption cards + incomplete stages
- `GET/DELETE /api/auth/trusted-devices` · `POST` register · revoke with `clearTrustedDevices`
- `POST/PUT/GET /api/uploads/resumable` — chunked upload + quarantine
- `POST /api/admin/yjs/compact` — purge expired Yjs snapshots
- Match enqueue returns `affinity` + `X-Match-Affinity` headers
- Health: `appCheck`, `sessionTrust`, `match`, `yjs`, `uploads`

## Institutional gates

See `docs/INSTITUTIONAL_GATES.md` — DPA sign-off, independent WCAG pass, and efficacy gate before production marketing claims.

## §Ε — Maturity checklist (supersedes older “gaps” lists)

| Gap (historical wording) | Status | Evidence |
|--------------------------|--------|----------|
| `APP_CHECK_ENFORCE` + referrer keys in production | **Ops** | Code soft/enforce path ready · enable in prod project (`docs/APP_CHECK_AND_API_KEYS.md`) |
| Durable Yjs snapshot store | **Code done** | `server/yjsPersistence.ts` + `yjsSnapshotStore.ts` (CRDT persist/restore, not metadata-only) |
| Device trust durable + `TRUST_DEVICES` | **Code done** | Firestore/memory registry · Settings UX · `X-Device-Id` |
| Resumable uploads + AV | **Code done** | `resumableUpload.ts` + Library client preflight · MIME/AV quarantine |
| Match regional sticky / PubSub | **Code done** / **Ops config** | Affinity + emit on enqueue/match/leave + consumer · set GCP topic/subscription |
| Full locales/ + remaining focus traps | **Code done** (dialogs) | EN/EL catalogs · all `role="dialog"` traps · further `tc()` migration = polish |
| Debate/Feynman scoring → mastery | **Code done** | `pedagogyWriteback.ts` |
| Institutional DPA + independent WCAG/efficacy | **Institutional** | `docs/INSTITUTIONAL_GATES.md` |

Machine check: `GET /api/spine/adoption` → `incomplete: []` (surfaces 0–17).

**Still not closable by more UI features:**

1. Production: `APP_CHECK_ENFORCE=true` + referrer-restricted API key
2. Production: `MATCH_PUBSUB_TOPIC` + `MATCH_PUBSUB_SUBSCRIPTION` + GCP ADC
3. Counsel/QA: DPA ticket · manual WCAG pass · efficacy gate (no Bloom-2σ claims)
