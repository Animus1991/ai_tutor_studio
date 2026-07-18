# GDPR / FERPA playbook (Memora)

Operational companion to `SECURITY.md` and `server/privacy.ts`.
Not legal advice — institutional counsel must review DPAs before production.

## Lawful basis (GDPR)

| Processing | Basis | Notes |
|------------|-------|-------|
| Account / auth | Contract + legitimate interest | Firebase Auth; verified email for peer surfaces |
| Pedagogy telemetry (xAPI, FSRS, mastery) | Legitimate interest / consent where required | 90-day retention; research export anonymized |
| AI tutoring (Gemini) | Contract + DPIA | No peer PII in prompts; PII redaction spine |
| Study Match / Circles | Consent (guidelines) + contract | Invite-only; dual Meet consent; no public profiles |
| Classroom roster sync | Explicit consent | `POST …/classroom/sync` requires `consent: true` |

## FERPA (US education)

- Memora class progress is **education records** when used by a school.
- Do **not** expose classmate emails/mastery to students (Institution spine redacts peer PII).
- Directory information: treat emails as non-directory unless school policy says otherwise.
- Instructor dashboards may show identifiable student rows; students see self + DP aggregates only.

## Subject rights

| Right | How |
|-------|-----|
| Access / portability | Settings → Server privacy export · Research export (`/api/research/export`) |
| Erasure | Settings → Request account deletion (`/api/privacy/delete-request`) |
| Restriction | Disable profiling in Settings; leave Match/Circles |
| Objection to AI | Institutional policy — disable Gemini key / Agent modes |

## Retention

| Store | Policy |
|-------|--------|
| xAPI (`userXapi`) | 90 days (`expireAt`); purge via `/api/admin/xapi/purge-expired` |
| Learning events | 90 days |
| Match sessions | No peer identity maps in exports |
| Offline packs | Local device; signed manifests |
| Break-glass / claims audit | `platform_audit` — keep per institutional policy (recommend ≥1 year) |

## DPIA triggers

Run / update a DPIA when enabling: Study Match, Circles, Voice transcripts, Classroom roster sync, or research exports at scale.

## DPA checklist

- [ ] Google Cloud / Firebase DPA signed
- [ ] Gemini / Google AI data processing terms reviewed
- [ ] Subprocessors listed for the institution
- [ ] `REQUIRE_API_AUTH=true` and App Check enforced in production
- [ ] Referrer-restricted API keys

## Break-glass roles

Custom claims changes that require `BREAK_GLASS_REQUIRED=true` need two distinct admins (`/api/admin/break-glass/*`).
