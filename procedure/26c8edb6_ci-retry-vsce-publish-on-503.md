# CI retry VSCE publish on 503

**Procedure ID:** `26c8edb6`  
**Status:** in_progress  
**Created:** 2026-09-17  
**Plan:** _none_  
**Issue:** https://github.com/Maijied/Cursor-Curse-Monitor-by-Lorapok/issues/276  
**Branch:** `fix/ci-vsce-publish-503-retries`  
**PR:** https://github.com/Maijied/Cursor-Curse-Monitor-by-Lorapok/pull/277

---

## Objective

Marketplace deploy fails when Azure returns HTML HTTP 503 during `vsce publish`. Add retries in CI (same pattern as Open VSX / GitHub Release uploads) so a single transient 503 does not fail the job.

---

## Progress

- [x] Plan approved
- [x] Procedure + GitHub issue created
- [x] Implementation started
- [x] Tests passing (`node tests/test_publish_vsce.mjs`)
- [x] PR opened (#277)
- [ ] Review triaged
- [ ] Merged
- [ ] Post-merge verification

---

## Decisions

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-09-17 | Procedure opened | Task tracking started |
| 2026-09-18 | New `scripts/publish-vsce.mjs` | Mirror `publish-ovsx` / `create-github-release` retries; detect HTML Service Unavailable + 502/503/504 |
| 2026-09-18 | Default 6 attempts, backoff to 90s | Match GitHub release upload resilience for Azure flakiness |

---

## Blockers

_None._

---

## Verification

| Tier | Check | Result |
|------|-------|--------|
| A | Headless tests | `node tests/test_publish_vsce.mjs` OK |
| B | Component matrix | CI workflow step uses `publish-vsce.mjs` |
| C | Production smoke | pending (next marketplace deploy) |

---

## Retrospective

_Filled on merge via `scripts/procedure-finalize-pr.mjs` or CI workflow._
