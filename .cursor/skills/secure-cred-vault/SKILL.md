---
name: secure-cred-vault
description: Credential vault operations for Lorapok projects — gpg-encrypted store, GitHub secrets sync, and cred CLI usage. Use when syncing Cloudflare, AMO, or Firebase tokens to CI without printing secrets.
---

# Secure Cred Vault

Use this skill when syncing secrets from the encrypted vault to GitHub, Cloudflare Pages, or local shells. **Never print secret values.**

## Vault layout

| Path | Purpose |
|------|---------|
| `CRED_STORE_FILE` | Encrypted JSON (default: `/mnt/NewVolume/Personal_Projects/cred/credentials.json.gpg`) |
| `.cred-vault-passphrase` | Gitignored one-line passphrase (repo root or `website/admin/`) |
| `CRED_VAULT_PASSPHRASE` | Shell env override (non-interactive CI / agents) |

Vault JSON shape (decrypted):

```json
{
  "cursor": {
    "cloudflare_api_token": "…",
    "cloudflare_email_api_token": "…",
    "cloudflare_account_id": "f049faaf2f67549f5c58837479596a4a"
  },
  "firefox": {
    "jwt_issuer": "user:…",
    "jwt_secret": "…"
  }
}
```

## Credential split (Cloudflare)

| Key | Use |
|-----|-----|
| `cursor/cloudflare_api_token` | Pages/Workers **deploy** only (`CLOUDFLARE_API_TOKEN`) |
| `cursor/cloudflare_email_api_token` | Email Sending **REST** only (`CLOUDFLARE_EMAIL_API_TOKEN`) |
| `cursor/cloudflare_account_id` | Account ID for API calls |

**Never** use the deploy token for outbound mail.

## Load into shell

```bash
export CLOUDFLARE_API_TOKEN="$(cred get cursor cloudflare_api_token)"
export CLOUDFLARE_EMAIL_API_TOKEN="$(cred get cursor cloudflare_email_api_token)"
export CLOUDFLARE_ACCOUNT_ID="$(cred get cursor cloudflare_account_id)"
```

If `cred` CLI is unavailable, use gpg decrypt + `jq` against `CRED_STORE_FILE` with passphrase from `.cred-vault-passphrase`.

## CCM sync scripts (this repo)

| Script | Action |
|--------|--------|
| `website/admin/scripts/sync-mail-cred-vault.mjs` | Mail token → GitHub `admin-production` + Pages secret + vault |
| `website/admin/scripts/sync-mail-on-main.mjs` | CI entry; `--vault` for local vault refresh |
| `website/admin/scripts/lib/cred-vault-sync.mjs` | Shared gpg read/write for `cursor/*` keys |
| `scripts/sync-amo-github-secrets.mjs` | AMO JWT → GitHub repo secrets |

## One-time setup (maintainer PC)

```bash
# 1. Create gitignored passphrase file
echo 'your-passphrase' > .cred-vault-passphrase

# 2. Sync mail tokens (needs wrangler OAuth or existing tokens in env)
node website/admin/scripts/sync-mail-on-main.mjs --vault

# 3. Sync AMO JWT to GitHub
CRED_PASSPHRASE=… node scripts/sync-amo-github-secrets.mjs
```

## Cloud agents

Cloud VMs typically **do not** mount `/mnt/NewVolume/…`. Use GitHub environment secrets (`admin-production`) for CI deploys. Local vault sync is maintainer-only; agents should not commit passphrases or decrypted vaults.

## Anti-patterns

- Committing `.cred-vault-passphrase` or decrypted vault JSON
- Setting `CLOUDFLARE_EMAIL_API_TOKEN` to the deploy token
- Printing tokens in logs, PRs, or test fixtures (use masked IDs like webhook `565087/…` only in unit tests)

Global copy: `~/.cursor/skills/secure-cred-vault/SKILL.md`
