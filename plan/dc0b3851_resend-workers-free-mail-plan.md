# Resend email integration on Cloudflare Workers Free

**Status:** Plan only (no implementation yet)
**Base:** `origin/main`
**Proposed branch for implementation:** `cursor/resend-workers-free-mail-38e8` (or split per phase, see §5)
**Goal:** Subscriber welcome emails (and other outbound mail) deliver reliably to **any** recipient on the **Workers Free** plan, using Resend as the transport for non-`@lorapok.tech` destinations, with no dependency on Workers Paid or Cloudflare Email Sending domain onboarding.

---

## 0. Current state (verified in code)

`website/admin/functions/api/_shared/mail.js` already has a working Resend REST transport and routing logic:

- `sendViaResend()` (lines ~416–451) — POSTs to `https://api.resend.com/emails` with `Authorization: Bearer ${RESEND_API_KEY}`. Already fetch-based (not `send_email` binding) — the "replace send_email with fetch" instruction is **done**.
- `prefersResendFirst()` (lines ~46–54) — returns `true` for any recipient that is not `@lorapok.tech` (and for `@inbox.testmail.app`) when `RESEND_API_KEY` is set and `resendFirstExternal !== false`. Covered by `website/admin/scripts/mail-resend-routing.test.mjs`.
- `sendMail()` (lines ~455–594) tries transports in this order: Resend-first (if `prefersResendFirst`) → `MAIL_RELAY` service binding → `EMAIL.send` binding → Resend sandbox-fallback → Cloudflare Email REST → Resend fallback (again). Resend is reachable from at least 3 of these branches, so once `RESEND_API_KEY` exists, delivery to external addresses works today without further code changes to the send path itself.
- `getMailTransportStatus()` reports `"resend"` as a valid transport when only `RESEND_API_KEY` is configured (no relay, no `EMAIL` binding, no REST token) — Workers Free is already a supported configuration in the status logic.
- `website/admin/scripts/setup-resend-secret.mjs` syncs `RESEND_API_KEY` (and optional `RESEND_FROM`) to the Pages project (`cursor-monitor-admin`) via `wrangler pages secret put`, pulling the key from the cred vault (`cursor/resend_api_key`) through `envWithCursorCloudflareSecrets()` in `website/admin/scripts/lib/cred-vault-sync.mjs` (line 205, 331).
- `subscribe.ts` (`website/admin/functions/api/subscribe.ts`) calls `sendMail()` and returns **502** with `mailWarning` when `mailResult.sent === false` — this is correct behavior for surfacing delivery failure to the caller, not a bug to "fix," but it means Resend must actually be configured for `/api/subscribe` to succeed for external emails.

**Conclusion: the send-path code is essentially done.** What's missing is entirely operational (secrets, DNS/domain verification, CI wiring) plus two small doc/consistency gaps.

---

## 1. Minimal code changes needed

### Already done (no action)
- `sendViaResend()` fetch implementation.
- `prefersResendFirst()` routing (external-first when Resend configured).
- `setup-resend-secret.mjs` Pages-secret sync script.
- Test coverage for routing logic (`mail-resend-routing.test.mjs`).

### To add (small, targeted)

1. **CI secret sync for `RESEND_API_KEY`** — none exists today (`grep -r RESEND .github/` returns nothing). Add a step in the `deploy-infra` path of `.github/workflows/ci-cd.yml` (near the existing "Setup outbound mail (enable-mail.mjs)" step at ~line 551) that runs `setup-resend-secret.mjs` when a `RESEND_API_KEY` GitHub secret is present, so production Pages always has the current key without a manual `wrangler pages secret put`. Guard it so it's a no-op (warn, don't fail) when the secret isn't set yet, matching the existing `hasEmailToken` pattern in `enable-mail.mjs`.
   - File: `.github/workflows/ci-cd.yml`
   - File: `website/admin/scripts/setup-resend-secret.mjs` — currently reads from cred vault via `envWithCursorCloudflareSecrets(process.env)`; in CI there's no cred vault, so it needs to also accept `RESEND_API_KEY`/`RESEND_FROM` directly from `process.env` (it already does, since `envWithCursorCloudflareSecrets` only *adds* cred-vault values when the env var is absent — verify this by reading `cred-vault-sync.mjs` line 331: `...(loaded.resendApiKey && !baseEnv.RESEND_API_KEY ? ... : {})`, so an existing `process.env.RESEND_API_KEY` already wins). **No code change needed here** — only wire the workflow secret.

2. **`verify-mail-transport.mjs` should recognize Resend as a passing state on Workers Free.** Today it only checks `relayExists` and `restOk` (Cloudflare REST token) and treats "no relay + no REST token" as an error in local (non-CI) runs, only warning in CI. Add a Resend check (`resendConfigured = Boolean(process.env.RESEND_API_KEY)`) so the CI gate doesn't misreport health when Resend is the *intended* primary transport for Workers Free deployments.
   - File: `website/admin/scripts/verify-mail-transport.mjs`

3. **Docs correction** — `docs/guides/CLOUDFLARE_EMAIL_AND_ROUTING.md` §4 "Transport priority" lists Resend as step 3 fallback. Given `resendFirstExternal: true` is the default in `mail-config.js`, Resend is actually the **primary** transport for any non-`@lorapok.tech` recipient (which covers essentially all real subscribers). Update the doc to state:
   - Resend is primary for external recipients when `RESEND_API_KEY` is set (default `resendFirstExternal: true`).
   - Cloudflare relay/REST/binding are for `@lorapok.tech` recipients and as a fallback chain.
   - Workers Free is fully supported via Resend alone — Workers Paid / Email Sending domain onboarding is only needed if you want Cloudflare Email as transport too.
   - File: `docs/guides/CLOUDFLARE_EMAIL_AND_ROUTING.md`

4. **Optional hardening (not required for the goal, but cheap):** `sendViaResend()` currently does not set/require a verified sending domain — if `RESEND_FROM` isn't set it falls back to `from.email` (`cursor.monitor@lorapok.tech`). Once `lorapok.tech` is verified in Resend (step 2 below), no code change is needed; the existing `resendFrom` resolution in `mail.js` (~line 422–426) already does the right thing. Flag this explicitly in the doc so nobody assumes Resend's shared `onboarding@resend.dev` sender is what's used in production.

No changes are needed to `subscribe.ts`, `mail-config.js`, `mail-normalize.js`, or the routing logic in `mail.js` itself.

---

## 2. Operational steps (secrets, DNS, deploy)

These are the concrete actions outside of code, in order:

1. **Rotate the exposed Resend API key** (already flagged to the user as a prerequisite):
   - Resend dashboard → API Keys → revoke the exposed key → create a new one.
   - Update the cred vault entry: `cursor/resend_api_key` (used by `cred-vault-sync.mjs`).

2. **Verify `lorapok.tech` in Resend** (Resend dashboard → Domains → Add Domain):
   - Add the DNS records Resend provides (SPF/DKIM `TXT`, and a `DMARC` record if desired) to the `lorapok.tech` zone in Cloudflare DNS.
   - Wait for Resend to show the domain as **Verified** (DNS propagation, usually minutes).
   - This lets `RESEND_FROM` (or the default `cursor.monitor@lorapok.tech`) send without landing in spam / being rejected for an unverified sender.

3. **Set `RESEND_API_KEY` as a Pages secret** (production):
   ```bash
   cd website/admin
   export RESEND_API_KEY="re_..."         # the new, rotated key
   export RESEND_FROM="Cursor Curse Monitor <cursor.monitor@lorapok.tech>"  # optional; matches existing default
   npx wrangler login                     # one-time, if not already authenticated
   node scripts/setup-resend-secret.mjs
   ```
   This puts `RESEND_API_KEY` (and `RESEND_FROM` if set) on the `cursor-monitor-admin` Pages project via `wrangler pages secret put`.

4. **Sync `RESEND_API_KEY` to GitHub Actions** (for the CI step added in §1.1):
   ```bash
   gh secret set RESEND_API_KEY --env admin-production --body "$(cred get cursor resend_api_key)"
   ```

5. **Deploy admin** so the new secret takes effect (Pages secrets require a redeploy to be picked up by new Functions invocations in some Cloudflare configurations — confirm via the health check in §4):
   ```bash
   node scripts/repair-mail.mjs        # full: enable-mail + build + deploy + verify
   # or, if mail transport is already otherwise fine and you just need the secret live:
   npm run admin:deploy:fast --prefix website/admin
   ```

6. **No `send_email` binding / Email Sending domain onboarding is required** for this goal. `ccm-mail-relay`'s `send_email` binding stays as-is for `@lorapok.tech`-to-verified-destination sends (e.g. ops BCC to `lorapokdev@gmail.com`); it's irrelevant to the Workers Free constraint being solved here, since Resend bypasses the Workers Free sandbox entirely via plain `fetch`.

---

## 3. Specific files to modify

| File | Change |
|---|---|
| `.github/workflows/ci-cd.yml` | Add a `RESEND_API_KEY` secret-sync step (calls `setup-resend-secret.mjs`) in the `deploy-infra` job, guarded to no-op when the secret isn't set. |
| `website/admin/scripts/verify-mail-transport.mjs` | Add `resendConfigured` check so CI mail-health gate recognizes Resend-only (Workers Free) as a valid, passing configuration. |
| `docs/guides/CLOUDFLARE_EMAIL_AND_ROUTING.md` | Correct §4 transport priority to show Resend as primary for external recipients (matches `resendFirstExternal: true` default); add a short "Workers Free" callout. |
| *(no change)* `website/admin/functions/api/_shared/mail.js` | Send path already correct. |
| *(no change)* `website/admin/functions/api/subscribe.ts` | 502-on-failure behavior is correct; will start returning 200 once Resend is configured for external emails. |
| *(no change)* `website/admin/scripts/setup-resend-secret.mjs` | Already environment-var-first; works in CI once the GitHub secret is set. |

---

## 4. Test plan

### 4a. Unit / existing automated tests (run first, no network)
```bash
cd website/admin
node scripts/mail-resend-routing.test.mjs   # prefersResendFirst() behavior
npx vitest run src/__tests__/mail-config-api.test.ts
```
Expect both to pass unchanged — this plan doesn't touch `prefersResendFirst()`.

### 4b. Local secret + transport verification (requires rotated key)
```bash
cd website/admin
export RESEND_API_KEY="re_..."
node scripts/verify-mail-setup.mjs          # probes email token config (existing)
```

### 4c. Production end-to-end — the definitive proof for "subscriber emails work on Workers Free"
1. After deploying with `RESEND_API_KEY` set (§2 step 5), open Mission Control → Mailbox → **Send branded test email** to a real external inbox (Gmail). Confirm delivery and check `getMailTransportStatus()` / mailbox record shows `transport: "resend"`.
2. Run the testmail.app E2E probe (this is the strongest automated proof since it's a real external, non-`@lorapok.tech` address and polls for actual delivery):
   ```bash
   export TESTMAIL_API_KEY="..."
   export TESTMAIL_NAMESPACE="61z27"
   node website/admin/scripts/probe-subscribe-testmail.mjs
   ```
   Expected: subscribe call returns `{ ok: true, emailed: true }`, and the script prints the received welcome email's From/Subject once Resend delivers it.
3. Directly exercise `POST /api/subscribe` against production with a disposable external email and confirm `200 { ok: true, emailed: true }` (previously this would 502 for non-`@lorapok.tech` addresses without Resend, or succeed only for verified Gmail destinations via the Cloudflare sandbox).
4. Negative check: temporarily confirm behavior is unaffected for `@lorapok.tech` addresses (should still prefer Cloudflare relay/REST, not Resend, per `prefersResendFirst()` returning `false` for that domain).

### 4d. CI verification
- Run `workflow_dispatch` → `deploy-infra` (Deploy Mission Control checked) once the `RESEND_API_KEY` GitHub secret is set, and confirm the new sync step succeeds and `verify-mail-transport.mjs` reports Resend as configured.

---

## 5. Recommended branch approach

This is operationally low-risk (mail transport, additive routing already exists) but touches CI (`ci-cd.yml`) and docs. Given the governance-scope rule that workflow/CI changes are high-risk, split into two small, independently-reviewable branches rather than one bundled change:

1. **`cursor/resend-workers-free-mail-38e8`** — code + CI:
   - `verify-mail-transport.mjs` Resend-awareness change.
   - `ci-cd.yml` secret-sync step for `RESEND_API_KEY`.
   - Rationale: these are mechanically simple, testable independently of secrets being live yet (the CI step should be safe to merge even before the GitHub secret exists, since it's guarded to warn-not-fail).

2. **`cursor/resend-mail-docs-38e8`** (or fold into the same PR if reviewers prefer one PR) — docs-only:
   - `docs/guides/CLOUDFLARE_EMAIL_AND_ROUTING.md` transport-priority correction.
   - Rationale: doc-only changes are zero-risk and can land independently/faster; separating avoids blocking the CI change on doc wordsmithing review.

Operational steps in §2 (key rotation, domain verification, Pages secret, GitHub secret, deploy) are **not code changes** and should be done directly against production/cred-vault/GitHub settings — they don't need a branch, but should be sequenced *before* merging the CI branch's secret-sync step is exercised for real (the step itself is safe to merge before the secret exists; it just won't do anything until the secret is set).

Do not touch `ccm-mail-relay`'s `send_email` binding or attempt Workers Paid upgrade / Email Sending domain onboarding — out of scope and unnecessary for this goal.
