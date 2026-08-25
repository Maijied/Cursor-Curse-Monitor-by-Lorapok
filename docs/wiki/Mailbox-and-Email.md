# Mailbox and Email

Outbound mail uses branded HTML templates per category. Product mail sends from **cursor.monitor@lorapok.tech**; help and support replies use **cursor.curse.help@lorapok.tech**. Transport is via Cloudflare Email Sending (Lorapok Labs domain).

## Transport priority

1. Cloudflare `EMAIL` binding (Workers)
2. Cloudflare Email REST API (`CLOUDFLARE_EMAIL_API_TOKEN`)
3. Resend fallback (`RESEND_API_KEY`)

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
