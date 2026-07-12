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
NODE_ENV=production npm start
```

Open `http://localhost:3010/?demo=1`.

## Docker

```bash
docker build -t memora-ai-tutor .
docker run -p 3010:3010 \
  -e GEMINI_API_KEY=your_key \
  -e NODE_ENV=production \
  -e PORT=3010 \
  memora-ai-tutor
```

## Environment variables

| Variable | Required | Notes |
|----------|----------|-------|
| `GEMINI_API_KEY` | Yes (AI) | Agent, OCR, embeddings |
| `PORT` | No | Default `3010` |
| `NODE_ENV` | Prod | Set to `production` for static SPA |
| `XAPI_LRS_ENDPOINT` | No | xAPI forwarding |
| `XAPI_LRS_KEY` | No | LRS basic auth key |
| `VITE_YJS_WS_URL` | No | Override collab WebSocket URL |

## CI / release checklist

1. `npm run lint`
2. `npm run test`
3. `npm run test:e2e` (optional, needs dev server)
4. `npm run build`
5. Deploy container or run `node dist/server.cjs` behind HTTPS reverse proxy

## Firebase

- Add production domain to Firebase Auth authorized domains
- Deploy rules: `firebase deploy --only firestore:rules`
- Indexes: `firebase deploy --only firestore:indexes`

## Notes

- PWA service worker registers in production builds only
- Yjs collab uses `ws(s)://your-host/yjs` — ensure your proxy supports WebSocket upgrade
- Audit logs on the server are in-memory (ring buffer); restart clears them. Client localStorage retains a copy.
