# Security policy

## Reporting

Do not disclose suspected vulnerabilities in public issues. Report them
privately to the repository owner with reproduction steps, affected versions
and the minimum data required to confirm the issue. Do not include real student
records, credentials or API keys.

## Trust model

- Browser input, uploaded files, remote pages and AI output are untrusted.
- Firebase Authentication establishes user identity.
- The Express server verifies Firebase ID tokens before paid or data-processing
  API operations.
- Firestore Security Rules, not client-side UI roles, are the data authorization
  boundary.
- The Gemini API key is a server secret and must never be exposed through Vite
  environment variables or client bundles.

## Production deployment checklist

- [ ] Set `GEMINI_API_KEY`, `APP_URL` and the correct Firebase project ID.
- [ ] Keep `REQUIRE_API_AUTH` enabled.
- [ ] Deploy `firestore.rules` and test them with the Firebase emulator.
- [ ] Enable Firebase App Check and enforce it for supported products.
- [ ] Restrict the Firebase web API key by expected HTTP referrers and APIs.
- [ ] Terminate TLS before the Node process and redirect HTTP to HTTPS.
- [ ] Keep the default CSP; add origins narrowly when integrating new services.
- [x] Authenticate Yjs upgrades with Firebase ID token + room membership when
      `REQUIRE_API_AUTH=true` (see `yjsServer.ts`, `server/authz.ts`).
- [x] Platform content moderation spine (`POST /api/moderate`) shared by Match
      and Collab preflight.
- [x] Use cryptographically random invite-scoped room IDs and enforce Firestore
      participant membership.
- [ ] Define retention/deletion policy for Firestore, IndexedDB, local logs and
      AI conversation history.
- [ ] Review Google/Gemini data-processing terms for applicable GDPR, FERPA or
      institutional requirements.
- [ ] Run `npm ci`, `npm run check` and `npm audit` for every release.

## Implemented controls

- Firebase ID-token signature, issuer, audience and expiry verification
- Per-IP and per-user API rate limits
- Request and upload size limits
- Server-side PII redaction for common email, phone, SSN and card patterns
- SSRF controls with DNS/address checks, redirect limits, timeout and response
  size/content-type limits
- Security headers and CSP through Helmet
- Sanitization for notes HTML, bionic read mode and Mermaid SVG
- Bounded structured client error intake; no request-controlled file writes
- Firestore ownership/schema rules for tasks, courses, activity, documents,
  decks and flashcards
- Local adaptive profiling stores only coarse outcome/channel statistics, caps
  raw events at 500/90 days, excludes learning content and supports user reset

## Known limitations

- Authenticated UI roles are read from Firebase custom claims and default to
  `student`; assigning those claims still requires a trusted administrative
  process outside this browser repository.
- Collaboration metadata and Firestore data are membership-scoped, but live
  Yjs transport still uses public relay infrastructure.
- The PII detector is defense-in-depth, not a complete data-loss-prevention or
  named-entity-recognition system.
- Web clipper DNS validation reduces SSRF risk but should still run in an
  egress-restricted network for high-assurance deployments.
- Pyodide executes user-entered Python in the browser. Treat it as untrusted
  code and disable it through product policy where browser code execution is
  inappropriate.
