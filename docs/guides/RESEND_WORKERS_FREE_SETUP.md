# Resend outbound mail on Cloudflare Workers Free

Mission Control sends subscribe welcome emails, notices, and compose mail through `sendMail()` in `website/admin/functions/api/_shared/mail.js`.

On **Workers Free**, Cloudflare Email Sending only delivers to **verified destination addresses** — not arbitrary subscribers. **Resend** is the supported path for external inboxes (Gmail, etc.).

Configure routing and domain preferences in **Mission Control → Settings → Outbound mail**. API keys remain in **Cloudflare Pages secrets** (not editable in the UI).

---

## Quick checklist

| Step | Action | Where |
|------|--------|--------|
| 1 | Rotate API key if exposed | [Resend → API Keys](https://resend.com/api-keys) |
| 2 | Verify sending domain (SPF/DKIM) | [Resend → Domains](https://resend.com/domains) + Cloudflare DNS |
| 3 | Sync `RESEND_API_KEY` to Pages | `node website/admin/scripts/setup-resend-secret.mjs` |
| 4 | Sync key to GitHub (optional CI) | `gh secret set RESEND_API_KEY --env admin-production` |
| 5 | Redeploy admin | Settings → **Sync up** or `repair-mail.mjs` |
| 6 | Test external delivery | Mailbox → branded test, or `probe-subscribe-testmail.mjs` |

---

## Admin panel settings (KV — no secrets)

Saved under `integrations:mail` in ADMIN_KV:

| Setting | Purpose |
|---------|---------|
| **Workers Free mode** | When on, external recipients use Resend when `RESEND_API_KEY` is set |
| **Resend-first for external** | Route non-`@lorapok.tech` mail through Resend before Cloudflare relay |
| **Sending domain** | Domain verified in Resend (default `lorapok.tech`) |
| **Resend From override** | Optional `Name <email@domain>` when `RESEND_FROM` Pages secret is empty |
| **Resend domain verified** | Mark after DNS verification succeeds in Resend |
| **Product / support From** | Addresses and display names for branded templates |

Pages secrets (set via script or deploy-infra):

| Secret | Purpose |
|--------|---------|
| `RESEND_API_KEY` | Resend REST API authentication |
| `RESEND_FROM` | Optional override; takes precedence over KV `resendFromOverride` |

---

## 1. Rotate Resend API key

If a key was shared in chat, logs, or a ticket:

1. [Resend → API Keys](https://resend.com/api-keys) → delete the exposed key
2. Create a new key
3. Update cred vault: `cursor/resend_api_key`
4. Re-run `setup-resend-secret.mjs`

---

## 2. Verify `lorapok.tech` in Resend

1. [Resend → Domains](https://resend.com/domains) → **Add Domain** → `lorapok.tech`
2. Add DNS records in Cloudflare (DNS only / grey cloud)
3. Click **Verify** in Resend (usually 1–5 minutes)
4. In Mission Control → Settings, enable **Resend domain verified**

---

## 3. Sync secrets to Pages

```bash
cd website/admin
export RESEND_API_KEY="re_..."
export RESEND_FROM="Cursor Curse Monitor <cursor.monitor@lorapok.tech>"
node scripts/setup-resend-secret.mjs
```

---

## 4. GitHub Actions (deploy-infra)

```bash
gh secret set RESEND_API_KEY --env admin-production \
  --body "$(cred get cursor resend_api_key)"
```

---

## 5. Redeploy

```bash
node website/admin/scripts/repair-mail.mjs
```

Or Mission Control → Settings → **Sync up**.

---

## 6. Verify delivery

- Mailbox → **Send branded test** to Gmail (transport: `resend`)
- `node website/admin/scripts/probe-subscribe-testmail.mjs`
- `GET /api/health` → `mailResendConfigured: true`

See also: [CLOUDFLARE_EMAIL_AND_ROUTING.md](./CLOUDFLARE_EMAIL_AND_ROUTING.md)
