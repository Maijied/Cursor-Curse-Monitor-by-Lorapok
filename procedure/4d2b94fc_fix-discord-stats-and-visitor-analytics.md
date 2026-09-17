# Fix Discord stats and visitor analytics

**Procedure ID:** `4d2b94fc`  
**Status:** in_progress  
**Created:** 2026-09-18  
**Plan:** _none_  
**Issue:** https://github.com/Maijied/Cursor-Curse-Monitor-by-Lorapok/issues/272  
**Branch:** `fix/discord-stats-analytics`  
**PR:** https://github.com/Maijied/Cursor-Curse-Monitor-by-Lorapok/pull/273

---

## Objective

Fix Discord Community reach / engagement cards sending wrong or stale stats, and restore live website visitor counters.

---

## Progress

- [x] Plan approved (debug-first)
- [x] Procedure + GitHub issue created
- [x] Implementation started
- [x] Tests passing (discord-deploy-context + discord-notify)
- [x] PR opened
- [ ] Review triaged
- [ ] Merged
- [ ] Post-merge verification (admin deploy + digest test + website deploy)

---

## Decisions

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-09-18 | Debug before fix | Confirmed three stacked causes: no-op visit beacon, auth-gated stats zeros, Discord Total collapsing when duplicate missing |
| 2026-09-18 | KV primary + Firestore seed | Empty KV must not reset historical ~276 visits; seed from public Firestore REST on first write |
| 2026-09-18 | Absolute admin beacon URL | Marketing site is GitHub Pages — relative `/api/analytics/visit` 404s |
| 2026-09-18 | Label incomplete duplicate | When LorapokLabs missing, Total uses `canonicalTotal` + explicit note |

---

## Blockers

_None._

---

## Verification

| Tier | Check | Result |
|------|-------|--------|
| A | Headless tests | discord-deploy-context + discord-notify OK; oxlint clean on touched files |
| B | Component matrix | pending admin deploy |
| C | Production smoke | pending digest test + site visit increments |

---

## Retrospective

_Filled on merge via `scripts/procedure-finalize-pr.mjs` or CI workflow._
