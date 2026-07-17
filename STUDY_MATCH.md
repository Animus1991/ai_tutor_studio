# Study Match (Focus Buddy)

Time-boxed, topic-matched peer focus — **not** Omegle. Built for students on Memora’s safe-social model.

## Product rules

| Rule | Implementation |
|------|----------------|
| Same subject/topic | `topicKey` normalized from label; exact `durationMin` match (15/20/25/30) |
| Time-boxed session | Server sets authoritative `endsAt`; UI countdown + auto-end |
| Verified Google email | Firebase ID token + `email_verified` check on enqueue |
| Guidelines gate | Reuses `CommunityGuidelinesModal` / `safeSocial` |
| No camera by default | Chat + shared notes; whiteboard via existing Collab room |
| Meet dual consent | Both must `meet-consent` before `/meet` |
| Report / leave / ban | Report → mutual `matchBlocks` + session `reported`; leave ends without ban |
| No public profile / post-session DMs | Peer shown as `Buddy-####` only; no email exposure |
| Optional school domain | `domainFilter` (e.g. `uni.edu`) must match both emails |

## Architecture

```
Client (/match) → POST /api/match/enqueue → Server matchmaking
                      ↓
              matchQueue (Admin/memory, never listable by clients)
                      ↓ match
              matchSessions + rooms/{match-*} ACL
                      ↓
Client (/match/:id) chat/notes/timer/Meet consent
```

### API

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/match/enqueue` | Join/update queue; may return immediate match |
| DELETE | `/api/match/queue` | Cancel waiting |
| GET | `/api/match/status` | idle / waiting / matched (+ opportunistic rematch) |
| GET | `/api/match/session/:id` | Session view (no peer email) |
| POST | `.../leave` | End session |
| POST | `.../report` | Report + mutual block |
| POST | `.../meet-consent` | Toggle own Meet opt-in |
| POST | `.../meet` | Create Meet if both opted in |
| PATCH | `.../notes` | Shared scratchpad |
| POST | `.../message` | Session chat |

### Firestore (Admin-written)

- `matchQueue/{uid}` — client read own doc only
- `matchSessions/{id}` — members read; writes Admin-only
- `matchBlocks/{uidA::uidB}` — Admin-only
- `rooms/{match-*}` — standard Collab ACL for whiteboard

Deploy composite index in `firestore.indexes.json` for queue queries.

## Demo

`/?demo=1` → `/match` simulates a buddy after ~1.8s (sessionStorage). No stranger network.

## Ops

- Production: set `FIREBASE_SERVICE_ACCOUNT_JSON` for durable queue across instances.
- Without Admin SDK, in-process memory queue works for single-node preview.
- `REQUIRE_API_AUTH=true` recommended so only verified Bearer tokens enqueue.
