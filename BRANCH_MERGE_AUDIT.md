# Branch Merge Audit (2026-07-15)

## Branches compared

| Branch | Files | Latest commit | Assessment |
|--------|------:|---------------|------------|
| `main` | 271 | `307b502` infrastructure refactor | Strong base + deployment tooling |
| `feat/content-pipeline-study-workspace` | 275 | `4453bd0` | **Most complete feature set** — merged `main` + cursor cherry-picks + Study Workspace |
| `cursor/comprehensive-repository-upgrade-3eed` | 149 | `e212c70` | Strong security/docs/tests but removed many Google/workspace features |

## Selected base: `feat/content-pipeline-study-workspace`

Reasons:
- Contains the full Study Workspace module (20+ panels), Google OAuth consent, Classroom/Tasks/Workspace services, deployment configs (Docker, Fly, Railway), and E2E Playwright tests.
- Already integrated adaptive learning profile, multimodal ingestion, and demo-mode fixes from the cursor branch.
- Latest `main` infrastructure refactor is merged.

## Merged from `cursor/comprehensive-repository-upgrade-3eed`

| Artifact | Purpose |
|----------|---------|
| `SECURITY.md` | Security checklist and deployment guidance |
| `firestore.rules` (strict) | Email verification, room membership, schema validation |
| `firestore.rules.test.ts` | Rules unit tests (email verify, room ACL) |
| `src/test/*.test.ts` | apiErrors, authStore, bm25, localTasks, piiSanitizer, vectorStore |
| `public/icons/memora.svg` | PWA icon asset |
| CI hardening | Java 21, `npm audit`, concurrency controls |
| Collab room security | `ownerId`/`memberEmails`, secure room IDs, WebRTC merge fix |

## Security findings

| Finding | Severity | Resolution |
|---------|----------|------------|
| `isVerified() { return true; }` in feat rules | **High** | Replaced with `email_verified == true` |
| Open collab rooms (any signed-in user) | **Medium** | Membership-based `hasRoomAccess()` |
| Firebase web API key in `firebase-applet-config.json` | **Low (expected)** | Client-side public key; restrict via Firebase console (App Check, referrer rules) |
| No leaked Gemini/service-account keys in git history | — | Verified via `git log -S` |
| `npm audit --omit=dev` | — | 0 moderate+ vulnerabilities |

## Google tools preserved

- Google Sign-In (Firebase Auth)
- Google OAuth consent modal + scoped access (`useGoogleOAuth`, `googleScopes`)
- Google Classroom import (`classroomService`)
- Google Tasks (`GoogleTasksService`)
- Google Workspace (`GoogleWorkspaceService`)
- Google Meet API (`/api/google/meet`)
- Gemini AI (server-side only via `GEMINI_API_KEY`)

## Unified branch

`cursor/unified-repository-merge-3eed` — superset of all three branches with security hardening applied.
