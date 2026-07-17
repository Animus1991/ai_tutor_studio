# Student-safe social features (Memora)

Memora is a **learning product**, not a general social network. Peer features are invite-only, room-scoped, and reportable.

## Principles

1. **Learning purpose only** — study circles declare `purpose: "learning"`.
2. **Invite-only** — no public discovery feed, no stranger DMs.
3. **Verified email** — Firestore collaboration requires `email_verified`; emails stored/compared lowercased.
4. **Reportable** — in-room messages can be reported (`harassment|hate|spam|off_topic|privacy|other`).
5. **Encouragement ≠ vanity metrics** — kudos are enum-only (`helpful|clarify|encourage`), rate-limited client-side.
6. **Guidelines gate** — Community Guidelines modal before Circles / Collab / Match (versioned re-accept).
7. **Owner-managed invites** — only circle/room owners expand `memberEmails`.
8. **Dual Meet consent** — Match and Collab require ≥2 opt-ins before Meet URL creation.
9. **Unified policy** — `src/lib/socialPolicy.ts` + `server/socialPolicy.ts` capability matrix + triage taxonomy.

## Surfaces

| Feature | Path / collection | Who can access |
|---------|-------------------|----------------|
| Study Circles | `/circles`, `studyCircles/{id}` | Members listed in `memberEmails` |
| Linked Collab room | `/collab?room=circle-{id}`, `rooms/{id}` | Same allow-list (kept in sync on create/invite) |
| Circle → Match bridge | `/match?topic=…&from=circle` | Same Match safety envelope |
| Message reports | `rooms/{id}/reports` + `platformSocialReports` | Create by members; triage via Admin |
| Kudos | `rooms/{id}/kudos` | Members of room |
| Presence activity | Yjs awareness | Room peers only (doc id ≥ 8 chars enforced server-side) |
| Study Match | `/match`, `matchQueue` / `matchSessions` | Duration-matched buddies; AI moderator; dual Meet consent; report blocks rematch |
| Board text | Whiteboard sticky notes | Moderated via `/api/moderate` kind `board` |

## Explicitly **not** shipped

- Open public feeds or profiles
- 1:1 DMs outside rooms
- Follower graphs / likes farming
- Location sharing / contact scraping without consent
- Public reputation scoreboards (respect votes & kudos stay private / room-scoped)

## Ops notes

- Unified reports: `POST /api/social/report` · triage `GET/PATCH /api/admin/social-reports` (Admin UI section).
- Per-room: `GET /api/admin/room-reports?roomId=...` (requires `FIREBASE_SERVICE_ACCOUNT_JSON`).
- Room Meet: `POST /api/social/rooms/:roomId/meet-consent` · `POST /api/social/rooms/:roomId/meet`.
- Teacher classes remain Admin-SDK only.
- Yjs WebSocket authenticates when `REQUIRE_API_AUTH=true` (token + room membership).
- Deploy updated `firestore.rules` after pull (`meetConsent` / `meetUrl` allowed on rooms).
