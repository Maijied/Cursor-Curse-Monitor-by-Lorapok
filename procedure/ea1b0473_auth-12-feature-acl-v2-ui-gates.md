# AUTH-12 feature ACL v2 UI gates

**Procedure ID:** `ea1b0473`  
**Status:** done  
**Created:** 2026-09-05  
**Plan:** plan/AUTH-01-rbac-matrix.md  
**Issue:** __ISSUE_PENDING__  
**Branch:** _TBD_  
**PR:** _TBD_

---

## Objective

AUTH-12 feature ACL v2 UI gates

---

## Progress

- [x] Plan approved (`plan/AUTH-12-feature-acl.md`)
- [ ] Procedure + GitHub issue created
- [x] Implementation started
- [x] Tests passing (`auth-12-feature-acl.test.ts`)
- [ ] PR opened
- [ ] Review triaged
- [ ] Merged
- [ ] Post-merge verification

---

## Decisions

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-09-05 | UI gates via `hasPermission` + `ReadOnlyAclBanner` | Mirrors server `requirePermission`; master bypass unchanged |

---

## Blockers

_None._

---

## Verification

| Tier | Check | Result |
|------|-------|--------|
| A | Headless tests | pass (`auth-12-feature-acl.test.ts`) |
| B | Component matrix | pending |
| C | Production smoke | pending |

---

## Retrospective

_Filled on merge via `scripts/procedure-finalize-pr.mjs` or CI workflow._
