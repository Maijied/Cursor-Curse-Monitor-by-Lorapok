# discord-deploy-sync-stat-service

**Procedure ID:** `53756e07`  
**Status:** in_progress  
**Created:** 2026-09-11  
**Plan:** _none_  
**Issue:** __ISSUE_PENDING__  
**Branch:** `fix/discord-deploy-sync-stat-service`  
**PR:** _TBD_

---

## Objective

discord-deploy-sync-stat-service

---

## Progress

- [x] Plan approved
- [x] Procedure + GitHub issue created
- [x] Implementation started — `deploy-sync-stat-service.js` + wired Discord deploy/CI/digest paths
- [ ] Tests passing
- [ ] PR opened
- [ ] Review triaged
- [ ] Merged
- [ ] Post-merge verification

---

## Decisions

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-09-11 | Procedure opened | Task tracking started |
| 2026-09-11 | `deploy-sync-stat-service` as single source | Uses `fetchSiteDataWithLiveCache` + deployed tag overlay so Release sync matches pipeline version |

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
