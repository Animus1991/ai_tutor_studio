# Studio Branch Audit (`Animus1991/ai_tutor_studio`)

**Audit date:** 2026-07-17  
**Working tip:** `cursor/unified-repository-merge-3eed` @ `9127229` (+ mobile/Firebase follow-ups)

## Branch hierarchy

```
feat/content-pipeline-study-workspace (4453bd0)
  └─ cursor/comprehensive-repository-upgrade-3eed (88ae6f7)
       └─ … merged to main …
            └─ origin/main (d2a28d4)
                 └─ cursor/unified-repository-merge-3eed (MOST COMPLETE)
```

| Branch | Tip | Unique commits vs unified |
|--------|-----|---------------------------|
| `origin/main` | d2a28d4 | **0** (unified is ahead by 3) |
| `origin/cursor/comprehensive-…` | 88ae6f7 | **0** |
| `origin/feat/content-pipeline-…` | 4453bd0 | **0** |
| `origin/cursor/unified-…` | latest | — |

**Verdict:** Unified is a strict superset of every other remote branch. No feature commits remain only on older branches.

## What each lineage contributed

| Layer | Contents |
|-------|----------|
| feat/content-pipeline | Study Workspace, content pipeline, hybrid RAG, learning profile, demo sandbox |
| comprehensive | Strict Firestore rules, room ACLs, SECURITY.md, rules tests |
| main | Gemini vision occlusion, mastery dashboard wiring |
| unified | Voice Tutor, Teacher API, CollabOverlay, EMERGENT_AUDIT + **mobile discoverability fixes** |

## Why mobile preview showed “no change”

Root cause was **discovery**, not missing merges:

1. Mobile bottom nav only listed Home / Library / Tasks / Agent — **no Voice**
2. Hamburger drawer only had Settings — **no navItems**
3. Demo role defaulted to `student` → Teacher/Admin links hidden
4. Teacher page gated on Firebase user → empty screen in demo
5. Role selector was `hidden sm:flex` — invisible on phones

**Fixed in this pass:** bottom nav includes Voice + More; More drawer lists all pages + role switcher; demo defaults to `instructor` with Teacher mock data; Firebase claim roles applied on sign-in; Google OAuth client ID falls back to `firebase-applet-config.json`; auth middleware parses Bearer even when `REQUIRE_API_AUTH` is false.

## Google / Firebase status

| Area | Status |
|------|--------|
| Firebase Google sign-in | Working (config in `firebase-applet-config.json`) |
| Custom claim → UI role | Wired via `setClaimRole` on auth success |
| Forms / Meet OAuth | Client ID from `VITE_GOOGLE_CLIENT_ID` or config `oAuthClientId` |
| Teacher classes/progress | Firestore Admin (`FIREBASE_SERVICE_ACCOUNT_JSON`) |
| Voice STT/TTS | Gemini (`GEMINI_API_KEY`) — AI fails without key |
| Firestore rules | Default-deny for classes (Admin SDK only) — intentional |

## Remaining optional work

- Implement `/api/library` or remove unused `startLibrarySync`
- Delete dead `appAuth.ts` / `EmailAuthPanel.tsx`
- Production deploy (Railway / Fly / Cloud Run) for a stable public URL
- Set `GEMINI_API_KEY` + Admin JSON for full AI + Teacher live data

## Preview (mobile)

After rebuild, open with demo flag so new surfaces are visible:

`https://<tunnel>/?demo=1`
