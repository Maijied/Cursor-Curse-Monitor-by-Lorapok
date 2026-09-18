# DEPLOY-04 admin-only marketplace publish

**Procedure ID:** `88a24b5d`  
**Status:** in_progress  
**Created:** 2026-09-18  
**Plan:** `plan/mission-control-master-tasks.md`  
**Issue:** https://github.com/Maijied/Cursor-Curse-Monitor-by-Lorapok/issues/282  
**Branch:** `feat/deploy-04-admin-only-marketplace`  
**PR:** _TBD_

---

## Objective

Stop continuous / accidental marketplace publishes. VSCE / Open VSX / AMO only via Mission Control → Deployments (publish-tag / rollback with `deploy_extension=true`).

---

## Progress

- [x] Plan approved
- [x] Procedure + GitHub issue linked (#282)
- [x] Implementation started
- [x] Tests passing (`test_marketplace_deploy_gate.mjs`)
- [ ] PR opened
- [ ] Review triaged
- [ ] Merged
- [ ] Post-merge verification

---

## Decisions

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-09-18 | Marketplace job allow-list: publish-tag / rollback / sync-open-vsx only | Matches workflow header; blocks full-release leak |
| 2026-09-18 | `deploy_extension` default `false` + require `== true` | Opt-in; Mission Control Deploy still sends true |
| 2026-09-18 | Gate standalone `publish-firefox.yml` behind `allow_standalone_amo` | Prefer admin Deploy for AMO |

---

## Blockers

_None._

---

## Verification

| Tier | Check | Result |
|------|-------|--------|
| A | Headless tests | pass — `test_marketplace_deploy_gate.mjs` |
| B | Component matrix | pending (dispatch smoke post-merge) |
| C | Production smoke | pending |

---

## Retrospective

_Filled on merge via `scripts/procedure-finalize-pr.mjs` or CI workflow._
