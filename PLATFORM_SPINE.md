# Platform Spine

Cross-cutting trust contracts that every Memora surface should use.

## Contracts

| Contract | Module | Purpose |
|----------|--------|---------|
| Firebase token verify | `server/firebaseToken.ts` | Shared by HTTP middleware + Yjs WS |
| AuthZ / room ACL | `server/authz.ts` | Membership, roles, Yjs→Firestore room mapping |
| Content moderation | `server/platformModeration.ts` + `matchModerator*` | Heuristics + optional Gemini |
| Yjs auth | `yjsServer.ts` | Token query param + room access evaluation |
| Deploy | `Dockerfile` | Ships `server/` + runs `dist/server.cjs` |

## API

`POST /api/moderate` — `{ text, kind?: chat\|notes\|goal\|collab\|agent\|upload_meta }`

## Yjs client

`WebsocketProvider(url, docName, doc, { params: { token } })` via `getCollabWsParams()`.

## Auth modes

| `REQUIRE_API_AUTH` | Yjs behavior |
|--------------------|--------------|
| `false` (preview/demo) | Anonymous allowed; token still validated when present |
| `true` (production) | Token required; Firestore room membership enforced when Admin SDK is configured |

## Surface adoption

- **Study Match** — uses platform moderation for chat/notes/goals
- **Collab** — Yjs token params + chat preflight via `/api/moderate`
- **Circles / Teacher / Agent** — import the same helpers as they harden
