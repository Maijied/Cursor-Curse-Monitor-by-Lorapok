# CI cred vault log exposure (incident)

**Procedure ID:** `a8f3c1e2`  
**Status:** in_progress  
**Created:** 2026-11-05  
**Evidence (contains secrets — do not copy):** GitHub Actions run `41929617333`, job `126929125235`

---

## Objective

Stop repeat exposure of vault-derived secrets in public Actions logs; rotate compromised credentials; restore safe deploys.

---

## Confirmed exposed env names (treat as compromised)

- `FIREBASE_SERVICE_ACCOUNT_JSON` (private key inside JSON)
- `RESEND_API_KEY`
- `TESTMAIL_API_KEY`
- `DISCORD_DEPLOYMENT_WEBHOOK` / `DISCORD_DEPLOYMENT_WEBHOOK_URL` (same URL)
- `DISCORD_COMMUNITY_WEBHOOK_URL`
- `DISCORD_FEEDBACK_WEBHOOK_URL`

Not confirmed exposed in inspected job: Cloudflare deploy tokens, `GITHUB_TOKEN`, `CRON_SECRET` (masked there). Other runs not fully audited.

---

## Progress

- [x] Code fix: `::add-mask::` + multiline `GITHUB_ENV` in `load-cred-vault-env-ci.mjs`
- [x] Scope marketing deploy loader to `--scope=cloudflare-deploy` only
- [x] Remove full vault decrypt from marketing Discord notify job
- [x] Masked `promote-secret-to-github-env.mjs` for admin fallback secrets
- [ ] Maintainer: revoke/replace credentials at providers (Firebase key, Resend, Testmail, 3× Discord webhooks)
- [ ] Maintainer: update GPG vault + `sync-cred-vault-github.mjs` / Cloudflare / KV after rotation
- [ ] Maintainer: delete or minimize exposed Actions logs where GitHub allows
- [ ] Maintainer: provider audit logs review
- [ ] Post-fix verification deploy without secret echo

---

## Decisions

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-11-05 | Mask before every sensitive `GITHUB_ENV` write | GitHub does not auto-mask vault-derived env file appends |
| 2026-11-05 | Marketing jobs load Cloudflare deploy scope only | Marketing deploy does not need mail/Discord/Firebase from vault |

---

## Verification

| Tier | Check | Result |
|------|-------|--------|
| A | `node --test website/admin/scripts/load-cred-vault-env-ci.test.mjs` | pending CI |
| B | workflow_dispatch deploy-infra (website) with debug off | pending post-merge |

---

## Retrospective

_Filled after rotation + verified deploy._
