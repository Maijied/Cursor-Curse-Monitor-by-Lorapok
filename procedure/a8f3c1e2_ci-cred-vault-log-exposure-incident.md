# CI cred vault log exposure (incident)

**Procedure ID:** `a8f3c1e2`  
**Status:** in_progress  
**Created:** 2026-11-05  
**Evidence (contains secrets — do not copy log bodies or values):** GitHub Actions run `41929617333`, job `126929125235`; later production Admin Deploy runs (including post–PR #318) still showed Firebase private key material in logs — treat those run pages as compromised.

---

## What happened

Credentials appeared in **public GitHub Actions job logs**. The vault loader passes secrets to later steps through `GITHUB_ENV`; exposure was in logged output, not merely because `GITHUB_ENV` exists. **Do not paste or share log contents or secret values** in chat, PRs, or docs.

PR #318 reduced risk but did **not** close all paths: minified Firebase JSON used single-line `%25` scalar writes while `::add-mask::` registered the pre-encoding form; some workflow fallbacks used `echo … >> GITHUB_ENV` (marketing Cloudflare, social gallery `CRON_SECRET`); Cloudflare fallback env names (`FB_API_TOKEN`) did not match `promote-secret` lookups (`FB_CLOUDFLARE_API_TOKEN`). Firebase rules deploy ran with `--debug` in CI (verbose output risk).

**Unauthorized use:** not established. **Exposure:** confirmed across multiple runs (Admin Deploy, social gallery, original vault job).

---

## Confirmed exposed credentials (rotate all)

| Credential | Notes |
|------------|--------|
| `FIREBASE_SERVICE_ACCOUNT_JSON` | Includes private key (user-managed GCP key) |
| `RESEND_API_KEY` | |
| `TESTMAIL_API_KEY` | |
| `DISCORD_DEPLOYMENT_WEBHOOK` / `DISCORD_DEPLOYMENT_WEBHOOK_URL` | Same URL, two env names |
| `DISCORD_COMMUNITY_WEBHOOK_URL` | |
| `DISCORD_FEEDBACK_WEBHOOK_URL` | |

**Not confirmed exposed** in inspected jobs: Cloudflare deploy tokens, `GITHUB_TOKEN`, `CRON_SECRET` (masked there). **Not ruled out** on other runs.

---

## Operator checklist (order matters)

1. **Pause** affected workflows if more leaks are possible (revocation may briefly interrupt deploy / mail / Discord).
2. **Revoke at providers** (create replacements only after logging fix is merged and verified):
   - **GCP:** IAM → Service Accounts → affected account → Keys — disable/delete exposed user-managed key (identify from local vault JSON; never paste JSON into chat). Deleting a key does not instantly invalidate all short-lived tokens already issued.
   - **Resend:** delete exposed API key; create least-privilege replacement later.
   - **Testmail:** revoke/regenerate API key (or contact support if no self-serve revoke).
   - **Discord:** Server Settings → Integrations → Webhooks — **delete** deployment, community, and feedback webhooks; create new URLs (rename ≠ revoke).
3. **Merge logging fixes** (phase 2: delimiter for all sensitive `GITHUB_ENV` writes, percent-encoded mask pairs, promote fallbacks, no `echo` for secrets) — then run synthetic multiline/`%` tests and inspect a **deploy-infra** log with real secrets still rotated out or using test keys.
4. **Update consumers:** GPG cred vault, `sync-cred-vault-github.mjs`, Cloudflare Pages secrets, ADMIN_KV Discord URLs — no values in git/chat/logs.
5. **Log cleanup:** preserve minimal non-secret incident metadata; scrub or delete exposed run logs/artifacts where GitHub allows (deleting logs does **not** revoke keys).
6. **Audit:** provider activity logs for unexpected use; sample other Actions runs for scope.

---

## Progress

### Code (repo)

- [x] Phase 1 (#318): `::add-mask::`, multiline delimiter for newline JSON, marketing `--scope=cloudflare-deploy`, marketing Discord notify scope, `promote-secret` for some admin fallbacks
- [ ] Phase 2 (PR TBD): sensitive values **always** delimiter-written; mask `%25` encoded scalars; `FB_*` alias map for Cloudflare fallbacks; replace remaining `echo >> GITHUB_ENV` for secrets; disable Firebase `--debug` in CI unless `FIREBASE_DEPLOY_DEBUG=1`
- [ ] Maintainer: pause workflows (optional)
- [ ] Maintainer: provider revocation + replacement keys/webhooks
- [ ] Maintainer: vault + sync scripts + deployed secrets
- [ ] Maintainer: log cleanup + provider audit
- [ ] Post-fix verification deploy — logs show masks only, no credential echo

---

## Decisions

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-11-05 | Mask before every sensitive `GITHUB_ENV` write | GitHub does not auto-mask vault-derived env file appends |
| 2026-11-05 | Marketing jobs load Cloudflare deploy scope only | Marketing deploy does not need mail/Discord/Firebase from vault |
| 2026-11-05 | Never use scalar `%25` writes for sensitive values | Mask token must match any form that appears in logs |
| 2026-11-05 | Workflow fallbacks must use promote helpers + alias map | Raw `echo` and `FB_API_TOKEN` vs `FB_CLOUDFLARE_*` mismatch caused silent fallback failure and leaks |

---

## Verification

| Tier | Check | Result |
|------|-------|--------|
| A | `node --test website/admin/scripts/load-cred-vault-env-ci.test.mjs` + promote tests | pending phase 2 merge |
| B | workflow_dispatch deploy-infra — Admin Deploy + social gallery jobs | pending post-merge, after rotation plan |
| C | Maintainer provider audit | pending |

---

## Retrospective

_Filled after rotation + verified deploy._
