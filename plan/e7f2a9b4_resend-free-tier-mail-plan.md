# Resend outbound mail on Workers Free

**Status:** Plan (ready to implement)  
**Base branch:** `main` (or continue on `cursor/deploy-granular-stats-mail-329a` if bundling with PR #115)  
**Proposed branch:** `cursor/resend-workers-free-mail-329a`  
**Goal:** Subscriber welcome emails and other outbound mail deliver to arbitrary external inboxes on Cloudflare Workers Free, using Resend via `fetch()` — no Workers Paid upgrade required.

---

## 1. Problem

Cloudflare Email Sending on Workers Free only delivers to **verified destination addresses**, not arbitrary subscribers. The `ccm-mail-relay` worker (`send_email` binding) inherits this sandbox limit. testmail.app is inbound-only and cannot send to real users.

**Resend** (3,000 emails/month free) is the correct transport for external recipients.

---

## 2. Current state (already implemented)

The send path does **not** need a new `sendEmail()` helper — it exists.

| Capability | Location | Status |
|---|---|---|
| Resend `fetch()` transport | `website/admin/functions/api/_shared/mail.js` → `sendViaResend()` | ✅ Done |
| External-first routing | `prefersResendFirst()` + default `resendFirstExternal: true` in `mail-config.js` | ✅ Done |
| Sandbox → Resend fallback | `sendMail()` when relay returns verified-destination error | ✅ Done |
| Pages secret sync script | `website/admin/scripts/setup-resend-secret.mjs` | ✅ Done |
| Cred vault key | `cursor/resend_api_key` via `cred-vault-sync.mjs` | ✅ Wired |
| Routing unit tests | `website/admin/scripts/mail-resend-routing.test.mjs` | ✅ Done |

**Transport order today** (for a Gmail subscriber when `RESEND_API_KEY` is set):

1. Resend (primary — `prefersResendFirst`)
2. `MAIL_RELAY` → `ccm-mail-relay` (skipped if Resend succeeded)
3. Cloudflare REST / binding fallbacks
4. Resend again on sandbox errors

**What's broken in production:** `RESEND_API_KEY` is likely not set on Pages, and/or `lorapok.tech` is not verified in Resend. Docs incorrectly list Resend as step-3 fallback. CI does not sync Resend secrets and `verify-mail-transport.mjs` treats Resend-only config as failure.

---

## 3. Recommended implementation (minimal diff)

### 3.1 Code + CI (one branch)

| File | Change |
|---|---|
| `.github/workflows/ci-cd.yml` | In `deploy-infra` job, after `enable-mail.mjs`, add guarded step: run `node website/admin/scripts/setup-resend-secret.mjs` when `secrets.RESEND_API_KEY` is set. Warn and continue if absent (same pattern as optional email token). |
| `website/admin/scripts/verify-mail-transport.mjs` | Treat `RESEND_API_KEY` as a valid passing transport. Exit 0 when `resendConfigured` even if relay missing and REST token absent. Emit `resend_configured` GitHub output. |
| `website/admin/scripts/repair-mail.mjs` | Optional: call `setup-resend-secret.mjs` when cred vault has `resend_api_key` (keeps local repair path in sync). |
| `website/admin/functions/api/_shared/mail-sync.js` | Strengthen recommendation when `!resendConfigured` — mention Workers Free explicitly. |
| `website/admin/src/components/ui/MailTransportCard.tsx` | Show `mailResendConfigured` badge/hint from status API (surface Resend readiness in admin UI). |

**No changes needed:** `mail.js`, `subscribe.ts`, `mailbox.ts`, `setup-resend-secret.mjs` send logic.

### 3.2 Docs (same PR or follow-up)

| File | Change |
|---|---|
| `docs/guides/CLOUDFLARE_EMAIL_AND_ROUTING.md` | §4: Resend is **primary for external recipients** when `RESEND_API_KEY` is set. Workers Free supported via Resend alone. Keep relay for `@lorapok.tech` / ops BCC. |
| `website/admin/README.md` | Add Resend setup quickstart (rotate key → verify domain → `setup-resend-secret.mjs` → redeploy). |
| `DEPLOYMENT.md` | Cross-link Resend free-tier path. |

### 3.3 Operational (no branch — do before/after deploy)

1. **Rotate** the exposed Resend API key in Resend dashboard.
2. **Update cred vault:** `cursor/resend_api_key` with new key.
3. **Verify domain** in Resend → add SPF/DKIM DNS records to `lorapok.tech` (DNS only / grey cloud).
4. **Set Pages secrets:**
   ```bash
   cd website/admin
   export RESEND_API_KEY="re_..."   # rotated key
   export RESEND_FROM="Cursor Curse Monitor <cursor.monitor@lorapok.tech>"
   node scripts/setup-resend-secret.mjs
   ```
5. **Set GitHub secret** (for CI sync):
   ```bash
   gh secret set RESEND_API_KEY --env admin-production --body "$(cred get cursor resend_api_key)"
   ```
6. **Redeploy** admin (`repair-mail.mjs` or `npm run admin:deploy:fast`).

---

## 4. Verification

### Automated (run in CI / locally)

```bash
node website/admin/scripts/mail-resend-routing.test.mjs
cd website/admin && npm test   # vitest including mail-config-api.test.ts
node website/admin/scripts/verify-mail-transport.mjs   # after adding Resend check
```

### Production E2E (definitive proof)

1. **Health:** `GET /api/health` → `mailResendConfigured: true`, subscribe welcome succeeds.
2. **Mailbox test:** Mission Control → Mailbox → Send branded test to Gmail → transport `resend`.
3. **Subscribe probe:**
   ```bash
   node website/admin/scripts/probe-subscribe-testmail.mjs
   ```
   Expect `{ ok: true, emailed: true }` and inbox delivery.
4. **Live subscribe:** `POST /api/subscribe` with external email → `200` (not `502 mailWarning`).
5. **Negative:** `@lorapok.tech` recipient should **not** use Resend first (`prefersResendFirst` returns false).

---

## 5. Branch strategy

| Option | When |
|---|---|
| **`cursor/resend-workers-free-mail-329a`** (recommended) | Dedicated mail PR — clean review, CI change isolated |
| Same as PR #115 branch | If user wants one deploy; acceptable since changes are small |

Do **not** remove `ccm-mail-relay` or `send_email` binding — still useful for `@lorapok.tech` and ops BCC on verified destinations.

---

## 6. Out of scope

- Workers Paid upgrade / Cloudflare Email Sending domain onboarding (not required for subscriber mail)
- Replacing testmail.app (stays as inbound E2E probe only)
- New third-party providers (Brevo, Mailgun, etc.)
- Wiring `buildInviteHtml` / dead `/api/admins/invite` route (separate cleanup)

---

## 7. Implementation order

1. Operational: rotate key + verify `lorapok.tech` in Resend (can start in parallel)
2. Code: `verify-mail-transport.mjs` + `ci-cd.yml` Resend sync step
3. UI/docs polish
4. Deploy + run E2E probes
5. Mark PR ready after health + testmail pass
