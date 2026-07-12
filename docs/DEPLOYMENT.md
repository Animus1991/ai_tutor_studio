# Deployment Guide

Memora runs as a single Node process: Express serves the Vite-built SPA, API routes, and the Yjs WebSocket at `/yjs`.

## Prerequisites

- Node 22+ (local) or Docker
- `GEMINI_API_KEY` for AI features
- Firebase project configured (`firebase-applet-config.json`) for auth/sync

## Local production smoke test

```bash
cp .env.local.example .env.local
# Fill GEMINI_API_KEY

npm ci
npm run build
npm start
```

Open `http://localhost:3010/?demo=1`. Production uses `tsx server.ts` (serves built `dist/` SPA).

If `EADDRINUSE` on port 3010, stop the dev server (`Ctrl+C` on `npm run dev`) or use another port:

```bash
cross-env PORT=3011 npm start
```

## Docker

```bash
docker build -t memora-ai-tutor .
docker run -p 3010:3010 \
  -v memora-data:/app/data \
  -e GEMINI_API_KEY=your_key \
  -e NODE_ENV=production \
  -e PORT=3010 \
  memora-ai-tutor
```

The Dockerfile runs `npm ci` once for the build and a lighter `npm ci --omit=dev` for runtime (with `tsx`). If the build fails with `rpc error: code = Unavailable` after a long `npm ci`, restart Docker Desktop and retry — that usually indicates the daemon ran out of memory or timed out, not an app bug.

## Cloud platforms

### Railway

Connect repo → Railway reads `railway.toml` and builds via Dockerfile. Set secrets: `GEMINI_API_KEY`, optional `FIREBASE_SERVICE_ACCOUNT_JSON`.

### Fly.io

```bash
fly launch --no-deploy
fly secrets set GEMINI_API_KEY=...
fly volumes create memora_data --size 1
fly deploy
```

Uses `fly.toml` with `/app/data` volume for persistent audit logs.

### Google Cloud Run

```bash
gcloud builds submit --config cloudbuild.yaml
```

Configure Secret Manager for `GEMINI_API_KEY` and `FIREBASE_SERVICE_ACCOUNT_JSON`.

## Environment variables

| Variable | Required | Notes |
|----------|----------|-------|
| `GEMINI_API_KEY` | Yes (AI) | Agent, OCR, embeddings |
| `PORT` | No | Default `3010` |
| `NODE_ENV` | Prod | Set to `production` for static SPA |
| `AUDIT_STORE_PATH` | No | Default `data/audit-log.jsonl` |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | No | Platform audit + tenant admin metrics |
| `XAPI_LRS_ENDPOINT` | No | xAPI forwarding |
| `XAPI_LRS_KEY` | No | LRS basic auth key |
| `VITE_YJS_WS_URL` | No | Override collab WebSocket URL |

## CI / release checklist

1. `npm run lint`
2. `npm run test`
3. `npm run test:e2e` (dev server)
4. `npm run test:e2e:prod` (production build + server)
5. `npm run build`
6. Deploy container or run `node dist/server.cjs` behind HTTPS reverse proxy

## Firebase

- Add production domain to Firebase Auth authorized domains
- Deploy rules: `firebase deploy --only firestore:rules`
- Indexes: `firebase deploy --only firestore:indexes`

## Notes

- PWA service worker registers in production builds only
- Yjs collab uses `ws(s)://your-host/yjs` — ensure your proxy supports WebSocket upgrade
- Audit logs persist to `AUDIT_STORE_PATH` (JSONL). Optional Firestore sync to `platform_audit` when `FIREBASE_SERVICE_ACCOUNT_JSON` is set.
