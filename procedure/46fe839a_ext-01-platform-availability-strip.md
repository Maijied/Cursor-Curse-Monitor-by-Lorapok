# EXT-01 platform availability strip

**Procedure ID:** `46fe839a`  
**Status:** in_progress  
**Created:** 2026-09-18  
**Plan:** plan/mission-control-master-tasks.md  
**Issue:** https://github.com/Maijied/Cursor-Curse-Monitor-by-Lorapok/issues/170  
**Branch:** `feat/ext-01-platform-strip`  
**PR:** https://github.com/Maijied/Cursor-Curse-Monitor-by-Lorapok/pull/300

---

## Objective

Shared platform availability strip (Open VSX, VS Code, Firefox AMO, Chrome zip, GitHub Releases) with live links across admin, website, IDE dashboard, and browser extension footers.

---

## Progress

- [x] Plan approved
- [x] Procedure + GitHub issue linked (#170)
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
| 2026-09-18 | Data-only shared API | `packages/shared` has no React; adapters per surface |
| 2026-09-18 | Text links + aria nav | Compact footers; site-data href hydration for live URLs |
| 2026-09-18 | Chrome prefers chromeZipUrl | Override when site-data provides direct zip |
| 2026-09-18 | Close issue #170 | #169 is closed duplicate; canonical tracker is #170 |

---

## Blockers

_None._

---

## Verification

| Tier | Check | Result |
|------|-------|--------|
| A | Headless tests | `platformAvailability.test.mjs` OK; GlobalFooter vitest 2/2; tsc IDE+admin OK |
| B | Component matrix | admin / website / IDE / browser footers + privacy/terms + generated wiki |
| C | Production smoke | pending post-merge |

---

## Retrospective

_Filled on merge via `scripts/procedure-finalize-pr.mjs` or CI workflow._
