# NOTICE-01 changelog notice draft

**Procedure ID:** `0fa9fdb1`  
**Status:** done  

---

## Objective

NOTICE-01 — Parse `CHANGELOG.md` into disabled Mission Control notice drafts for master review.

---

## Progress

- [x] Plan approved (master tasks NOTICE-01)
- [ ] Procedure + GitHub issue created
- [x] Implementation started
- [x] Tests passing (`changelog-notice.test.mjs`, `notices-api.test.ts`)
- [ ] PR opened
- [ ] Review triaged
- [ ] Merged
- [ ] Post-merge verification

---

## Decisions

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-09-05 | API draft via `changelogDraft=1` query | Reuses notices catalog; no auto-publish |

---

## Blockers

_None._

---

## Verification

| Tier | Check | Result |
|------|-------|--------|
| A | Headless tests | pass |
| B | Component matrix | pending |
| C | Production smoke | pending |

---

## Retrospective

_Filled on merge via `scripts/procedure-finalize-pr.mjs` or CI workflow._
