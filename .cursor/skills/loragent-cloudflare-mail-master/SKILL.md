---
name: loragent-cloudflare-mail-master
description: Branded outbound mail for Lorapok Cloudflare Email Sending — transport priority, credential split, relay worker, and Mission Control mailbox. Use when fixing mail delivery, enable-mail scripts, or template changes.
---

# Loragent Cloudflare Mail Master (CCM)

Outbound mail for Cursor Curse Monitor uses Lorapok-branded HTML templates and a strict transport + credential policy.

## From addresses

| Address | Use |
|---------|-----|
| `cursor.monitor@lorapok.tech` | Product mail (subscribe, invite, compose) |
| `cursor.curse.help@lorapok.tech` | Help / support replies |

Domain: `lorapok.tech` (Cloudflare Email Sending).

## Transport priority

1. **`ccm-mail-relay` Worker** — Pages service binding → `send_email` (preferred; no REST token at runtime)
2. Cloudflare `EMAIL` binding (Workers only)
3. Cloudflare Email REST API (`CLOUDFLARE_EMAIL_API_TOKEN`)
4. Resend fallback (`RESEND_API_KEY`)

## Credential split (required)

| Env var | Scope |
|---------|-------|
| `CLOUDFLARE_API_TOKEN` | wrangler deploy, Pages, Workers |
| `CLOUDFLARE_EMAIL_API_TOKEN` | Email Sending REST probes + Pages secret |

Load via cred vault (see `secure-cred-vault` skill). **Never** fall back from missing email token to deploy token for sends.

Implementation: `website/admin/scripts/lib/mail-credentials.mjs`

## Template categories

| Category | Logo | Trigger |
|----------|------|---------|
| `subscribe` | logo-product | Website subscribe |
| `invite` | logo-product | Team invite |
| `notice` | logo-notice | Dev notice broadcast |
| `compose` | logo-product | Mission Control compose |
| `test` | logo-help | Mailbox test button |

Source: `website/admin/functions/api/_shared/mail-branding.js`, `mail.js`, `scripts/mail-templates.mjs`

## Production pipeline

1. Onboard `lorapok.tech` in Cloudflare Email Sending
2. One-time: sync cred vault → GitHub `admin-production` secrets
3. CI `admin-deploy` on `main`:
   - `enable-mail.mjs` (relay worker + Pages email secret)
   - `verify-mail-transport.mjs` (fail closed)
   - `wrangler pages deploy` (activates `MAIL_RELAY` binding)

**Push to main:** mail setup may be skipped to avoid Cloudflare 429 before Pages deploy (see `deploy-retry` helpers).

## Repair (manual)

```bash
export CLOUDFLARE_API_TOKEN="$(cred get cursor cloudflare_api_token)"
export CLOUDFLARE_EMAIL_API_TOKEN="$(cred get cursor cloudflare_email_api_token)"
export CLOUDFLARE_ACCOUNT_ID="$(cred get cursor cloudflare_account_id)"
node website/admin/scripts/repair-mail.mjs
```

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| HTTP 401 on send | Email token needs Email Sending → Edit; redeploy after `wrangler pages secret put` |
| Code 10203 | Enable Email Sending; onboard domain |
| `cloudflare-rest` health 401 | Missing `MAIL_RELAY` — run `repair-mail.mjs` |
| CI 429 before deploy | Skip mail on push; use longer pre-cooldown (`deploy-retry.mjs`) |

## Key scripts

```bash
node website/admin/scripts/verify-mail-setup.mjs
node website/admin/scripts/enable-mail.mjs
node website/admin/scripts/repair-mail.mjs
node website/admin/scripts/probe-mail-token.mjs
```

Wiki: `docs/wiki/Mailbox-and-Email.md`

Global copy: `~/.cursor/skills/loragent-cloudflare-mail-master/SKILL.md`
