# fix(admin): rbac subscribers deploy and direct main push

**Procedure ID:** `85f87ab6`  
**Status:** in_progress  
**Created:** 2026-09-05  
**Plan:** _none_  
**Issue:** https://github.com/Maijied/Cursor-Curse-Monitor-by-Lorapok/issues/228  
**Branch:** main  
**PR:** _direct main push (merged to main 5e33e624)_

---

## Objective

fix(admin): rbac subscribers deploy and direct main push

---

## Progress

- [x] Plan approved (AUTH-01 matrix + hotfix scope)
- [x] Procedure + GitHub issue created ([#228](https://github.com/Maijied/Cursor-Curse-Monitor-by-Lorapok/issues/228))
- [x] Implementation started
- [x] Tests passing (rbac-matrix, social-gallery-queue, direct-main-push)
- [x] Merged to `main` via direct push (`5e33e624`)
- [x] Fast admin deploy to https://cursor-dev.lorapok.tech
- [x] CI admin-deploy job green (run 33971849669)
- [ ] Post-merge verification (admin role deploy buttons, subscribers count)

---

## Decisions

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-09-05 | Procedure opened | Task tracking started |

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
