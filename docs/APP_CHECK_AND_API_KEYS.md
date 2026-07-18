# App Check enforce + referrer-restricted API keys

Operational runbook for production trust spine. Companion to `SECURITY.md`.

## App Check (reCAPTCHA v3)

### Env

| Variable | Where | Purpose |
|----------|--------|---------|
| `VITE_APPCHECK_SITE_KEY` | Client build | reCAPTCHA v3 site key → `initializeAppCheck` |
| `VITE_APPCHECK_DEBUG_TOKEN` | Client (dev) | Optional debug token; DEV defaults to `true` |
| `APP_CHECK_ENFORCE=true` | Server | Reject `/api/*` without valid `X-Firebase-AppCheck` |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | Server | Required for `verifyToken` when enforcing |

### Rollout

1. Firebase Console → **App Check** → register web app → reCAPTCHA v3 → copy site key.
2. Build frontend with `VITE_APPCHECK_SITE_KEY=<site-key>`.
3. Deploy with Admin SDK JSON; leave `APP_CHECK_ENFORCE` unset (soft mode) and confirm tokens in Network → `X-Firebase-AppCheck`.
4. Set `APP_CHECK_ENFORCE=true` in production.
5. Confirm CSP allows reCAPTCHA scripts (`www.google.com`, `www.gstatic.com`) — shipped in Helmet CSP.

### Soft vs enforce

- Soft (default): missing/invalid tokens are ignored so demos/previews keep working.
- Enforce: missing → `401 App Check token required`; invalid → `401`; no Admin SDK → `503`.

Health: `GET /api/health` includes `appCheck: { enforce, adminReady }`.

## Referrer-restricted Firebase / Google API keys

Browser keys in `firebase-applet-config.json` / Google Cloud Credentials must **not** be unrestricted in production.

### Firebase Web API key

1. Google Cloud Console → **APIs & Services** → **Credentials** → Browser key used by the Firebase web app.
2. **Application restrictions** → HTTP referrers → add only:
   - `https://your-production-domain.com/*`
   - `https://*.your-production-domain.com/*`
   - (optional staging) `https://staging.example.com/*`
   - Local: `http://localhost:3000/*`, `http://localhost:3010/*`, `http://127.0.0.1:3000/*`
3. **API restrictions** → Restrict key → enable only APIs the client calls, typically:
   - Identity Toolkit API
   - Token Service API
   - Firebase Installations API
   - (if used) Cloud Firestore API from client
4. Do **not** put `GEMINI_API_KEY` or service-account JSON in Vite/`VITE_*` vars.

### OAuth client (Google Workspace popup)

1. Credentials → OAuth 2.0 Client ID (Web).
2. Authorized JavaScript origins: production origin + localhost ports used in dev.
3. Authorized redirect URIs: `https://your-domain/oauth/callback` (+ local equivalents).

### Checklist before `REQUIRE_API_AUTH=true` + App Check enforce

- [ ] App Check site key in production build
- [ ] `APP_CHECK_ENFORCE=true`
- [ ] Admin SDK JSON present
- [ ] Browser API key referrer-restricted
- [ ] OAuth origins/redirects match deploy URL
- [ ] Yjs auth required (`REQUIRE_API_AUTH`)
- [ ] Smoke: signed-in client can call `/api/health` and a Bearer route
