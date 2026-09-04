# Cred vault CI and Settings maintenance

**Procedure ID:** `46dd3964`  
**Status:** done (service tabs follow-up)  
**Branch:** main  
**PR:** direct push

---

## Objective

Wire Global API Key cred vault auth for local + CI deploy, decrypt gpg vault in GitHub Actions via pin secret, and extend Settings → Cloudflare to rotate deploy credentials and show cred-vault CI status.

**Follow-up:** Per-service Settings tabs for Resend, testmail, cred vault CI, and marketplace distribution.

---

## Progress

- [x] Plan approved
- [x] Procedure + GitHub issue created
- [x] Implementation started
- [x] Tests passing
- [x] Pushed to main (cred vault CI)
- [x] Service tabs (Resend, testmail, cred vault, marketplace) + API routes
- [ ] Post-merge verification (next CI deploy)

---

## Decisions

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-09-04 | Procedure opened | Task tracking started |
| 2026-09-05 | Global API Key over stale Bearer | Vault bearer invalid; `cloudfare_global_api_key` probes Pages 200 |
| 2026-09-05 | CI decrypts gpg blob + pin | Single source of truth; `sync-cred-vault-github.mjs` uploaded secrets |
| 2026-09-05 | Settings syncs GH only | Pages cannot write local gpg; FieldHelp documents `sync-cred-vault-github.mjs` after vault edits |
| 2026-09-05 | Split Resend/testmail tabs | Mail tab = Cloudflare identities; Resend/testmail get dedicated cards + integration APIs |

---

## Blockers

_None._

---

## Verification

| Tier | Check | Result |
|------|-------|--------|
| A | Headless tests | vitest 180 pass; mail-credentials.test OK |
| C | Vault verify | `verify-cloudflare-cred-vault.mjs` — global key Pages 200 |
| C | GH secrets | User ran `sync-cred-vault-github.mjs` + `sync-cloudflare-cred-vault.mjs` |

---

## Retrospective

_Filled on merge via `scripts/procedure-finalize-pr.mjs` or CI workflow._
