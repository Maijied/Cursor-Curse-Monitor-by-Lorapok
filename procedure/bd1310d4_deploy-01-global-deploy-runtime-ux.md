# DEPLOY-01 global deploy runtime UX

**Procedure ID:** `bd1310d4`  
**Status:** merge-ready  
**Created:** 2026-09-05  
**Plan:** `plan/mission-control-master-tasks.md`  
**Branch:** `feat/deploy-01-global-runtime-ux`  
**PR:** _pending_

---

## Objective

Complete DEPLOY-01: global deploy session survives navigation; pipeline steps match `ci-cd.yml`; operator dismisses session explicitly after completion.

---

## Progress

- [x] Add `Validate Dispatch Inputs` to `WORKFLOW_JOB_ORDER` (admin + API shared)
- [x] Keep deploy session after workflow completes until Done
- [x] FAB shows active pipeline job name via `getPipelineSummary`
- [x] Status modal Done button + GitHub link
- [x] Tests: workflow-jobs parity, floating button, deployments validation

---

## Verification

| Tier | Check | Result |
|------|-------|--------|
| A | `workflow-jobs.test.ts` | pass |
| A | `deploy-floating-button.test.tsx` | pass |
| A | `deployments-validation.test.tsx` | pass |
