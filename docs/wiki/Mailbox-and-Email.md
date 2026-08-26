# Mailbox and Email

Outbound mail uses branded HTML templates per category. Product mail sends from **cursor.monitor@lorapok.tech**; help and support replies use **cursor.curse.help@lorapok.tech**. Transport is via Cloudflare Email Sending (Lorapok Labs domain).

## Transport priority

1. **`ccm-mail-relay` Worker** (Pages service binding → `send_email`) — preferred; no REST API token
2. Cloudflare `EMAIL` binding (Workers only)
3. Cloudflare Email REST API (`CLOUDFLARE_EMAIL_API_TOKEN`)
4. Resend fallback (`RESEND_API_KEY`)

## Production setup

1. Onboard `lorapok.tech` in Cloudflare **Email → Email Sending**
2. Deploy relay worker: `node website/admin/scripts/enable-mail.mjs` (or CI on admin deploy)
3. Optional REST fallback: Pages secret `CLOUDFLARE_EMAIL_API_TOKEN` with **Email Sending → Edit**
4. Use **Mailbox → Send branded test email** to verify

## Message categories

| Category | Template | Logo asset | Trigger |
|----------|----------|------------|---------|
| `subscribe` | Branded welcome | `logo-product.png` | Website subscribe form |
| `invite` | Admin invitation | `logo-product.png` | Team invite |
| `notice` | Severity-styled notice | `logo-notice.png` | Dev notice broadcast |
| `compose` | Mission Control message | `logo-product.png` | Admin compose |
| `test` | Delivery confirmation | `logo-help.png` | Mailbox test button |

All templates use the **CCM / Lorapok Labs** dark theme with animated gradient header bar, stat pills, and CTA buttons. Template logic lives in `website/admin/functions/api/_shared/mail-branding.js` and `mail.js`.

## Mission Control mailbox UI

- **Message log** — filter by direction, category, status; search addresses and subjects
- **Read modal** — click any row to preview HTML (iframe) and plain text
- **Compose** — send branded HTML mail to any recipient
- **Test** — verify transport with a delivery confirmation email

## Credential split (required)

| Variable | Purpose |
|----------|---------|
| `CLOUDFLARE_API_TOKEN` | Pages/Workers **deploy** only (wrangler) |
| `CLOUDFLARE_EMAIL_API_TOKEN` | Email Sending **REST** only (Pages secret) |

Never sync the deploy token as `CLOUDFLARE_EMAIL_API_TOKEN`. Load from secure cred vault:

```bash
export CLOUDFLARE_API_TOKEN="$(cred get cursor cloudflare_api_token)"
export CLOUDFLARE_EMAIL_API_TOKEN="$(cred get cursor cloudflare_email_api_token)"
export CLOUDFLARE_ACCOUNT_ID="$(cred get cursor cloudflare_account_id)"
```

## Scripts

```bash
node website/admin/scripts/verify-mail-setup.mjs   # probe email token
node website/admin/scripts/enable-mail.mjs         # relay worker + Pages secret
node website/admin/scripts/repair-mail.mjs         # full fix: enable + build + deploy + verify
node website/admin/scripts/probe-mail-token.mjs
node website/admin/scripts/setup-mail-secrets.mjs
```

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| HTTP 401 on send | `CLOUDFLARE_EMAIL_API_TOKEN` needs Email Sending → Edit; redeploy Pages after `wrangler pages secret put` |
| Code 10203 | Enable Email Sending on account; onboard `lorapok.tech` in dashboard |
| `cloudflare-rest` in health, 401 | `MAIL_RELAY` missing — run `repair-mail.mjs` |
| Mail works locally, fails in prod | Redeploy Pages after secret sync |

[← Home](Home) · [Admin Panel](Admin-Panel)
