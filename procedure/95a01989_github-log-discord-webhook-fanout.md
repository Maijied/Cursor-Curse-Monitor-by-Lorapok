# GitHub log Discord webhook fanout

**Procedure ID:** `95a01989`  
**Status:** in_progress  
**Created:** 2026-09-17  
**Plan:** _none_  
**Issue:** __ISSUE_PENDING__  
**Branch:** _TBD_  
**PR:** _TBD_

---

## Objective

GitHub log Discord webhook fanout

---

## Progress

- [x] Plan approved
- [x] Procedure + GitHub issue created
- [x] Implementation started — `githubLogWebhookUrl` slot; fanout → github-log only; filter `in_progress`
- [x] Tests passing — fanout + discord-api + Settings INT-01
- [ ] PR opened
- [ ] Review triaged
- [ ] Merged
- [x] Post-merge verification — vault+KV: community / github-log / deployment-notice wired (2026-09-18); feedback preserved

---

## Decisions

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-09-17 | Procedure opened | Task tracking started |
| 2026-09-18 | Separate `githubLogWebhookUrl` from deployment + community | Deployment cards stay perfect; community announcements stay clean; GitHub ingest has its own channel |
| 2026-09-18 | Skip non-completed `workflow_run` | Stops spam of in_progress → success card storms |

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
