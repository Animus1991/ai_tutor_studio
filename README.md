<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/078ff9fd-c704-40cd-a0ca-928a724dfbdb

## Run Locally

**Prerequisites:**  Node.js


- Node.js 20.19 or newer (Node.js 22 is used in CI)
- Java 21 or newer for Firestore Emulator rule tests
- A Firebase web project matching `firebase-applet-config.json`
- A Gemini API key

```bash
npm ci
cp .env.example .env.local
# Set GEMINI_API_KEY and APP_URL in .env.local
npm run dev
```

Open `http://localhost:3000` (or set `PORT=3010` in `.env.local`). API routes require a Firebase ID token by
default. For isolated local API experimentation only, authentication can be
disabled explicitly with `REQUIRE_API_AUTH=false`.

The login screen also offers **Continue in Demo Mode**. Demo mode persists on
the current device, uses local/offline data and never grants access to private
Firestore data. Paid/authenticated backend operations remain protected unless
the server is explicitly started with the development-only authentication
override.

## Quality commands

```bash
npm run lint          # TypeScript validation
npm test              # deterministic unit/security tests
npm run test:rules    # Firestore ownership/membership contracts
npm run test:coverage
npm run build
npm run audit
npm run check         # lint + tests + Firestore rules + production build
```

## Configuration

| Variable | Required | Purpose |
| --- | --- | --- |
| `GEMINI_API_KEY` | Yes | Server-side Gemini requests |
| `APP_URL` | Production | Exact browser origin accepted by CORS |
| `FIREBASE_PROJECT_ID` | No | Overrides the project ID used for token verification |
| `REQUIRE_API_AUTH` | No | Defaults to enabled; set `false` only for isolated development |
| `PORT` | No | HTTP port, default `3000` |
| `DISABLE_HMR` | No | Disables Vite file watching/HMR in constrained environments |

Never place `GEMINI_API_KEY` in client-side code or commit it to Git.
Firebase web configuration is public by design; production projects must
enforce Firestore rules, App Check and API-key referrer restrictions.

## Documentation

- [Architecture](ARCHITECTURE.md)
- [Security policy and deployment checklist](SECURITY.md)
- [Repository audit and upgrade plan](UPGRADE_PLAN.md)
- [Evidence-based product blueprint](PRODUCT_BLUEPRINT.md)
- [SUPERPROMPT implementation audit](SUPERPROMPT_IMPLEMENTATION_AUDIT.md)

The older `AGENT_RAG.md`, `ALGORITHMS.md`, `CONTENT_PIPELINE.md` and
`STUDY_WORKSPACE.md` describe a separate historical “Synapse Learning”
implementation and are retained only as design references, not as Memora API
documentation.
