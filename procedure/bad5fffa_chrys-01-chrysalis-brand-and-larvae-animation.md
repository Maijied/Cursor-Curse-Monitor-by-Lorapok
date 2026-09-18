# CHRYS-01 Chrysalis brand and larvae animation

**Procedure ID:** `bad5fffa`  
**Status:** in_progress  
**Created:** 2026-09-18  
**Plan:** plan/mission-control-master-tasks.md  
**Issue:** https://github.com/Maijied/Cursor-Curse-Monitor-by-Lorapok/issues/186  
**Branch:** `feat/chrys-01-brand-animation`  
**PR:** https://github.com/Maijied/Cursor-Curse-Monitor-by-Lorapok/pull/286

---

## Objective

Official **Chrysalis** name for the floating AI assistant; shared shell in `@lorapok/cursor-monitor-shared`; Larvae mascot animation on marketing site + Mission Control.

---

## Progress

- [x] Plan approved
- [x] Procedure + GitHub issue created (#186; closed duplicate #285)
- [x] Implementation started
- [x] Tests passing
- [x] PR opened
- [ ] Review triaged
- [ ] Merged
- [ ] Post-merge verification

---

## Decisions

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-09-18 | Procedure opened | Task tracking started |
| 2026-09-18 | Track #186 (not #285) | procedure-init duplicate closed |
| 2026-09-18 | Shared `chrysalis.ts` + website IIFE + admin `ChrysalisFab` | One brand contract; website keeps file name for cache URLs |
| 2026-09-18 | Admin FAB offset `md:right-[5.75rem]` | Clears deploy floating status button |

---

## Blockers

_None._

---

## Verification

| Tier | Check | Result |
|------|-------|--------|
| A | Headless tests | pass — shared build + `chrysalis.test.mjs` |
| B | Component matrix | pass — admin `tsc -b` + oxlint ChrysalisFab/AppShell |
| C | Production smoke | pending (post-merge) |

---

## Retrospective

_Filled on merge via `scripts/procedure-finalize-pr.mjs` or CI workflow._
