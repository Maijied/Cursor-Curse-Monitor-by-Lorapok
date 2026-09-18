# WEB-08 Behind the scenes engineering section

**Procedure ID:** `b97b62e6`  
**Status:** in_progress  
**Created:** 2026-09-18  
**Plan:** plan/mission-control-master-tasks.md  
**Issue:** https://github.com/Maijied/Cursor-Curse-Monitor-by-Lorapok/issues/195  
**Branch:** `feat/web-08-behind-the-scenes`  
**PR:** _TBD_

---

## Objective

Add marketing `#engineering` behind-the-scenes section: monorepo surfaces, Mission Control, procedure/agents, cred vault, release integrity, contribute links (WEB-08 / #195).

---

## Progress

- [x] Plan approved
- [x] Procedure + GitHub issue created (#195; closed duplicate #287)
- [x] Implementation started
- [x] Tests passing (`test_web_08_engineering.mjs`)
- [ ] PR opened
- [ ] Review triaged
- [ ] Merged
- [ ] Post-merge verification

---

## Decisions

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-09-18 | Procedure opened | Task tracking started |
| 2026-09-18 | Track #195 (not #287) | procedure-init duplicate closed |
| 2026-09-18 | Place section after Architecture | Topology then “how we ship” narrative |
| 2026-09-18 | Static HTML + CSS only | No new JS; WEB-11 owns long-form history |

---

## Blockers

_None._

---

## Verification

| Tier | Check | Result |
|------|-------|--------|
| A | Headless tests | pass — `node tests/test_web_08_engineering.mjs` |
| B | Component matrix | pending (visual spot-check) |
| C | Production smoke | pending |

---

## Retrospective

_Filled on merge via `scripts/procedure-finalize-pr.mjs` or CI workflow._
