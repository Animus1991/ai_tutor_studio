# Comprehensive project audit — Memora (`ai_tutor_studio`)

**Date:** 2026-07-17  
**Branch tip:** `cursor/unified-repository-merge-3eed`  
**Method:** Full branch comparison, feature inventory, Google/Firebase gap analysis, safe-social upgrade.

## Branch completeness

| Branch | Relation to unified |
|--------|---------------------|
| `main` | Behind — no unique commits |
| `cursor/comprehensive-repository-upgrade-3eed` | Ancestor — superseded |
| `feat/content-pipeline-study-workspace` | Ancestor — superseded |
| **`cursor/unified-repository-merge-3eed`** | **Authoritative tip** |

## Implemented by prior + current agents

| Area | Status |
|------|--------|
| Firebase Google auth + demo sandbox | Live |
| Library / offline / PWA | Live |
| Agent (8 modes) + hybrid RAG | Live |
| Voice Tutor (Gemini STT/TTS) | Live |
| Teacher dashboard (Admin SDK) | Live (needs service account) |
| Collab (Yjs, Meet/Forms, overlay) | Live |
| Study Workspace tools | Live |
| Learning profile + mastery | Live |
| Responsive mobile/tablet shell | Live |
| Emergent feature port | Live (no Python/Mongo) |
| Study Circles + reports + kudos + guidelines | Live |
| Circle↔Collab ACL sync + email normalization | Live |
| `/api/library` + `/api/rag/*` + room-report triage | Live |
| Yjs room-id length/charset guard | Live |

## Google / Firebase — production checklist

| Requirement | Why |
|-------------|-----|
| `GEMINI_API_KEY` | All AI / Voice |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | Teacher classes/progress, library sync to Firestore, report triage |
| `REQUIRE_API_AUTH=true` + `VITE_REQUIRE_API_AUTH=true` | Enforce Bearer on API |
| Firebase Console: Google provider, authorized domains, OAuth redirect `/oauth/callback` | Sign-in + Forms/Meet |
| Deploy `firestore.rules` | Verified email + invite ACL + safe-social collections |
| `VITE_GOOGLE_CLIENT_ID` (or `firebase-applet-config.json` → `oAuthClientId`) | Workspace Forms/Meet popup OAuth |

## Removed / rejected

- Dead Emergent `appAuth.ts` / `EmailAuthPanel.tsx` (deleted)
- Public social feed / open DMs (rejected for student safety)

## Remaining residual risks (accepted / documented)

- Yjs is still trust-on-link (mitigated by long room ids + Firestore ACL for chat)
- Demo Contacts list is mock data (real invites use email allow-list)
- Contact suggestions do not scrape Google Contacts without explicit future consent scopes

## Safe social summary

See `SAFE_SOCIAL.md`. Invite-only Study Circles, in-room report + encouragement kudos, community guidelines gate, typing/reading presence — no stranger discovery.
