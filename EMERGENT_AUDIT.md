# Emergent Repository Audit (`Animus1991/ai_tutor_emergent`)

**Audit date:** 2026-07-17  
**Compared against:** `Animus1991/ai_tutor_studio` (`cursor/unified-repository-merge-3eed`)

## Executive summary

`ai_tutor_emergent` is an earlier variant of the same Memora AI Tutor product. Its **frontend** is ~95% byte-identical to studio; the meaningful delta is a **Python/FastAPI + MongoDB backend** with Emergent-specific auth and a handful of UI features. Studio is the authoritative, production-oriented fork with Firebase, Firestore security rules, Express SSR, Google integrations, and hardened CI.

This pass **ported the valuable Emergent-only features** into studio using studio conventions (Firebase Bearer auth, Gemini APIs, Firestore Admin SDK) and **did not port** insecure or redundant Emergent subsystems.

## Branch landscape (emergent)

| Branch | Status |
|--------|--------|
| `main` | Only branch (~299 files). Latest: `a0b4eb6` |

No additional feature branches were found in the public repository.

## Architecture comparison

| Layer | Emergent | Studio (target) |
|-------|----------|-----------------|
| API server | Python FastAPI + MongoDB | Express (`server.ts`) + optional Firestore Admin |
| Auth | JWT cookies, Emergent OAuth, email/password (`appAuth.ts`) | Firebase Google sign-in + Bearer tokens |
| AI | OpenAI Whisper/TTS via Emergent Universal Key | Google Gemini (`GEMINI_API_KEY`) |
| Data | MongoDB collections | Firestore + local IndexedDB |
| Security | Unauthenticated AI in places, hardcoded admin password, no Firestore rules | `firestore.rules`, rate limits, SSRF guards, `REQUIRE_API_AUTH` |
| Collab | Yjs + `CollabOverlay` (cursors + sticky notes) | Yjs + y-fire + Google Meet/Forms; overlay now merged |
| CI / deploy | Minimal | GitHub Actions, rules tests, Playwright e2e |

## File overlap

Of 267 comparable frontend source files, **253 are byte-identical** between emergent `frontend/src` and studio `src`. Emergent-only or divergent frontend additions:

| Feature | Emergent paths | Studio action |
|---------|----------------|---------------|
| Voice Tutor UI | `pages/VoiceTutor.tsx` | **Merged** — route `/voice`, Gemini `/api/transcribe`, `/api/tts` |
| Teacher dashboard | `pages/Teacher.tsx`, `lib/teacher.ts` | **Merged** — route `/teacher`, Firestore-backed `/api/classes/*`, `/api/progress` |
| Collab overlay | `components/collab/CollabOverlay.tsx` | **Merged** — wired in `CollabRoom.tsx` |
| Emergent auth | `lib/appAuth.ts`, `EmailAuthPanel.tsx` | **Not merged** — conflicts with Firebase; files retained unused |
| Library sync | `lib/serverSync.ts` (cookie JWT) | **Adapted** — progress reporting uses `apiRequest` + Firebase Bearer |
| Python teacher API | `backend/teacher.py` | **Reimplemented** in `server/teacher.ts` via Firestore Admin |

## Security findings (emergent — do not port)

1. **Cookie/JWT session auth** with `emailVerified: true` bypass in `appAuth.ts`
2. **Unauthenticated or weakly gated AI routes** on the Python backend
3. **Hardcoded admin credentials** in emergent test reports
4. **No Firestore rules** — all data on MongoDB with app-level checks only
5. **Emergent OAuth** (`X-Session-ID`) — vendor-specific, not portable

Studio keeps Firebase as the sole identity provider. Class/progress data is written only through authenticated Express routes using the Firebase Admin SDK (client Firestore rules remain deny-by-default for `classes` / `studentProgress`).

## Features merged in this upgrade

### 1. Voice Tutor (`/voice`)

- **UI:** `src/pages/VoiceTutor.tsx` (from emergent, unchanged UX)
- **STT:** `POST /api/transcribe` — Gemini multimodal transcription
- **TTS:** `POST /api/tts` — Gemini preview TTS when available; browser `speechSynthesis` fallback
- **Client:** `transcribeAudio` / `synthesizeSpeech` in `src/lib/api.ts` via `apiRequest`

### 2. Teacher dashboard (`/teacher`)

- **UI:** `src/pages/Teacher.tsx`
- **API:** `server/teacher.ts` — create/list/join classes, class detail, progress snapshots
- **Storage:** Firestore collections `classes`, `classes/{id}/members`, `users/{uid}/classMemberships`, `studentProgress`
- **Auth:** Firebase Bearer on all `/api/classes*` and `/api/progress` routes
- **Nav:** Visible for `instructor` / `admin` roles in `Layout.tsx`

### 3. Collab overlay

- `CollabOverlay.tsx` renders live cursors + shared Yjs sticky notes atop the collab video/whiteboard area

### 4. Progress reporting

- `serverSync.reportProgressSnapshot()` posts to `/api/progress` with Firebase auth (teacher roster aggregation)

## Configuration required

| Variable | Purpose |
|----------|---------|
| `GEMINI_API_KEY` | Transcription, TTS, all AI routes |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | Teacher dashboard (classes + progress) |
| `REQUIRE_API_AUTH=true` | Enforce Firebase auth on protected API routes (recommended production) |

## Verification

```bash
npm run lint    # 0 errors
npm test        # 100 unit tests
npm run build   # client + server bundle
```

## Recommendations

1. **Delete or gate** unused `appAuth.ts` / `EmailAuthPanel.tsx` if not planning dual auth
2. **Wire `startLibrarySync()`** from auth bootstrap when `/api/library` is implemented server-side
3. **Add Playwright coverage** for `/voice` and `/teacher` smoke paths
4. **Firestore composite index** if class list grows large (current design uses per-user `classMemberships` subcollection to avoid collection-group indexes)

## Conclusion

`ai_tutor_studio` on `cursor/unified-repository-merge-3eed` now **supersedes** `ai_tutor_emergent` for all user-facing capabilities while retaining studio's security and Google/Firebase stack. The emergent Python backend and Emergent OAuth layer should be considered **deprecated** for this product line.
