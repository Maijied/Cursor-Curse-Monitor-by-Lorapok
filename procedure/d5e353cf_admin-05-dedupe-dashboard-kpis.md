# ADMIN-05 dedupe dashboard KPIs

**Procedure ID:** `d5e353cf`  
**Status:** in_progress  
**Created:** 2026-09-08  
**Plan:** _none_  
**Issue:** [#222](https://github.com/Maijied/Cursor-Curse-Monitor-by-Lorapok/issues/222)  
**Branch:** `feat/admin-05-dedupe-dashboard`  
**PR:** [#252](https://github.com/Maijied/Cursor-Curse-Monitor-by-Lorapok/pull/252)

---

## Objective

Remove redundant KPIs between Overview, Connected Services, and Infrastructure now that GlobalFooter owns the status strip.

---

## Progress

- [x] Procedure + GitHub issue created
- [x] Implementation started
- [x] Tests passing (Overview, ConnectedServicesCard, Dashboard — 7/7)
- [x] PR opened
- [x] Review triaged (cloud autopilot 2026-09-08 — 0 threads)
- [ ] Merged
- [ ] Post-merge verification

---

## Decisions

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-09-08 | Footer owns overall health, version, marketplace sync | ADMIN-04 contract |
| 2026-09-08 | Connected Services drops D1/stats-cron rows | Infrastructure card is canonical for KV/D1/cron |
| 2026-09-08 | Overview drops full Connected Services card | Settings → Services tab is canonical |

---

## Blockers

_None._

---

## Verification

| Tier | Check | Result |
|------|-------|--------|
| A | Headless tests | pass (7/7 focused) |
| B | Component matrix | pass (Admin/Browser/Root CI green) |
| C | Production smoke | pending post-merge |

---

## Retrospective

_Filled on merge via `scripts/procedure-finalize-pr.mjs` or CI workflow._
