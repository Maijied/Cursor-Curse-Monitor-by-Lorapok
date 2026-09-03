# Deploy granularity, rollback/beta fixes, dynamic stats, and admin mail setup

**Status:** Plan only (no implementation yet)  
**Base:** `origin/main` @ `7592240f` (PR #113 merged)  
**Proposed branch:** `cursor/deploy-granular-stats-mail-329a`  
**Last updated:** 2026-09-03

---

## 1. Problem summary (user report)

After merging PR #113 and rebasing:

1. **Rollback failed** — Mission Control rollback dispatch or CI `release-prep` did not complete.
2. **Production deploy failed** after choosing **“Open VSX + Firefox AMO (default — no VS Code)”** — Open VSX / VSIX publish path broke.
3. **Rollback failed again** afterward — pipeline left in a bad state.
4. **Desired:** Each artifact deployable **independently** (extension, browser ext, admin, website, stats) **or** all together.
5. **Beta deployment** process needs fixing (channel + market coupling is confusing and error-prone).
6. **Stats not syncing dynamically** — marketing site, admin dashboard, badges, and committed `site-data.json` drift.
7. **Email configuration** — user expects a guided process in admin; `MailTransportCard` exists on main but lacks setup wizard / readiness flow.

---

## 2. Root-cause analysis (from codebase)

### 2.1 Monolithic CI graph

Single workflow: `.github/workflows/ci-cd.yml`.

| Symptom | Cause |
|---------|--------|
| Cannot publish extension without admin CI | `deploy.needs: [ci, browser-extension-ci, admin-ci, release-prep]` |
| Cannot deploy admin without marketplace job | `admin-deploy.needs` includes `deploy` (skipped OK, but graph is confusing) |
| Stats cron not running | `deploy-stats-cron-ci.mjs` only on `workflow_dispatch`, not `push` |
| Marketing site stale | `website` job is dispatch-only; `seo-pipeline` is weekly + push |

### 2.2 Beta + market mismatch (likely user error, but UX allows it)

`validateMarketplaceDeploy()` blocks **Beta + Firefox AMO** (`website/admin/src/lib/marketplace-deploy-policy.ts`).  
UI still lets user pick Beta + “Open VSX + Firefox AMO” until submit — error only at validation.

CI also forces `DO_AMO=false` for pre-release (`ci-cd.yml` ~1022–1025), so even if validation passed, AMO would be skipped silently.

### 2.3 Rollback failure modes

`release-prep` rollback path (`.github/workflows/ci-cd.yml` ~782–820):

1. `target_tag` missing / not found in repo
2. `compute-next-release-version.mjs --rollback` fails → “Could not resolve rollback version from live marketplace data”
3. `git push origin main` fails (branch protection, concurrent push, empty commit)
4. Rollback tag `vX.Y.Rn` already exists → skips tag create but may still fail publish step
5. Mission Control: `activateRollbackNotice()` failure → 502 after dispatch

Rollback **rewrites `main`** with restored tree — high-risk, hard to retry.

### 2.4 “No VS Code” / Open VSX publish

For `Open VSX + Firefox AMO`: `DO_OVSX=true`, `DO_VSCE=false`, `DO_AMO=true`.

Pipeline still runs `npm run package` (VSIX required). Open VSX steps:

1. `node scripts/publish-ovsx.mjs` — repackages under `lorapok-labs` publisher
2. `ovsx publish` LorapokLabs duplicate VSIX

Likely failure points:

- `publish-ovsx.mjs` repackage / shared bundle validation
- Missing `OVSX_PAT`
- Version already published (should warn, not fail)
- `release-prep` version/tag mismatch after failed partial run

### 2.5 Stats not dynamic

Two-layer model:

- **Static:** `website/site-data.json` (git, GitHub Pages)
- **Live:** Cloudflare KV `stats:live-cache` via `runStatsRefresh()`

Gaps:

- `DEFAULT_STATS_REFRESH_CONFIG.enabled: false` — cron no-ops until admin enables
- Stats cron worker not redeployed on ordinary `push` to main
- Marketing merge (`site.js` → `/api/site-data`) only helps when KV is fresh
- README badges use committed JSON, not live API
- `admin-deploy-gate` skips admin redeploy when only `website/site-data.json` changes
- `preserveVerifiedDownloads` keeps old totals when APIs fail (looks “stuck”)

### 2.6 Admin email configuration

**On main today:** `MailTransportCard`, mail KV API, Mailbox tests, Sync up → `deploy-infra`.

**Missing:** guided checklist, readiness GET, inline verify, sync recommendations on Settings, subscribe↔mail status badges, workflow status after Sync up.

---

## 3. Recommended approach (single PR, phased commits)

### Phase A — Git hygiene (first step before coding)

```bash
git fetch origin main
git checkout main
git pull origin main
git checkout -b cursor/deploy-granular-stats-mail-329a
```

### Phase B — Deployment: granular targets + safer rollback/beta

**Goal:** Mission Control can deploy any subset without running unrelated jobs.

#### B1. Workflow inputs (extend `ci-cd.yml` `workflow_dispatch`)

Add boolean inputs (defaults preserve current behavior):

| Input | Effect |
|-------|--------|
| `deploy_extension` | Run `deploy` marketplace job |
| `deploy_ovsx` / `deploy_vsce` / `deploy_amo` | Fine-grained market toggles (override `publish_market` when set) |
| `deploy_admin` | Cloudflare Pages admin |
| `deploy_website` | GitHub Pages marketing |
| `deploy_stats_cron` | `ccm-stats-cron` worker |
| `deploy_seo` | Regenerate + commit site-data/seo |

`deploy-infra` sets extension=false, admin/website=true.

#### B2. Decouple job `needs`

```
admin-deploy.needs: [admin-ci, resolve-version]   # remove deploy
deploy.needs: [ci, browser-extension-ci]        # remove admin-ci when extension-only
website.needs: [ci] OR [] when seo-only dispatch
```

Add `workflow_call` reusable workflow file `.github/workflows/deploy-component.yml` only if `ci-cd.yml` becomes unmaintainable — prefer extending existing workflow first to minimize risk.

#### B3. Beta UX fixes (`Deployments.tsx`)

- When channel → **Beta**, auto-set market to **Open VSX** (or Open VSX only) and disable AMO options with tooltip.
- When channel → **Production**, restore previous market selection.
- Show inline policy errors before submit (already partially there — strengthen).
- Document two-step production release: `full-release` tags only → separate `publish-tag` Deploy.

#### B4. Rollback hardening

1. **`scripts/compute-next-release-version.mjs`**: fallback to highest git tag when marketplace APIs unreachable (log warning, don't hard-fail).
2. **Rollback dry-run API**: `GET /api/version/plan?mode=rollback&target_tag=…` returns planned `vX.Y.Rn` before dispatch.
3. **Optional `rollback_publish_only` input**: skip `git push main`, only tag + publish restored tree from `target_tag` (reduces main churn). Default stays current behavior for safety.
4. **Idempotent rollback**: if rollback tag exists, publish that tag instead of re-committing.
5. **Mission Control**: surface GitHub Actions run URL + last error from `deploy-workflow.js` response.

#### B5. Open VSX / VSIX path

1. Ensure `publish-ovsx.mjs` runs after `npm run package` with explicit VSIX path (no `ls -t` race).
2. Make LorapokLabs duplicate publish **`continue-on-error: true`** with warning (canonical `lorapok-labs` is source of truth).
3. Add CI summary step listing which markets published/skipped/failed.

**Critical files:**

- `.github/workflows/ci-cd.yml`
- `website/admin/functions/api/_shared/deploy-workflow.js`
- `website/admin/src/components/pages/Deployments.tsx`
- `website/admin/src/lib/marketplace-deploy-policy.ts`
- `scripts/compute-next-release-version.mjs`
- `scripts/publish-ovsx.mjs`

---

### Phase C — Dynamic stats sync

**Goal:** Admin + marketing show live numbers without manual weekly CI.

#### C1. Enable stats refresh by default in new installs

- Change `DEFAULT_STATS_REFRESH_CONFIG.enabled` to `true` **or** auto-enable on first admin deploy via migration in `stats-refresh-config.js`.
- Document in `CronSchedulesCard` that stats refresh must stay on.

#### C2. Deploy stats cron on every admin deploy

- Run `deploy-stats-cron-ci.mjs` on `push` to main when `admin-deploy` succeeds (not only `workflow_dispatch`).
- Gate on `CRON_SECRET` present; warn in health if missing.

#### C3. Broaden admin redeploy trigger

- Extend `admin-deploy-gate` paths to include `website/site-data.json`, `website/stats/**`, `website/seo.json`.

#### C4. Live badge + marketing consistency

- `website/site.js`: always attempt `/api/site-data` merge (already does); add cache-bust when `checkedAt` changes.
- Optional: `readme-stats` shield URL → `https://cursor-dev.lorapok.tech/api/stats/badge.json` (feature-flagged).

#### C5. Post-refresh write-back (optional, behind flag)

- After successful `runStatsRefresh`, if totals changed > threshold, open PR or commit `site-data.json` via GitHub API (heavy — defer unless user insists).

**Critical files:**

- `website/admin/functions/api/_shared/stats-refresh-config.js`
- `website/admin/functions/api/_shared/stats-refresh.js`
- `website/admin/scripts/deploy-stats-cron-ci.mjs`
- `.github/workflows/ci-cd.yml` (`admin-deploy-gate`, stats cron step)
- `website/site.js`
- `website/admin/src/components/ui/CronSchedulesCard.tsx`

---

### Phase D — Admin email configuration process

**Goal:** Settings page is the operator hub for mail setup (not just identity fields).

#### D1. New `MailSetupChecklist` component

Steps (read-only status + actions):

1. Prerequisites (Cloudflare Email Sending doc link)
2. Transport secrets (Resend / relay / testmail badges from existing config GET)
3. **Sync up** (existing) + show `buildMailSyncRecommendations()` inline
4. **Send test** + **Testmail probe** shortcuts (call mailbox APIs)
5. Subscribe gate status (`mailConfigured`, `subscribeAvailable` from health)

#### D2. API: `GET /api/integrations/mail/status`

Aggregate: transport, identities, recommendations, subscribe availability, last testmail result timestamp.

#### D3. Wire into Settings

- Place checklist above `MailTransportCard`
- `SubscribePromptCard`: live badges from health

**Critical files:**

- `website/admin/src/components/ui/MailSetupChecklist.tsx` (new)
- `website/admin/src/components/ui/MailTransportCard.tsx`
- `website/admin/src/components/ui/SubscribePromptCard.tsx`
- `website/admin/functions/api/integrations/mail/status.ts` (new)
- `website/admin/functions/api/_shared/mail-sync.js`
- `website/admin/vite-dev-api.mjs`
- `website/admin/src/lib/api.ts`, `api-catalog.ts`
- `website/admin/src/__tests__/mail-config-api.test.ts`

---

## 4. Implementation order (commits)

| # | Commit theme | Risk |
|---|--------------|------|
| 1 | Beta/market UX + validation in Deployments | Low |
| 2 | Rollback/version fallback + dry-run API | Medium |
| 3 | CI granular deploy inputs + decoupled `needs` | High |
| 4 | Open VSX publish hardening | Medium |
| 5 | Stats refresh default + cron deploy on push | Medium |
| 6 | Admin deploy gate + CronSchedulesCard copy | Low |
| 7 | Mail setup checklist + status API | Low |
| 8 | Tests + docs (`DEPLOYMENT.md`, `ADMIN_MANUAL_TEST.md`) | Low |

---

## 5. Verification plan

### Automated (CI / local)

```bash
npm run compile && npm test
cd website/admin && npm test
node website/admin/scripts/mail-resend-routing.test.mjs
npx vitest run website/admin/src/__tests__/mail-config-api.test.ts
# New tests:
# - marketplace-deploy-policy beta+amo blocked
# - compute-next-release-version rollback fallback
# - mail status API
```

### Deployment smoke (manual / Mission Control)

1. **Infra only:** Deploy admin + website, no extension — confirm jobs skip marketplace.
2. **Extension only:** `publish-tag` with `deploy_admin=false`, `deploy_website=false`, market Open VSX — confirm VSCE/AMO skipped, Open VSX green.
3. **Beta:** Beta + Open VSX — confirm pre-release flag, AMO skipped with notice.
4. **Rollback dry-run:** `GET /version/plan?mode=rollback&target_tag=v1.0.70` returns `vX.Y.R1`.
5. **Rollback execute:** rollback to known good tag — CI green, new `v*.R*` tag published.
6. **Stats:** Enable refresh → wait 5 min → `/api/site-data` `checkedAt` updates; marketing hero numbers match admin Overview.
7. **Mail:** Settings checklist all green → Sync up → testmail probe → subscribe probe.

### Evidence for PR

- Terminal test output (146+ admin tests)
- Screenshot: Deployments page with granular targets
- Screenshot: Settings mail checklist
- Link: successful GitHub Actions run for infra-only + extension-only dispatches

---

## 6. Out of scope (this PR)

- Rotating exposed vault passphrases
- Full stats write-back to git on every refresh
- Splitting `ci-cd.yml` into multiple workflow files (only if extension proves too fragile)
- Phase 2 cross-folder CIP import

---

## 7. Procedure tracking

After implementation starts:

```bash
node scripts/procedure-init.mjs \
  --title "Granular deploy, stats sync, mail setup" \
  --plan plan/c4e8a1f2_deploy-stats-mail-plan.md
```

---

## 8. Next step (when exiting plan mode)

1. `git checkout main && git pull origin main`
2. `git checkout -b cursor/deploy-granular-stats-mail-329a`
3. Implement Phase B → D in commit order above
4. Test per §5
5. Open draft PR against `main`
