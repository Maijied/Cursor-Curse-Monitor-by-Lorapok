# ADMIN-03 cross-section refer buttons

**Procedure ID:** `87e773dd`  
**Status:** in_progress  
**Created:** 2026-09-08  
**Plan:** _none_  
**Issue:** https://github.com/Maijied/Cursor-Curse-Monitor-by-Lorapok/issues/220  
**Branch:** `cursor/admin-03-section-refer-a873`  
**PR:** _TBD_

---

## Objective

ADMIN-03 cross-section refer buttons — shared `SectionReferLink` component with minimal "Go to →" navigation when copy mentions another Mission Control area.

---

## Progress

- [x] Plan approved
- [x] Procedure + GitHub issue created (#220)
- [x] Implementation started
- [x] Tests passing (`section-refer-link.test.tsx`, oxlint)
- [ ] PR opened
- [ ] Review triaged
- [ ] Merged
- [ ] Post-merge verification

---

## Decisions

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-09-08 | Procedure opened | Task tracking started |
| 2026-09-08 | `section-refer.ts` registry + `SectionReferLink` | Single source for paths/labels; settings tabs via `persistSettingsTab` |
| 2026-09-08 | ADMIN-04/05 deferred to separate PR | Unrelated scope (footer + dedupe) |

---

## Blockers

_None._

---

## Verification

| Tier | Check | Result |
|------|-------|--------|
| A | Headless tests | `section-refer-link.test.tsx` 5/5 pass |
| B | Component matrix | Wired in Deployments, Connected Services, Docs, Subscribers, Discord/testmail cards, Infrastructure |
| C | Production smoke | pending |

---

## Retrospective

_Filled on merge via `scripts/procedure-finalize-pr.mjs` or CI workflow._
