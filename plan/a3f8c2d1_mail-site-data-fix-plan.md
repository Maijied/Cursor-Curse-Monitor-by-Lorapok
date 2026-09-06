# Mail delivery + site-data staleness fix plan

**Status:** Plan (ready to implement)  
**Branch:** `cursor/mail-site-data-fix-1244` (off `main`)  
**Goal:** Fix outbound mail to external subscribers and eliminate stale/wrong KPIs across Mission Control pages — with minimal, test-backed code changes plus one operational deploy.

---

## 1. Problem summary

### Mail (credentials set, sends still fail)

CI deploy-infra run `34053102903` shows transport *configured* (relay exists, email token probes OK, `RESEND_API_KEY` synced). Runtime failures come from:

| Gap | Effect |
|-----|--------|
| `enable-mail.mjs` skips `CLOUDFLARE_EMAIL_API_TOKEN` Pages secret when relay exists | REST fallback unavailable if `MAIL_RELAY` binding fails at runtime |
| `sendViaResend()` falls back to `cursor.monitor@lorapok.tech` when `RESEND_FROM` unset | Resend rejects — verified domain is `mail.lorapok.tech`, not apex |
| `resendDomainVerified` defaults `false` in KV | UI warnings; operators think mail is broken even when keys exist |
| Workers Free sandbox on Cloudflare relay | External Gmail only works via Resend path |

### Site-data (multiple pages show old numbers)

| Gap | Effect |
|-----|--------|
| `fetchSiteData()` proxies `https://cursor.lorapok.tech/site-data.json` (GitHub Pages) | Base data stuck at v1.0.125 while marketplace is v1.0.132 |
| Marketing site deploy skipped on push to `main` | `SITE_DATA_URL` never refreshes unless `deploy_website` workflow_dispatch |
| KV stats cache empty/stale when stats-cron not deployed | `mergeSiteDataWithLiveCache` has nothing to overlay |
| `admin-deploy-gate` skips deploy when paths unchanged | Release-only bumps don't redeploy admin with fresh baked `site-data.json` |

---

## 2. Recommended approach (single PR)

Two code tracks in one branch — mail runtime correctness + site-data self-heal. No architectural rewrites.

### Track A — Mail (3 code changes + 1 script)

#### A1. Always sync email token to Pages (`enable-mail.mjs`)

**File:** `website/admin/scripts/enable-mail.mjs` (~lines 161–186)

**Change:** Remove the `if (inCi && relayExists)` skip. When `hasEmailToken && restSynced`, always run `wrangler pages secret put CLOUDFLARE_EMAIL_API_TOKEN`.

**Rationale:** Relay existence ≠ Pages secret present. REST is required fallback. `repair-mail.mjs` delegates here — one fix covers CI + local.

#### A2. Derive Resend From from `sendingDomain` (`mail.js`)

**File:** `website/admin/functions/api/_shared/mail.js` → `sendViaResend()`

**Change:** Add helper `resolveResendFromAddress(from, mailConfig, env)`:

```js
// Priority: env RESEND_FROM → KV resendFromOverride → domain-aligned default
// When from.email ends with @lorapok.tech and sendingDomain is mail.lorapok.tech:
//   "Name <local-part@mail.lorapok.tech>"
```

Only rewrite apex `@lorapok.tech` addresses to `@${sendingDomain}`; leave other domains untouched.

**Rationale:** Fixes Resend 403 without requiring manual `RESEND_FROM` for every deploy. Matches `DEFAULT_MAIL_CONFIG.sendingDomain`.

#### A3. Default `RESEND_FROM` in setup script (`setup-resend-secret.mjs`)

**File:** `website/admin/scripts/setup-resend-secret.mjs`

**Change:** When `RESEND_FROM` env/cred vault empty, default to:

```
Cursor Curse Monitor <cursor.monitor@mail.lorapok.tech>
```

Always call `putSecret("RESEND_FROM", resendFrom)` (not only when env set).

#### A4. Auto-sync `resendDomainVerified` in deploy-infra (CI only)

**File:** `.github/workflows/ci-cd.yml` — after `setup-resend-secret.mjs` step

**Change:** Add guarded step:

```yaml
- name: Verify Resend domain and sync KV flag
  if: github.event_name == 'workflow_dispatch' && steps.mail_setup.outcome == 'success'
  continue-on-error: true
  working-directory: website/admin
  run: node scripts/verify-resend-domain.mjs --verify --sync-kv
```

Clears false "domain not verified" UI state when DNS is actually good.

---

### Track B — Site-data (2 code changes + 1 CI tweak)

#### B1. Self-heal stale cache on read (`stats-refresh.js`)

**File:** `website/admin/functions/api/_shared/stats-refresh.js` → `fetchSiteDataWithLiveCache()`

**Change:**

1. After loading `[base, cache]`, if cache is null **or** `refreshedAt` older than 60 minutes:
   - Run lightweight on-demand refresh: `fetchLiveChannels(base, { githubToken })` only (no full KV write if quota paused).
   - Build ephemeral overlay `{ channels, refreshedAt: now }` and merge.
2. If merged `packageVersion` from cache channels is newer than base `packageVersion`, prefer channel version for display fields.

**Guardrails:**
- Do not write KV when `isKvWritesPaused()` — read-path overlay only.
- Cap on-demand fetch at once per request (no recursive refresh).
- Existing `runStatsRefresh` cron path unchanged.

**Rationale:** Mission Control KPIs correct even when GitHub Pages `site-data.json` lags and KV cache is cold.

#### B2. Cache-bust client fetch (`useSiteData.ts`)

**File:** `website/admin/src/hooks/useSiteData.ts`

**Change:** Append `?t=${Date.now()}` only on manual `refresh()` calls; keep poll interval using plain `/api/site-data` (server sets `Cache-Control: max-age=60`).

#### B3. Trigger stats refresh after admin deploy (CI)

**File:** `.github/workflows/ci-cd.yml` — `admin-deploy` job, after successful Pages deploy

**Change:** Add step (continue-on-error):

```yaml
- name: Ping stats refresh after deploy
  if: steps.pages_deploy.outcome == 'success'
  run: |
    curl -fsS -X POST "${{ secrets.ADMIN_PUBLIC_URL || 'https://cursor-dev.lorapok.tech' }}/api/cron/stats-refresh" \
      -H "X-Cron-Secret: ${CRON_SECRET}" || true
```

Populates KV immediately after deploy so Connected Services / Overview show fresh totals.

**Optional follow-up (out of scope for minimal PR):** Broaden `admin-deploy-gate` to trigger on release workflow outputs — defer unless still stale after B1.

---

## 3. Tests to add/update

| Test file | What to cover |
|-----------|---------------|
| `website/admin/scripts/mail-resend-routing.test.mjs` | Import + test `resolveResendFromAddress` (or extract to `mail-resend-from.mjs` for testability): apex → subdomain rewrite |
| `website/admin/functions/api/_shared/stats-refresh.test.mjs` | `fetchSiteDataWithLiveCache` with null cache triggers channel overlay; stale cache (>60m) triggers overlay |
| `website/admin/scripts/verify-mail-transport.test.mjs` | No change expected (transport gate already passes relay+resend) |

Run before PR:

```bash
node website/admin/scripts/mail-resend-routing.test.mjs
node website/admin/functions/api/_shared/stats-refresh.test.mjs
cd website/admin && npm test
npm test   # root suite includes mail-setup-instructions, verify-mail-transport
```

---

## 4. Operational steps (after code merge)

Execute on machine with cred vault — **not** in cloud agent VM.

```bash
# 1. Verify Resend domain
cd website/admin
node scripts/verify-resend-domain.mjs --verify --sync-kv

# 2. Full mail repair (forces Pages secrets + deploy)
cd ../..
node website/admin/scripts/repair-mail.mjs

# 3. Refresh marketing site-data (fixes SITE_DATA_URL source)
npm run site:data && npm run site:seo

# 4. Deploy marketing + admin via workflow_dispatch → deploy-infra
#    (Deploy Mission Control + Deploy website checked)
```

Or from Mission Control: **Mailbox → Sync up** (dispatches deploy-infra).

---

## 5. Verification (success criteria)

### Mail

| Check | Expected |
|-------|----------|
| `GET /api/health` | `mailConfigured: true`, `mailResendConfigured: true`, `mailRelayBound: true` |
| `GET /api/integrations/mail/status` | `identities.resendDomainVerified: true`, `transport.configured: true` |
| Mailbox → branded test → external Gmail | `transport: resend`, inbox delivery |
| `POST /api/subscribe` probe | `emailed: true`, no `mailWarning` |
| Mailbox log on failure | No `Resend 403` / domain not verified errors |

### Site-data

| Check | Expected |
|-------|----------|
| `GET /api/site-data` | `packageVersion` ≥ live marketplace (1.0.132+), `liveRefreshedAt` recent |
| Overview / Deployments / Marketplace Health | Same version + download totals across pages |
| Connected Services | Site data feed shows current `generatedAt` |
| `https://cursor.lorapok.tech/site-data.json` | Updates after deploy_website step |

### Automated

```bash
node website/admin/scripts/verify-mail-setup.mjs
node website/admin/scripts/verify-mail-transport.mjs
node website/admin/scripts/probe-subscribe-testmail.mjs   # if testmail creds in vault
```

---

## 6. Files to modify

| File | Change |
|------|--------|
| `website/admin/scripts/enable-mail.mjs` | Remove CI skip for email token Pages secret |
| `website/admin/functions/api/_shared/mail.js` | `resolveResendFromAddress` + use in `sendViaResend` |
| `website/admin/scripts/setup-resend-secret.mjs` | Default `RESEND_FROM` to `@mail.lorapok.tech` |
| `website/admin/functions/api/_shared/stats-refresh.js` | Stale-cache overlay in `fetchSiteDataWithLiveCache` |
| `website/admin/src/hooks/useSiteData.ts` | Cache-bust on manual refresh |
| `.github/workflows/ci-cd.yml` | Resend domain verify step + post-deploy stats ping |
| `website/admin/scripts/mail-resend-routing.test.mjs` | Resend from-address tests |
| `website/admin/functions/api/_shared/stats-refresh.test.mjs` | Stale cache overlay tests |

**Do not modify:** `ccm-mail-relay` worker, transport priority order, cred vault schema.

---

## 7. Implementation order

1. **A2 + tests** — Resend from-address (highest user impact, lowest risk)
2. **A1** — Email token always synced
3. **A3** — Default `RESEND_FROM` in setup script
4. **B1 + tests** — Site-data stale overlay
5. **B2** — Client cache-bust on refresh
6. **A4 + B3** — CI steps (verify-resend-domain, stats ping)
7. **Run test suite** → commit → push → deploy-infra → manual E2E verification

---

## 8. Risks and mitigations

| Risk | Mitigation |
|------|------------|
| On-demand channel fetch adds latency to `/api/site-data` | Only when cache missing/stale; parallel with base fetch; no KV write |
| Wrong subdomain in Resend From | Unit tests; only rewrite `@lorapok.tech` apex |
| Extra wrangler secret put hits rate limit | Already runs in deploy-infra with 90s cooldown |
| `verify-resend-domain --sync-kv` fails if DNS not ready | `continue-on-error: true`; manual DNS fix still documented |

---

## 9. Out of scope

- Workers Paid upgrade
- Replacing GitHub Pages as `SITE_DATA_URL` (future: self-hosted JSON on admin domain)
- Broadening `admin-deploy-gate` path patterns
- New subagent changes (`.cursor/agents/mail-data-ops.md` already added in PR #232)

---

## 10. Procedure tracking

After implementation starts:

```bash
node scripts/procedure-init.mjs --title "Mail + site-data fix" --plan plan/a3f8c2d1_mail-site-data-fix-plan.md
```
