# WEB-10 Open-source contributor welcome

**Procedure ID:** `dee8aa0e`  
**Status:** in_progress  
**Created:** 2026-09-18  
**Plan:** plan/mission-control-master-tasks.md  
**Issue:** https://github.com/Maijied/Cursor-Curse-Monitor-by-Lorapok/issues/197  
**Branch:** `feat/web-10-contributor-welcome`  
**PR:** _TBD_

---

## Objective

Surface CONTRIBUTING.md, good-first issues, and Project #4 across the marketing site, IDE/browser extension footers, options, and Chrysalis so newcomers know how to join.

---

## Progress

- [x] Plan approved
- [x] Procedure + GitHub issue created (#197; dup #293 closed)
- [x] Implementation started
- [x] Tests passing (`productLinks.test.mjs` + shared suite)
- [ ] PR opened
- [ ] Review triaged
- [ ] Merged
- [ ] Post-merge verification

---

## Decisions

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-09-18 | Procedure opened | Task tracking started |
| 2026-09-18 | Shared `productLinks` CTAs | One source of truth for IDE/browser/admin |
| 2026-09-18 | `social-footer.js` injects contribute line | Covers all marketing pages with footers |

---

## Blockers

_None._

---

## Verification

| Tier | Check | Result |
|------|-------|--------|
| A | Headless tests (`npm test -w @lorapok/cursor-monitor-shared`) | pass |
| B | Component matrix (site:pages regen) | pass |
| C | Production smoke | pending merge |

---

## Retrospective

_Filled on merge via `scripts/procedure-finalize-pr.mjs` or CI workflow._
