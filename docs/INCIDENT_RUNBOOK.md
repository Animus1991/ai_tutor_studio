# Incident runbook (Memora spine)

Short ops playbook for critical paths. Not a substitute for on-call tooling.

## 1. Auth / App Check outage

Symptoms: spike of `401` / `403` on `/api/*`, App Check mode `enforce_unavailable`.

1. Check `GET /api/health` → `appCheck`, `sessionTrust`
2. Confirm `FIREBASE_SERVICE_ACCOUNT_JSON` and App Check debug/enforce config
3. Temporary soften only with change control: `APP_CHECK_ENFORCE=false` (never leave on in prod)
4. Audit: `platform_audit` / Admin export for failed principals

## 2. Match queue / multi-instance

Symptoms: users stuck `waiting`, affinity `409`, DLQ growth.

1. `GET /api/health/match` → `mode`, `bus.published`, `pubsub.started`, `dlqSize`
2. Confirm `INSTANCE_ID` / `MATCH_STICKY` / `MATCH_PUBSUB_TOPIC` + subscription
3. Drain DLQ (`matchQueueDlq`) after root-cause; do not re-pair without consent
4. Chaos: `npm run chaos:match` against staging

## 3. Yjs / Collab

Symptoms: blank boards, reconnect loops.

1. `GET /api/health/yjs` → `docs`, `withPayload`, `durableRoot`
2. Confirm WS path `/yjs/*` and auth when `REQUIRE_API_AUTH=true`
3. Compaction: `POST /api/admin/yjs/compact` (admin)
4. Snapshots live under `data/yjs-snapshots/` (file) + optional Firestore metadata

## 4. Gemini / Agent / Voice

Symptoms: `503`, open circuit, Agent `X-Agent-Budget-Ok: 0`.

1. `GET /api/health` → `gemini`, `circuitAlerts`, `agent`
2. Verify `GEMINI_API_KEY`; watch quota alerts
3. Agent budgets: `AGENT_MAX_LATENCY_MS` / `AGENT_MAX_MESSAGES` / `AGENT_MAX_CHARS`
4. Voice: session revoke must kill mic (`memora:session-revoked`)

## 5. Privacy purge / legal hold

Symptoms: deletion requests stuck `queued` / `legal_hold`.

1. `POST /api/admin/privacy/purge` (admin) or cron with `X-Purge-Key`
2. Legal hold: clear `legalHold` on `privacyDeletionRequests` only with counsel approval
3. Confirm xAPI TTL + Yjs compaction ran (`PurgeResult` in response)

## 6. Release gate before promote

```bash
npm run release-gate
BASE_URL=https://staging.example npm run chaos:spine
```

Do not claim institutional readiness until `docs/INSTITUTIONAL_GATES.md` checkboxes are signed.
