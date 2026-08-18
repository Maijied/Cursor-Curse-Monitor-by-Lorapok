# Mailbox and Email

Outbound mail is sent from **cursor-contact@lorapok.tech** via Cloudflare Email Sending (Lorapok Labs domain).

## Transport priority

1. Cloudflare `EMAIL` binding (Workers)
2. Cloudflare Email REST API (`CLOUDFLARE_EMAIL_API_TOKEN`)
3. Resend fallback (`RESEND_API_KEY`)

## Message categories

| Category | Template | Trigger |
|----------|----------|---------|
| `subscribe` | Branded welcome | Website subscribe form |
| `invite` | Admin invitation | Team invite |
| `notice` | Severity-styled notice | Dev notice broadcast |
| `compose` | Mission Control message | Admin compose |
| `test` | Delivery confirmation | Mailbox test button |

All templates use the **CCM / Lorapok Labs** dark theme with animated gradient header bar, stat pills, and CTA buttons.

## Mission Control mailbox UI

- **Message log** — filter by direction, category, status; search addresses and subjects
- **Read modal** — click any row to preview HTML (iframe) and plain text
- **Compose** — send branded HTML mail to any recipient
- **Test** — verify transport with a delivery confirmation email

## Production setup

1. Onboard `lorapok.tech` in Cloudflare **Email → Email Sending**
2. Set Pages secrets: `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_EMAIL_API_TOKEN`
3. Use **Mailbox → Send branded test email** to verify

## Scripts

```bash
node website/admin/scripts/probe-mail-token.mjs
node website/admin/scripts/setup-mail-secrets.mjs
node website/admin/scripts/enable-mail.mjs
```

[← Home](Home) · [Admin Panel](Admin-Panel)
