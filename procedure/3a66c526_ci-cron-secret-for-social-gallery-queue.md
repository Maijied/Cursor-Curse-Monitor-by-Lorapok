# CI CRON_SECRET for social gallery queue

**Procedure ID:** `3a66c526`  
**Status:** in_progress  
**Created:** 2026-09-17  
**Plan:** _none_  
**Issue:** [#274](https://github.com/Maijied/Cursor-Curse-Monitor-by-Lorapok/issues/274)  
**Branch:** `fix/ci-social-gallery-cron-secret`  
**PR:** [#275](https://github.com/Maijied/Cursor-Curse-Monitor-by-Lorapok/pull/275)

---

## Objective

CI CRON_SECRET for social gallery queue

---

## Progress

- [x] Plan approved
- [x] Procedure + GitHub issue created
- [x] Implementation started — dedicated `queue-social-gallery` job with `admin-production`
- [x] Tests passing — `tests/test_queue_social_gallery.mjs`
- [x] PR opened
- [ ] Review triaged
- [ ] Merged
- [ ] Post-merge verification

---

## Decisions

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-09-17 | Procedure opened | Task tracking started |
| 2026-09-18 | Separate job with `environment: admin-production` | Marketplace `deploy` job has no env secrets; `CRON_SECRET` / cred vault live only in admin-production |

---

## Blockers

_None._

---

## Verification

| Tier | Check | Result |
|------|-------|--------|
| A | Headless tests | pending |
| B | Component matrix | pending |
| C | Production smoke | pending |

---

## Retrospective

_Filled on merge via `scripts/procedure-finalize-pr.mjs` or CI workflow._
