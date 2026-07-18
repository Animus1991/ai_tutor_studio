# Institutional readiness gates (DPA · WCAG · efficacy)

These gates sit **outside** the code spine. Shipping UI polish without them does not mark a surface `complete` for institutional deployment.

## 1. DPA / GDPR-FERPA ops

Checklist (counsel must sign):

- [ ] Data Processing Agreement with hosting / AI subprocessors
- [ ] Retention schedule matches `docs/GDPR_FERPA_PLAYBOOK.md` (xAPI 90d, packs 90d, purge drain)
- [ ] Subject rights path tested: `GET /api/privacy/export` · `POST /api/privacy/delete-request` · `POST /api/admin/privacy/purge`
- [ ] No peer PII in research export (`GET /api/research/export`)
- [ ] Demo `@example.com` / `@demo.local` never written to room ACL

CI/ops gate: release notes must link the signed DPA ticket ID before enabling `REQUIRE_API_AUTH=true` + `APP_CHECK_ENFORCE=true` in production.

## 2. WCAG accessibility gate

Target: WCAG 2.2 AA for keyboard, contrast, and live status.

Code already ships:

- Skip link · `dir` / RTL-ready · focus traps on Settings, OAuth, Guidelines, Confirm, Agent mode, mobile nav
- Live regions recommended for Match/Voice status strings (`a11y.liveStatus` catalog key)

Independent gate (not auto-passable in CI alone):

- [ ] Manual keyboard pass on `/`, `/tasks`, `/agent`, `/match`, `/voice`, `/circles`
- [ ] Screen-reader spot check (Voice status + Match buddy label Buddy-####)
- [ ] Contrast audit on indigo primary vs white / slate dark

## 3. Learning efficacy gate

Memora does **not** claim Bloom 2σ. Before marketing efficacy:

- [ ] Golden-question harness green (`POST /api/evidence/eval`)
- [ ] Transfer battery reviewed (`POST /api/evidence/transfer`) — `causalReady` only after delayed unassisted N
- [ ] Calibration MACE/Brier reported on Dashboard (not vanity completion %)
- [ ] Active-control or at least pre-registered A/B plan for Match scoring weights
- [ ] No VARK / learning-styles meshing in product copy

## 4. Production trust enforce

- [ ] `APP_CHECK_ENFORCE=true` after staging token validation (`docs/APP_CHECK_AND_API_KEYS.md`)
- [ ] Referrer-restricted Firebase web API key
- [ ] `BREAK_GLASS_REQUIRED=true` for role elevation
- [ ] `npm run release-gate` (lint + unit + audit) and staging `npm run chaos:spine`
