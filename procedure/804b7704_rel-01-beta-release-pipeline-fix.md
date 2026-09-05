# REL-01 Beta release pipeline fix

**Procedure ID:** `804b7704`  
**Status:** done  
**Created:** 2026-09-05  
**Plan:** _none_  
**Issue:** [#185](https://github.com/Maijied/Cursor-Curse-Monitor-by-Lorapok/issues/185)  
**Branch:** main  
**PR:** _TBD_

---

## Objective

REL-01 Beta release pipeline fix — align beta channel version planning, CI release-prep/deploy, and Mission Control.

---

## Progress

- [x] Plan approved
- [x] Procedure + GitHub issue created
- [x] Implementation started
- [x] Tests passing
- [ ] PR opened
- [ ] Review triaged
- [ ] Merged
- [ ] Post-merge verification

---

## Decisions

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-09-05 | Procedure opened | Task tracking started |
| 2026-09-05 | Beta tags use `vX.Y.Z-beta.N` for full-release | Avoids collision with production semver tags; publish-tag can still use semver + `--pre-release` |
| 2026-09-05 | Remove CI deploy gate blocking production full-release | Deploy job now runs for all full-release dispatches when `deploy_extension` is true |

---

## Blockers

_None._

---

## Verification

| Tier | Check | Result |
|------|-------|--------|
| A | `version-plan.test.mjs` + admin vitest (marketplace, release-version, deployments-validation) | pass |
| B | Component matrix | pending |
| C | Production smoke | pending |

---

## Retrospective

_Filled on merge via `scripts/procedure-finalize-pr.mjs` or CI workflow._
