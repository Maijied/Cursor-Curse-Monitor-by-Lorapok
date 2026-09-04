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
| **Sending domain** | Domain verified in Resend (default `mail.lorapok.tech`) |
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

## 2. Verify `mail.lorapok.tech` in Resend

1. [Resend → Domains](https://resend.com/domains) → **Add Domain** → `mail.lorapok.tech`
2. Add DNS records in **Cloudflare** for zone `lorapok.tech` (DNS only / grey cloud — not proxied)
3. Click **Verify** in Resend (usually 1–5 minutes)
4. In Mission Control → Settings → Resend, set **Sending domain** to `mail.lorapok.tech` and enable **Resend domain verified**

### Cloudflare DNS records (exact)

Zone: **lorapok.tech** → DNS → Records → Add record.

| Step | Type | Name (Cloudflare) | Content / Target | Priority | Proxy |
|------|------|-------------------|------------------|----------|-------|
| 1 DKIM | TXT | `resend._domainkey.mail` | `p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQC05QD+Yq0y/5sStusbuo15ULIp5Xuqmqdfn583/+Zlpmgv7VUWV2jlsrQLL60s1xBG/K40zK2wrsSnp5CibJAEX0PlUuTMKENi6qP0qFDHsQC2RCgHiVnZkUeI06wU8XY9Vr074OqV8ALZcocgbso7EbitqzZBK3qKmBEs4fSHSQIDAQAB` | — | DNS only |
| 2 SPF MX | MX | `send.mail` | `feedback-smtp.eu-west-1.amazonses.com` | 10 | DNS only |
| 3 SPF TXT | TXT | `send.mail` | `v=spf1 include:amazonses.com ~all` | — | DNS only |
| 4 Inbound MX | MX | `mail` | `inbound-smtp.eu-west-1.amazonaws.com` | 10 | DNS only |

**Possible conflicts**

- Existing **TXT** on `resend._domainkey.mail` — keep only Resend’s DKIM value.
- Existing **TXT or MX** on `send.mail` — merge or replace with Resend SPF records (one MX + one TXT per name).
- **A/CNAME** on `mail` for a website is fine alongside these records (different types).

---

## 2b. (Alternate) Verify `cursor.lorapok.tech` in Resend

Use if you send from `@cursor.lorapok.tech` instead of `@mail.lorapok.tech`:

1. [Resend → Domains](https://resend.com/domains) → **Add Domain** → `cursor.lorapok.tech`
2. Add DNS records in **Cloudflare** for zone `lorapok.tech` (DNS only / grey cloud — not proxied)
3. Click **Verify** in Resend (usually 1–5 minutes)
4. In Mission Control → Settings → Resend, set **Sending domain** to `cursor.lorapok.tech` and enable **Resend domain verified**

### Cloudflare DNS records (exact)

Zone: **lorapok.tech** → DNS → Records → Add record.

| Step | Type | Name (Cloudflare) | Content / Target | Priority | Proxy |
|------|------|-------------------|------------------|----------|-------|
| 1 DKIM | TXT | `resend._domainkey.cursor` | `p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDTDnNSo2hzJJaFTasP58CjPvwmY4MqupMTHY8ygvqFdmMCzg2dVchGNMM8Se0vQE7Re/wCKa/CxWTpi3xVqe4y3WlhNAMfRbwN7Q4bSk62/tdKV6QlMRk1KVERI7JJHMd4G1VMWxPAP9Za8fOpT2JsjlvPvzvRqsRKALYPxYwOWQIDAQAB` | — | DNS only |
| 2 SPF MX | MX | `send.cursor` | `feedback-smtp.ap-northeast-1.amazonses.com` | 10 | DNS only |
| 3 SPF TXT | TXT | `send.cursor` | `v=spf1 include:amazonses.com ~all` | — | DNS only |
| 4 Inbound MX | MX | `cursor` | `inbound-smtp.ap-northeast-1.amazonaws.com` | 10 | DNS only |

**Possible conflicts**

- Existing **TXT** on `resend._domainkey.cursor` or **TXT/MX** on `send.cursor` — edit to match Resend or remove duplicates.
- Existing **MX** on name `cursor` — only one MX set per host; merge or replace with Resend inbound if you need receiving on this subdomain.
- **A/CNAME** on `cursor` for the marketing site is fine alongside these MX/TXT records (different types).

---

## 2b. (Legacy) Verify `lorapok.tech` in Resend

Use only if you send from `@lorapok.tech` instead of `@cursor.lorapok.tech`:

1. [Resend → Domains](https://resend.com/domains) → **Add Domain** → `lorapok.tech`
2. Add DNS records in Cloudflare (DNS only / grey cloud)
3. Click **Verify** in Resend (usually 1–5 minutes)
4. In Mission Control → Settings, enable **Resend domain verified**

---

## 3. Sync secrets to Pages

```bash
cd website/admin
export RESEND_API_KEY="re_..."
export RESEND_FROM="Cursor Curse Monitor <cursor.monitor@mail.lorapok.tech>"
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
