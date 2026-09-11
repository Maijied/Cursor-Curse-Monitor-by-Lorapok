# CRED-02 cred sync reliability

**Procedure ID:** `3c6ce8c3`  
**Status:** in_progress  
**Created:** 2026-09-11  
**Plan:** _none_  
**Issue:** [#218](https://github.com/Maijied/Cursor-Curse-Monitor-by-Lorapok/issues/218)  
**Branch:** `feat/cred-02-cred-sync-reliability`  
**PR:** _TBD_

---

## Objective

Idempotent Settings secret sync to GitHub with automatic retry, drift detection, audit logging, and health badge ("sync never miss").

---

## Progress

- [x] Plan approved
- [x] Procedure + GitHub issue linked
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
| 2026-09-11 | Procedure opened | Task tracking started |
| 2026-09-11 | Shared `syncGithubSecretsWithAudit` wrapper | One retry + KV/system-log audit on all integration PUT handlers |
| 2026-09-11 | `GET /integrations/cred-sync/status` + `/api/health` `credSync` | Drift + never-miss badge without duplicating GitHub list calls in UI |

---

## Blockers

_None._

---

## Verification

| Tier | Check | Result |
|------|-------|--------|
| A | `node functions/api/_shared/cred-sync-audit.test.mjs` | pass |
| B | `vitest run src/__tests__/dev-api.test.ts` + `rbac-routes.test.mjs` | pass |
| C | Production smoke | deferred — needs authenticated Settings save |

---

## Retrospective

_Filled on merge via `scripts/procedure-finalize-pr.mjs` or CI workflow._
