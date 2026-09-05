# validate-dispatch local remote tags

**Procedure ID:** `437af6d7`  
**Status:** in_progress  
**Created:** 2026-09-05  
**Plan:** _none_  
**Issue:** _manual_  
**Branch:** `fix/validate-dispatch-local-remote`  
**PR:** _TBD_

---

## Objective

Fix local `npm run validate:dispatch` UX: list mode default, remote tag resolution, semver-sorted inventories, rollback-only-older-than-live policy, DEPLOY-02 Discord dedupe.

---

## Progress

- [x] Procedure created
- [x] Implementation: validate-release-dispatch.mjs remote/local resolution + CLI
- [x] Rollback eligibility requires tag older than live
- [x] DEPLOY-02: remove DiscordIntegrationsCard from Deployments
- [x] Tests passing (release-tag-eligibility, deployments-validation)
- [ ] PR opened + autopilot merge-ready

---

## Decisions

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-09-05 | Resolve tags via `git ls-remote origin` when missing locally | Operators validate without `git fetch --tags` |
| 2026-09-05 | Rollback sources must be semver older than live | Prevents v1.0.115 listed as rollback when live is v1.0.114 |

---

## Blockers

_None._

---

## Verification

| Tier | Check | Result |
|------|-------|--------|
| A | `release-tag-eligibility.test.mjs` | pass |
| A | `deployments-validation.test.tsx` | pass |

---

## Retrospective

_Filled on merge._
