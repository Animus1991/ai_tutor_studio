# Platform Spine — Exhaustive Technical Inventory

**Canonical pipeline:**  
`Auth → Validate → Authorize → Moderate → Persist (versioned) → Observe → Pedagogy event → Privacy TTL`

**Machine oracle:** `GET /api/spine/adoption` → `incomplete: []` (18 surfaces, ids 0–17)  
**Source of truth for cards:** `server/spineAdoption.ts`  
**Branch closeout:** `cursor/platform-spine-3eed`

This document is the scholastic inventory of every platform element against the spine.  
A stage marked `n/a` is intentionally out of scope for that surface (not a gap).  
A stage marked `wired` means code contracts exist end-to-end.  
Ops/institutional items that remain outside code are listed only in §Z.

---

## Product invariants (non-negotiable)

| Invariant | Enforcement |
|-----------|-------------|
| Learning-only product | No public feed, DMs, open profiles, or discovery social graph |
| Invite / Match scoped social | Circles invite-only · Match ephemeral Buddy-#### |
| Meet dual consent | Both parties must consent before Meet link is actionable |
| Camera off by default | Voice/Meet UX does not auto-start camera |
| Pseudonyms | Match displays `Buddy-####`, never peer email/name |
| Demo email ACL block | `@example.com` / `@demo.local` never written to room ACL |
| No Bloom-2σ marketing | Efficacy claims gated (`docs/INSTITUTIONAL_GATES.md`) |
| Memora design system | Dashboard/Tasks densified; no orphan grid columns |

---

## Stage semantics

| Stage | Contract |
|-------|----------|
| **Auth** | Firebase ID token (Bearer) and/or App Check / session trust as configured |
| **Validate** | Schema / MIME / budget / content-shape checks before mutation |
| **Authorize** | Role, room membership, tenancy, or owner scope |
| **Moderate** | Heuristics → Gemini path; image/board/text quarantine where applicable |
| **Persist** | Versioned writes (notesVersion, libraryVersion, Yjs version, transcripts) |
| **Observe** | Audit events, health probes, latency headers, SLO signals |
| **Pedagogy** | Learning events / xAPI / mastery writeback / calibration |
| **Privacy** | TTL, export/delete, purge drain, legal hold, no peer PII |

---

## Surface matrix (0–17)

Legend: ● wired · ○ n/a · — not applicable to harness

| # | Surface | Auth | Val | Authz | Mod | Persist | Obs | Ped | Priv |
|---|---------|------|-----|-------|-----|---------|-----|-----|------|
| 0 | Platform kernel | ● | ● | ● | ● | ● | ● | ● | ● |
| 1 | Auth / Google | ● | ● | ● | ○ | ● | ● | ○ | ● |
| 2 | Dashboard | ● | ○ | ● | ○ | ● | ● | ● | ● |
| 3 | Tasks / Reviews | ● | ● | ● | ○ | ● | ● | ● | ● |
| 4 | Agent | ● | ● | ● | ● | ● | ● | ● | ● |
| 5 | Library / Ingest | ● | ● | ● | ● | ● | ● | ● | ● |
| 6 | Study Workspace | ● | ● | ● | ● | ● | ● | ● | ● |
| 7 | Voice Tutor | ● | ● | ● | ● | ● | ● | ● | ● |
| 8 | Collab | ● | ● | ● | ● | ● | ● | ● | ● |
| 9 | Study Circles | ● | ● | ● | ● | ● | ● | ● | ● |
| 10 | Study Match | ● | ● | ● | ● | ● | ● | ● | ● |
| 11 | Teacher / Institution | ● | ● | ● | ○ | ● | ● | ● | ● |
| 12 | Google Workspace | ● | ● | ● | ○ | ● | ● | ○ | ● |
| 13 | Admin / Ops | ● | ● | ● | ● | ● | ● | ○ | ● |
| 14 | Offline / PWA | ● | ● | ● | ○ | ● | ● | ● | ● |
| 15 | Mastery / Evidence | ● | ● | ● | ○ | ● | ● | ● | ● |
| 16 | i18n / A11y | ○ | ○ | ○ | ○ | ● | ○ | ○ | ○ |
| 17 | Chaos / Deploy | ● | ● | ● | ○ | ○ | ● | ○ | ○ |

**Oracle:** `incomplete: []` — no `partial` or `stub` stages remain on any card.

---

## Per-surface technical dossier

### 0 — Platform kernel

| Field | Detail |
|-------|--------|
| Modules | `firebaseToken.ts`, `requestSpine.ts`, `authz.ts`, `platformModeration.ts`, `sessionTrust.ts`, `appCheck.ts`, `yjsSnapshotStore.ts`, `privacyPurge.ts`, `circuitBreaker.ts`, `matchQueueBus.ts` |
| Auth | Bearer verify · App Check soft/enforce · session revoke · `X-Device-Id` + trusted devices |
| Validate | `validateObject` · shared request spine |
| Authorize | Room ACL · Yjs membership · `new_room` denied under `REQUIRE_API_AUTH` without invite |
| Moderate | Heuristics→Gemini · MIME sniff · SSRF-safe fetch |
| Persist | Durable Yjs CRDT (`yjsPersistence` + snapshot store) · versioned docs |
| Observe | `/api/health/{match,yjs,gemini}` · circuit budget alerts |
| Pedagogy | Learning event bus hooks |
| Privacy | Export / delete-request · automated purge · legal hold · TTL compaction |
| Env | `REQUIRE_API_AUTH`, `APP_CHECK_ENFORCE`, `TRUST_DEVICES`, `FIREBASE_SERVICE_ACCOUNT_JSON` |

### 1 — Auth / Google

| Field | Detail |
|-------|--------|
| Modules | `claims.ts`, `useGoogleOAuth.ts`, `googleWorkspaceAudit.ts` |
| Contracts | Scoped OAuth · Contacts opt-in · `BREAK_GLASS_REQUIRED` for elevation · demo email ACL block |
| Privacy | Token scopes minimized · audit of Workspace grant/revoke |

### 2 — Dashboard

| Field | Detail |
|-------|--------|
| Modules | `Dashboard.tsx`, `jointScheduler.ts`, `evidencePrinciples.ts`, `calibration.ts`, `offlineSyncQueue.ts` |
| Pedagogy | Joint scheduler why-now · MACE/Brier calibration · evidence principles |
| Observe | Offline sync debt surface |
| UX | Full-width actionable row (4-col); densified Tools; no orphan Recent Activity column |

### 3 — Tasks / Reviews

| Field | Detail |
|-------|--------|
| Modules | `Tasks.tsx`, `fsrs.ts`, `googleTasksSync.ts`, `calibration.ts`, `spineEvents.ts` |
| Validate | FSRS card shape · review payload |
| Persist | `expireAt` TTL on learning artifacts |
| Pedagogy | FSRS + learning events · `TASK_COMPLETED` audit |
| UX | Dense list + focus modes; sidebar cards tightened |

### 4 — Agent

| Field | Detail |
|-------|--------|
| Modules | `agentModes.ts`, `ragGrounding.ts`, `agentChatStorage.ts`, `circuitBreaker.ts` |
| Moderate | Mode contracts · grounded RAG · content guard on turns |
| Persist | Versioned transcripts |
| Observe | `X-Agent-Latency-Ms` · Gemini circuit + **budget alerts** |
| Pedagogy | Learning event per turn |
| Chaos | Covered by `chaos:spine` |

### 5 — Library / Ingest

| Field | Detail |
|-------|--------|
| Modules | `contentGuard.ts`, `resumableUpload.ts`, `libraryStorage.ts`, `libraryRag.ts` |
| Validate | MIME sniff · budgets · `MAX_RESUMABLE_BYTES` |
| Moderate | AV quarantine hook (`AV_SCAN_COMMAND`) |
| Persist | `libraryVersion` · resumable session meta · RAG index |
| Observe | `LIBRARY_PUT` / `RAG_INDEX` audit |
| Privacy | `expireAt` + purge drain |
| API | `POST/PUT/GET /api/uploads/resumable` |

### 6 — Study Workspace

| Field | Detail |
|-------|--------|
| Modules | `workspaceToolRegistry.ts`, `workspaceConceptBus.ts`, `pedagogyWriteback.ts`, `workspacePersistence.ts`, `focusWellbeing.ts`, `AnnotationOverlay.tsx` |
| Moderate | Annotation moderation |
| Pedagogy | Feynman/Debate/quiz → mastery writeback |
| Privacy | 90d workspace GC |
| UX | Focus wellbeing bounds (suggest level typed) · 13-tool registry |

### 7 — Voice Tutor

| Field | Detail |
|-------|--------|
| Modules | `voiceTutorSession.ts`, `VoiceTutor.tsx`, `platformModeration.ts` |
| Moderate | Transcript moderation |
| Persist | Session packs · offline prompt pack |
| Observe | Live region status (`a11y.liveStatus`) |
| Auth side-effect | Session revoke kills mic |
| UX | Barge-in · camera off default |

### 8 — Collab

| Field | Detail |
|-------|--------|
| Modules | `yjsServer.ts`, `yjsSnapshotStore.ts`, `socialPolicy.ts`, `CollabRoom.tsx`, `spineEvents.ts` |
| Auth | Authenticated WS upgrades |
| Persist | Durable Yjs CRDT snapshot touch/restore |
| Moderate | Image/board via social policy |
| Pedagogy | `COLLAB_MESSAGE` observe/pedagogy |
| Social | Meet dual-consent · invite allow-list |

### 9 — Study Circles

| Field | Detail |
|-------|--------|
| Modules | `safeSocial.ts`, `socialPolicy.ts`, `StudyCircles.tsx` |
| Authorize | Invite-only membership |
| Moderate | Guidelines gate before participation |
| Observe | `CIRCLE_CREATE` / `CIRCLE_OPEN` events |
| Invariant | No public discovery feed |

### 10 — Study Match

| Field | Detail |
|-------|--------|
| Modules | `studyMatch.ts`, `matchAffinity.ts`, `matchQueueBus.ts`, `matchPubSubConsumer.ts`, `matchModerator.ts`, `MatchSession.tsx` |
| Persist | Queue + affinity metadata |
| Observe | enqueue/match/leave → PubSub emit · sticky affinity headers · DLQ |
| Moderate | AI moderator · learning-safe topics |
| UX | Buddy-#### · live status region · no peer PII |
| Env | `INSTANCE_ID`, `MATCH_STICKY`, `MATCH_AFFINITY_STRICT`, `MATCH_PUBSUB_TOPIC`, `MATCH_PUBSUB_SUBSCRIPTION` |
| Chaos | `npm run chaos:match` · `chaos:spine` |

### 11 — Teacher / Institution

| Field | Detail |
|-------|--------|
| Modules | `teacher.ts`, `institutionCore.ts` |
| Authorize | Class ACL · domain tenancy |
| Persist | Classroom sync artifacts |
| Pedagogy | At-risk signals · DP aggregates |
| Privacy | FERPA minimization · no peer PII in exports |

### 12 — Google Workspace

| Field | Detail |
|-------|--------|
| Modules | `Workspace.tsx`, `calendarSnapshot.ts`, `googleWorkspaceAudit.ts`, `contactsConsent.ts` |
| Auth | Scoped OAuth only |
| Persist | Calendar LWW snapshot |
| Observe | Meet/Forms audit trail |
| Privacy | Contacts opt-in required |

### 13 — Admin / Ops

| Field | Detail |
|-------|--------|
| Modules | `Admin.tsx`, `claims.ts`, `evidence.ts`, `privacyPurge.ts` |
| Authorize | Admin claims · break-glass second approval |
| Moderate | Social triage queue |
| Observe | SLO strip · tenant metrics · transfer eval |
| Privacy | Legal-hold aware purge · `POST /api/admin/privacy/purge` · `POST /api/admin/yjs/compact` |

### 14 — Offline / PWA

| Field | Detail |
|-------|--------|
| Modules | `offlineStudyPack.ts`, `offlineSyncQueue.ts` |
| Auth | Uid-bound packs · flush auth gate |
| Persist | Signed packs + TTL · SW shells |
| Pedagogy | Replay on flush · offline Agent local RAG |
| Observe | `OFFLINE_FLUSH` audit |
| Chaos | Offline path in `chaos:spine` |

### 15 — Mastery / Evidence

| Field | Detail |
|-------|--------|
| Modules | `evidence.ts`, `evidenceEval.ts`, `transferTest.ts`, `pedagogyWriteback.ts`, `calibration.ts` |
| Validate | Golden-question harness payloads |
| Pedagogy | Transfer battery · writeback · calibration |
| Privacy | Research export strips peer PII |
| API | `POST /api/evidence/eval` · `POST /api/evidence/transfer` · `GET /api/research/export` |
| Claim policy | No Bloom-2σ until institutional efficacy gate |

### 16 — i18n / A11y

| Field | Detail |
|-------|--------|
| Modules | `i18n.tsx`, `locales/en.json`, `locales/el.json`, `SkipLink.tsx`, guidelines + confirm dialogs |
| Persist | Locale preference |
| A11y | `dir` + RTL-ready · skip-link · focus traps on all `role="dialog"` · Match/Voice live regions |
| Gate | Independent WCAG 2.2 AA pass remains institutional (`INSTITUTIONAL_GATES.md`) |

### 17 — Chaos / Deploy

| Field | Detail |
|-------|--------|
| Modules | `e2e/spine-smoke.spec.ts`, `chaos-match-yjs.mjs`, `chaos-spine.mjs`, `Dockerfile` |
| Scripts | `chaos:match` · `chaos:spine` · `release-gate` · `check` |
| Deploy | Dockerfile ships `server/` + `dist/server.cjs` · authenticated Yjs |
| Prod enforce | `REQUIRE_API_AUTH` + `APP_CHECK_ENFORCE` (ops) |

---

## Cross-cutting API surface (spine-facing)

| Endpoint / capability | Surface |
|----------------------|---------|
| `GET /api/spine/adoption` | 0–17 oracle |
| `GET/DELETE/POST /api/auth/trusted-devices` | 0, 1 |
| `POST/PUT/GET /api/uploads/resumable` | 5 |
| `POST /api/admin/yjs/compact` | 0, 8, 13 |
| `GET /api/privacy/export` · `POST /api/privacy/delete-request` · purge | 0, 13 |
| `POST /api/evidence/eval` · `transfer` · research export | 15 |
| Match enqueue affinity headers | 10 |
| Health: `appCheck`, `sessionTrust`, `match`, `yjs`, `uploads`, `gemini` | 0, 17 |

---

## Reliability & research instrumentation

| Concern | Implementation |
|---------|----------------|
| Gemini resilience | Circuit breaker + budget alerts |
| Match multi-instance | Sticky affinity · DLQ · PubSub publisher + consumer |
| Collab durability | Yjs CRDT persist/restore (not metadata-only) |
| Upload integrity | Resumable chunks · MIME sniff · optional AV |
| Calibration science | MACE / Brier on Dashboard (not vanity %) |
| Transfer science | Delayed unassisted battery; `causalReady` gated |
| Chaos | Match/Yjs + Agent/Voice/Teacher/Offline spine harness |
| Release | `npm run release-gate` (lint + unit + audit) |

---

## §Z — Outside code (explicit non-omissions)

These are **documented intentionally** so they are never mistaken for missing features:

1. **Ops — App Check:** set `APP_CHECK_ENFORCE=true` + referrer-restricted web API key in production (`docs/APP_CHECK_AND_API_KEYS.md`).
2. **Ops — Match PubSub:** set `MATCH_PUBSUB_TOPIC` + `MATCH_PUBSUB_SUBSCRIPTION` + GCP ADC.
3. **Institutional — DPA:** counsel-signed DPA / subprocessor schedule (`docs/INSTITUTIONAL_GATES.md`, `docs/GDPR_FERPA_PLAYBOOK.md`).
4. **Institutional — WCAG:** independent keyboard/SR/contrast pass.
5. **Institutional — Efficacy:** no Bloom-2σ marketing until transfer + calibration gates clear.
6. **Ops — Incident readiness:** review `docs/INCIDENT_RUNBOOK.md` before prod cutover.

---

## Verification checklist (code spine)

```bash
curl -sS "$BASE/api/spine/adoption" | jq '.incomplete'   # expect []
npm test                                                  # vitest unit suite
npx tsc --noEmit
npm run release-gate                                      # staging/prod gate
npm run chaos:spine                                       # staging chaos
```

**Closeout statement:** On `cursor/platform-spine-3eed`, every surface 0–17 has zero incomplete spine stages. Remaining work is ops configuration and institutional sign-off only — not additional product feature scaffolding.
