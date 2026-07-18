# Study Match (Focus Buddy)

Time-boxed peer focus — **not** Omegle. Built for students on Memora’s safe-social model.

Same subject is **preferred, not required**. You can match any verified study buddy on the same timer.

## Product rules

| Rule | Implementation |
|------|----------------|
| Topic preference | `flexibility: prefer_topic \| any_study`; scoring via `scoreMatchCandidate` |
| Exact timer | Same `durationMin` (15/20/25/30) required to pair |
| Time-boxed Pomodoro | Shared `pomodoro` state (focus/break cycles); authoritative `phaseEndsAt` |
| Presence | Heartbeat every ~8s; peer online indicator (20s window) |
| AI moderator | Heuristics + optional Gemini; rejects nude/sexual/dating/off-platform |
| Verified Google email | Firebase ID token + `email_verified` check on enqueue |
| Guidelines gate | Reuses `CommunityGuidelinesModal` / `safeSocial` |
| No camera by default | Chat + shared notes; whiteboard via Collab room |
| Meet dual consent | Both must `meet-consent` before `/meet` |
| Report / leave / ban | Report → mutual `matchBlocks` + session `reported`; leave ends without ban |
| No public profile / post-session DMs | Peer shown as `Buddy-####` only; no email exposure |
| Optional school domain | `domainFilter` (e.g. `uni.edu`) must match both emails |
| Learning-safe social | Vibe / energy / session intention · message reactions · private respect vote |
| Quiet focus | Per-user deep-work signal (visible to buddy, no DMs) |
| Notes integrity | Optimistic `notesVersion` concurrency |
| Midpoint check-in | One system nudge at halfway through each focus phase |
| Leave summary | Studied minutes returned — **never** peer identity |
| Report cooldown | 30′ rematch cooldown for both parties after a report |

## Learning-safe social signals

These are **session-scoped**, never a public feed or stranger DM graph:

- **Study vibe** — quiet / balanced / chatty (used in match scoring)
- **Energy** — focused / steady / low_energy
- **Session intention** — optional short goal (moderated)
- **Reactions** on peer messages — `helpful` · `focus` · `encourage`
- **Quiet focus** toggle
- **Private respect vote** on leave — stored on the session only, never a public score

## Architecture

```
Client (/match) → POST /api/match/enqueue → Server matchmaking (duration + score)
                      ↓
              matchQueue (Admin/memory, never listable by clients)
                      ↓ match
              matchSessions + rooms/{match-*} ACL
                      ↓
Client (/match/:id) chat/notes/timer/Meet consent + AI moderator
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
| PATCH | `.../notes` | Shared scratchpad (moderated) |
| POST | `.../message` | Session chat (AI + heuristic moderated) |
| POST | `.../react` | Toggle learning reaction on a peer message |
| POST | `.../respect` | Private post-session respect vote |
| POST | `.../heartbeat` | Presence ping |
| POST | `.../pomodoro` | `{ action: "start_break" \| "start_focus" }` |
| POST | `.../quiet-focus` | Toggle quiet focus signal |
| GET | `/api/match/metrics` | Anonymized ops counters (no PII) |

### Enqueue body (extras)

```json
{
  "topicLabel": "Organic Chem",
  "durationMin": 25,
  "flexibility": "prefer_topic",
  "vibe": "quiet",
  "energy": "steady",
  "sessionGoal": "Finish chapter 4 problems",
  "domainFilter": "uni.edu",
  "guidelinesAccepted": true
}
```

`topicLabel` may be empty when `flexibility` is `any_study`.

### Firestore (Admin-written)

- `matchQueue/{uid}` — client read own doc only
- `matchSessions/{id}` — members read; writes Admin-only
- `matchBlocks/{uidA::uidB}` — Admin-only
- `matchCooldowns/{uid}` — rematch cooldown after report
- `rooms/{match-*}` — standard Collab ACL for whiteboard

Deploy composite indexes in `firestore.indexes.json` for queue queries (`status + durationMin + createdAt`).

## Demo

`/?demo=1` → `/match` simulates a buddy after ~1.8s (sessionStorage). Client-side heuristics mirror the AI moderator. No stranger network.

## Ops

- Production: set `FIREBASE_SERVICE_ACCOUNT_JSON` for durable queue across instances.
- Optional Gemini key enables LLM second-pass moderation after heuristics.
- Without Admin SDK, in-process memory queue works for single-node preview.
- `REQUIRE_API_AUTH=true` recommended so only verified Bearer tokens enqueue.
