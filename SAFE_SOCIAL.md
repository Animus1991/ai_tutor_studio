# Student-safe social features (Memora)

Memora is a **learning product**, not a general social network. Peer features are invite-only, room-scoped, and reportable.

## Principles

1. **Learning purpose only** — study circles declare `purpose: "learning"`.
2. **Invite-only** — no public discovery feed, no stranger DMs.
3. **Verified email** — Firestore collaboration requires `email_verified`; emails stored/compared lowercased.
4. **Reportable** — in-room messages can be reported (`harassment|hate|spam|off_topic|privacy|other`).
5. **Encouragement ≠ vanity metrics** — kudos are enum-only (`helpful|clarify|encourage`), rate-limited client-side.
6. **Guidelines gate** — Community Guidelines modal before Collab use (local acknowledgement).
7. **Owner-managed invites** — only circle/room owners expand `memberEmails`.

## Surfaces

| Feature | Path / collection | Who can access |
|---------|-------------------|----------------|
| Study Circles | `/circles`, `studyCircles/{id}` | Members listed in `memberEmails` |
| Linked Collab room | `/collab?room=circle-{id}`, `rooms/{id}` | Same allow-list (kept in sync on create/invite) |
| Message reports | `rooms/{id}/reports` | Create by members; read via Admin SDK `GET /api/admin/room-reports` |
| Kudos | `rooms/{id}/kudos` | Members of room |
| Presence activity | Yjs awareness | Room peers only (doc id ≥ 8 chars enforced server-side) |

## Explicitly **not** shipped

- Open public feeds or profiles
- 1:1 DMs outside rooms
- Follower graphs / likes farming
- Location sharing / contact scraping without consent

## Ops notes

- Triage reports: `GET /api/admin/room-reports?roomId=...` (requires `FIREBASE_SERVICE_ACCOUNT_JSON`).
- Teacher classes remain Admin-SDK only.
- Yjs WebSocket is still trust-on-room-id — treat room links as secrets; prefer invite + verified email ACL for Firestore chat/CRDT.
- Deploy updated `firestore.rules` after pull.
