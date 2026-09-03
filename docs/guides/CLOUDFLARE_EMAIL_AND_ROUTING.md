# Cloudflare Email: Routing + Sending (CCM / Mission Control)

Blueprint for AI agents and developers configuring **inbound** Email Routing and **outbound** Email Sending for Cursor Curse Monitor on `lorapok.tech`.

For a generic inbound-only REST script (`email-manager.js`), see the Lorapok Loragent guide at `loragent/docs/guides/CLOUDFLARE_EMAIL_ROUTING_SETUP.md`. This project uses **wrangler-based scripts** and adds Mission Control outbound mail.

---

## 1. Architecture (two halves)

```
INBOUND — Email Routing (receive @lorapok.tech)
  external sender → MX (Cloudflare) → routing rule → lorapokdev@gmail.com

OUTBOUND — Email Sending (Mission Control sends mail)
  subscribe / notice / compose / test
        → ccm-mail-relay Worker (MAIL_RELAY binding)  [preferred]
        → or Cloudflare Email REST (CLOUDFLARE_EMAIL_API_TOKEN)
        → From: cursor.monitor@ / cursor.curse.help@
        → BCC: lorapokdev@gmail.com
```

| Address | Role |
|---------|------|
| `cursor.monitor@lorapok.tech` | Product mail (subscribe, notices, compose) |
| `cursor.curse.help@lorapok.tech` | Help / support replies |
| `lorapokdev@gmail.com` | Ops inbox — inbound forward target + outbound BCC |

Code constants: `website/admin/functions/api/_shared/mail-addresses.js`.

---

## 2. One-time Cloudflare dashboard prerequisites

1. **Email Routing** on `lorapok.tech` — enable in Dashboard → Email → Email Routing (MX + SPF records).
2. **Destination address** — verify `lorapokdev@gmail.com` under Destination addresses.
3. **Email Sending** — onboard `lorapok.tech` under Email → Email Sending.
4. **API tokens** (credential split — never use one token for everything):

| Secret / env | Permission | Used for |
|--------------|------------|----------|
| `CLOUDFLARE_API_TOKEN` | Account Workers + Pages Edit | `wrangler deploy` only |
| `CLOUDFLARE_EMAIL_API_TOKEN` | Account Email Sending → Edit | REST fallback + Pages secret |
| `CLOUDFLARE_ACCOUNT_ID` | — | Lorapok Facility account |

Load from cred vault (do not paste secrets in chat):

```bash
export CLOUDFLARE_API_TOKEN="$(cred get cursor cloudflare_api_token)"
export CLOUDFLARE_EMAIL_API_TOKEN="$(cred get cursor cloudflare_email_api_token)"
export CLOUDFLARE_ACCOUNT_ID="$(cred get cursor cloudflare_account_id)"
```

Sync to GitHub `admin-production` once:

```bash
gh secret set CLOUDFLARE_EMAIL_API_TOKEN --env admin-production \
  --body "$(cred get cursor cloudflare_email_api_token)"
```

---

## 3. Inbound routing (forward to ops inbox)

**Script:** `website/admin/scripts/setup-email-addresses.mjs`

Uses wrangler (not raw REST) to enable Sending + Routing, verify the ops inbox, and create forward rules for both CCM addresses.

```bash
cd website/admin
export CLOUDFLARE_API_TOKEN="..."   # Email Sending + Email Routing Edit
export CLOUDFLARE_ACCOUNT_ID="f049faaf2f67549f5c58837479596a4a"
export CCM_OPS_INBOX="lorapokdev@gmail.com"   # optional override
node scripts/setup-email-addresses.mjs
```

Equivalent Loragent REST flow: `POST /zones/{zone_id}/email/routing/rules` with matcher `{ type: "literal", field: "to", value: "cursor.monitor@lorapok.tech" }` and action `{ type: "forward", value: ["lorapokdev@gmail.com"] }`.

**Verify:** send a test message from Gmail to `cursor.curse.help@lorapok.tech` and confirm it arrives at the ops inbox.

---

## 4. Outbound sending (Mission Control)

**Transport priority** (see `website/admin/functions/api/_shared/mail.js`):

### Workers Free (recommended: Resend)

Cloudflare Email Sending on **Workers Free** only delivers to [verified destination addresses](https://developers.cloudflare.com/email-service/platform/limits/#verified-destination-addresses), not arbitrary subscribers. Use **Resend** for external mail:

1. Verify `lorapok.tech` in [Resend → Domains](https://resend.com/domains) (SPF/DKIM DNS in Cloudflare).
2. Set Pages secrets: `node website/admin/scripts/setup-resend-secret.mjs` (reads cred vault `cursor/resend_api_key`).
3. Keep **Resend-first for external recipients** enabled in Mission Control mail settings (default).

When `RESEND_API_KEY` is set, `sendMail()` uses Resend **first** for any non-`@lorapok.tech` recipient (subscribers, Gmail tests, testmail.app).

### Full transport cascade

1. **Resend** (`RESEND_API_KEY`) — primary for external recipients when `resendFirstExternal` is true (default)
2. `ccm-mail-relay` Worker via Pages `MAIL_RELAY` service binding — `@lorapok.tech` and fallback
3. Cloudflare Email REST API (`CLOUDFLARE_EMAIL_API_TOKEN`)
4. Resend again on sandbox / verified-destination errors

### Local / repair (full stack)

```bash
node website/admin/scripts/repair-mail.mjs
```

Steps: `enable-mail.mjs` → build admin → `wrangler pages deploy` → `verify-mail-setup.mjs`.

### Fast deploy (no mail API calls — ~1–3 min)

When you only need a UI/API deploy and mail is already configured:

```bash
npm run admin:deploy:fast
# or: node website/admin/scripts/deploy-pages-fast.mjs
```

### Enable mail only (relay worker + Pages email secret)

```bash
node website/admin/scripts/enable-mail.mjs
node website/admin/scripts/verify-mail-transport.mjs
```

**Verify in prod:** Mission Control → Mailbox → **Send branded test email**.

---

## 5. CI/CD behavior (`.github/workflows/ci-cd.yml`)

Routine **push to `main`** is optimized to avoid slow Cloudflare mail API work:

| Step | Push to `main` | `workflow_dispatch` deploy-infra |
|------|----------------|----------------------------------|
| `enable-mail.mjs` | Skipped | Runs |
| `verify-mail-transport.mjs` | Skipped | Runs after enable-mail |
| Pre-deploy cooldown | 0s (no mail APIs hit) | 90s when mail setup ran |
| Pages deploy | Only if Mission Control paths changed | When `deploy_admin` is true |
| Stats cron worker | Skipped on push | Runs after successful Pages deploy |

**When mail breaks in production:** run `workflow_dispatch` → **deploy-infra** with **Deploy Mission Control** checked, or locally:

```bash
node website/admin/scripts/repair-mail.mjs
```

**Path gate:** pushes that only touch the IDE extension, browser extension, or docs skip the Cloudflare Pages deploy job entirely.

---

## 6. Script reference

| Script | Purpose |
|--------|---------|
| `setup-email-addresses.mjs` | One-time inbound routes + domain enable |
| `enable-mail.mjs` | Relay worker + Pages `CLOUDFLARE_EMAIL_API_TOKEN` secret |
| `verify-mail-transport.mjs` | CI gate: relay and/or REST must work |
| `repair-mail.mjs` | Full local repair (enable + build + deploy + verify) |
| `deploy-pages-fast.mjs` | Fast Pages deploy without mail setup |
| `deploy-pages-ci.mjs` | CI Pages deploy with rate-limit retries |
| `sync-mail-on-main.mjs` | Local vault → secrets + enable + verify |
| `verify-mail-setup.mjs` | Probe email token only |

See also: [RESEND_WORKERS_FREE_SETUP.md](./RESEND_WORKERS_FREE_SETUP.md) · [Mailbox and Email](../wiki/Mailbox-and-Email.md)

---

## 7. Troubleshooting

| Symptom | Fix |
|---------|-----|
| HTTP 401 on send | Refresh `CLOUDFLARE_EMAIL_API_TOKEN`; redeploy Pages |
| Code 10203 | Enable Email Sending; onboard `lorapok.tech` |
| Health shows `cloudflare-rest` + 401 | `MAIL_RELAY` missing on Pages — run `repair-mail.mjs` or **deploy-infra** (do not add binding manually; `wrangler.toml` `[[services]]` applies it on deploy) |
| CI slow / rate limited | Use push for code-only changes; use deploy-infra for mail |
| `9109` / `10000` on Pages deploy | `CLOUDFLARE_API_TOKEN` in admin-production is invalid or lacks Pages Edit — refresh secret, rerun deploy-infra |
| Job waits 3–7 min then fails auth | Old behavior retried bad tokens; update to latest CI (fail-fast probe) |
| Inbound not arriving | Re-run `setup-email-addresses.mjs`; confirm destination verified |
| `destination address is not a verified address` | **Workers Free** only sends to [verified destination addresses](https://developers.cloudflare.com/email-service/platform/limits/#verified-destination-addresses). Upgrade **Lorapok Facility** → Workers **Paid** ($5/mo), then **Email Service → Email Sending → Onboard Domain** for `lorapok.tech`. Or set `RESEND_API_KEY` on Pages as fallback. |
| Wrangler `email sending enable` → `2036 Unauthorized` | Same as above — Email Sending subdomains API requires Workers Paid before onboarding. |

---

## 8. E2E subscribe testing with testmail.app

[testmail.app](https://testmail.app/) receives mail at `{namespace}.{tag}@inbox.testmail.app` and exposes a JSON API to poll inboxes — useful for automated welcome-email checks. It does **not** send mail; CCM still uses Cloudflare/Resend for outbound.

### Console setup (Lorapok Labs)

1. Sign in at [testmail.app/console](https://testmail.app/console/).
2. Note your **namespace** (e.g. `61z27`) — addresses look like `61z27.{tag}@inbox.testmail.app`.
3. **API Keys** → create or copy key → store locally (never commit):

```bash
export TESTMAIL_API_KEY="..."          # from console → Copy API key
export TESTMAIL_NAMESPACE="61z27"      # your namespace id
```

Optional cred vault keys: `testmail_api_key`, `testmail_namespace` (sync: `npm run mail:sync-testmail-vault --prefix website/admin`).

### Manual check

1. Subscribe on the site (or `POST /api/subscribe`) using e.g. `61z27.manual-test@inbox.testmail.app`.
2. In the console, open **View Emails (JSON)** or use the [JSON API](https://testmail.app/docs/) with `&tag=manual-test`.

### Automated probe

Requires outbound mail to external addresses (**Resend** or Workers Paid):

```bash
npm run mail:testmail --prefix website/admin
# or: node website/admin/scripts/probe-subscribe-testmail.mjs
```

The script subscribes with a unique tag, polls `https://api.testmail.app/api/json` with `livequery=true`, and prints From/Subject when the welcome email arrives.

Against local dev API (no real send):

```bash
SUBSCRIBE_URL=http://127.0.0.1:5173/api/subscribe npm run dev   # separate terminal
# vitest already covers dev mailbox: website/admin/src/__tests__/subscribe-api.test.ts
```
