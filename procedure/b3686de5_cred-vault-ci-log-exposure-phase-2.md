# Cred vault CI log exposure phase 2

**Procedure ID:** `b3686de5`  
**Status:** in_progress  
**Created:** 2026-11-05  
**Plan:** _none_  
**Issue:** _manual / links to parent `procedure/a8f3c1e2_ci-cred-vault-log-exposure-incident.md`_  
**Branch:** `fix/cred-vault-github-env-masking-v2`  
**PR:** _TBD_

---

## Objective

Close remaining GitHub Actions secret leak paths after PR #318: Firebase minified JSON masking, workflow `echo` fallbacks, Cloudflare `FB_*` alias mismatch, CI Firebase `--debug`.

---

## Progress

- [x] Procedure opened
- [x] Root cause documented in `a8f3c1e2` operator checklist
- [x] Implementation: `github-actions-env.mjs`, promote aliases, workflow fallbacks, firebase debug gate
- [ ] Tests passing locally + CI
- [ ] PR opened
- [ ] Merged
- [ ] Post-merge deploy-infra log review (no secret echo) before provider rotation completes

---

## Decisions

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-11-05 | All sensitive `GITHUB_ENV` writes use delimiter syntax | Avoids `%25` scalar bypass of `::add-mask::` |
| 2026-11-05 | `ENV_ALIASES` in promote-secret | Matches `FB_API_TOKEN` workflow mapping |

---

## Blockers

Provider rotation remains **maintainer-only**; do not rerun full vault jobs on public logs until phase 2 merged and spot-checked.

---

## Verification

| Tier | Check | Result |
|------|-------|--------|
| A | load-cred-vault + promote unit tests | pending |
| B | CI green on PR | pending |
| C | deploy-infra log inspection | pending post-merge |

---

## Retrospective

_Filled on merge._
