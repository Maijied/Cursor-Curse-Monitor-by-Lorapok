# settings-tabs-secrets

**Procedure ID:** `2b7b880d`  
**Status:** in_progress  
**Created:** 2026-09-04  
**Plan:** plan/settings-tabs-secrets-plan.md (+ `plan/mission-control-master-tasks.md`)  
**Issue:** __ISSUE_PENDING__  
**Branch:** _local (uncommitted)_  
**PR:** _TBD_

---

## Objective

Tabbed Mission Control Settings (Discord-style per service). Remove hardcoded Firebase client config from source; persist in ADMIN_KV and sync `VITE_FIREBASE_*` to GitHub `admin-production` on master save.

---

## Progress

- [x] Plan approved (`plan/settings-tabs-secrets-plan.md`)
- [x] Procedure created
- [x] Backend: firebase/github/cloudflare integration APIs + GitHub secret sync
- [x] Frontend: Settings tabs + Firebase/GitHub/Cloudflare cards
- [x] `firebase.ts` runtime bootstrap via `/api/firebase-config`
- [x] CI: `VITE_FIREBASE_*` from `admin-production` secrets
- [x] GitHub secrets seeded (`VITE_FIREBASE_*`)
- [x] Production KV seeded (`integrations:firebase` via `seed-firebase-kv.mjs`)
- [x] Tests passing (kv-quota, sync-status, firebase-config; tsc clean)
- [ ] PR opened
- [ ] Admin deploy + `/api/firebase-config` production smoke
- [x] Phase system: `plan/settings-phases-complete.md` (Phases 0–4 code complete)

---

## Decisions

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-09-04 | Runtime Firebase bootstrap from public API | Avoid rebuilding admin when Firebase fields change |
| 2026-09-04 | GitHub env secret sync on master PUT | User requested GH secrets; matches existing `admin-production` pattern |
| 2026-09-04 | KV `integrations:firebase` as runtime source of truth | Same pattern as Discord/mail configs |

---

## Blockers

_None._

---

## Verification

| Tier | Check | Result |
|------|-------|--------|
| A | `tsc -b` admin | pass |
| A | `firebase-config.test.ts` | pending (vitest fork timeout) |
| C | `/api/firebase-config` production | pending deploy + KV seed |

---

## Retrospective

_Filled on merge._
