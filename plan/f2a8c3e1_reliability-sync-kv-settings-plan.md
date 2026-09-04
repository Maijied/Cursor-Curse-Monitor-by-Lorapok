# Reliability, login sync, KV stats, admin always-sync, and cloud settings

**Status:** Plan (implementation pending)  
**Base:** `main` @ `80f95ef9`  
**Proposed branch:** `cursor/reliability-sync-kv-settings-926f`  
**Single PR:** Yes — user requested one PR for all scoped work below  
**Last updated:** 2026-09-04

---

## 1. Problem summary (user report)

1. **Auto sync from browser/local login doesn’t work** — IDE dashboard and browser extension don’t reflect sign-in without manual refresh.
2. **Mail configuration broken** — send probe 401; `ccm-mail-relay` worker missing locally; Resend not configured.
3. **KV usage at 100%** — Cloudflare daily KV write quota exhausted; **live stats (“fast stat”) stop updating** while old cache still serves.
4. **Admin panel doesn’t stay in sync** — KPIs and integration cards load once; `useSiteData().refresh()` is broken.
5. **Settings need cloud context** — Add **Google Cloud** and **Microsoft Azure** information, links, and per-field help.
6. **Service visibility** — Offline/online icons so operators understand what’s live vs degraded.
7. **Merge everything in one PR** — login fixes + PR #118 analytics fixes + reliability work + settings UX.

---

## 2. Root-cause analysis

### 2.1 Login / auto-sync (already partially fixed locally)

| Issue | Root cause | Files |
|-------|------------|-------|
| IDE dashboard stale after sign-in | Webview handlers don’t call `deliverSnapshot(true)` after auth commands | `src/dashboardView.ts` |
| “Done” after browser sign-in does nothing | `promptLoginWithBrowser()` returned `false` | `src/accountCommands.ts` |
| Browser first connect doesn’t activate | `saveToken()` skipped activation when stale `activeAccountId` but no `accessToken` | `browser-extension/src/lib/storage.ts` |
| Connect poll too short / no probe | 30s timeout, no `probeAuth` during poll | `browser-extension/src/popup/App.tsx` |
| Refresh fails entirely on analytics error | `buildUsageAnalytics` throw breaks `doRefresh` | `src/usageMonitor.ts`, `browser-extension/src/lib/monitor.ts` |

**Architectural limits (document, don’t “fix” as bugs):**
- IDE “Sign in with browser” does not capture tokens — only the **browser extension** does passive capture.
- IDE local sync is **poll-based** (`pollIntervalSeconds`, default 30s) — no `state.vscdb` watcher.
- IDE secrets and browser `storage.local` are **independent** — no cross-extension bridge.

### 2.2 KV 100% → live stats frozen

There is **no in-app KV usage %** today. “100%” = Cloudflare **daily KV `put()` limit** (~1,000/day on Workers Free).

**Per successful stats refresh (when data changes):**
- `stats:live-cache` (JSON)
- `stats:readme-svg` (string)
- `stats:badges-bundle` (JSON)
- `integrations:stats-refresh` metadata (cron run record)
- `system:log:*` scatter write(s)

**Competing KV writers:** feedback scatter, subscribers, mailbox, config saves, usage pings, activity logs.

When quota is hit:
- `runStatsRefresh` fails → **existing cache left unchanged** → numbers look frozen
- `recordCronJobRun` may also fail → Settings may not show the error
- `preserveVerifiedDownloads` can freeze totals even when refresh “succeeds” but marketplaces don’t all verify

**“Fast stat”** = user language for **live marketplace stats** (`stats:live-cache` via `runStatsRefresh`), not a code symbol.

### 2.3 Admin panel sync gaps

| Gap | Impact |
|-----|--------|
| `useSiteData` loads once; `refresh()` only sets `loading` | Overview/Settings KPIs stale until full page reload |
| Settings integration cards fetch on mount only | Mail/cron/discord config drift invisible |
| `fetchHealth` on Settings loads once | Cron/mail status stale for session |
| Mail “Sync up” is fire-and-forget GHA dispatch | No workflow polling (unlike deploy session) |
| No global staleness banner | Operator doesn’t know data age |

**Existing good patterns to extend:** `useUsageStats` (15s poll), `OnlineStatus` / `ConnectedServicesCard` (60s), `DeployRuntimeContext` (4–8s session poll).

### 2.4 Mail

Transport cascade (`mail.js`): Resend → `ccm-mail-relay` → Cloudflare Email REST → Resend fallback.

Local verify results:
- `verify-mail-setup.mjs`: send probe **401**
- `verify-mail-transport.mjs`: email token can list API; **`ccm-mail-relay` worker not found**; Resend not set

**Mail is ops + small API surfacing**, not extension code. PR includes runbook steps and optional health field improvements.

---

## 3. Recommended approach (single PR, phased commits)

### Phase A — Auth & sync fixes (merge PR #118 + local login work)

**Goal:** Users can sign in and see usage immediately.

| Task | Files |
|------|-------|
| Commit existing login/sync fixes | `src/accountCommands.ts`, `src/dashboardView.ts`, `src/usageMonitor.ts`, `browser-extension/src/**` |
| Merge PR #118 analytics fixes | `packages/shared/src/usageAnalytics.ts`, `usageAnalytics.test.mjs`, `src/dashboardView.ts` (resolve conflict on analytics render vs account handlers) |
| Analytics try/catch (already in local work) | IDE + browser `monitor.ts` |
| Align browser Options connect with popup `probeAuth` | `browser-extension/src/options/OptionsApp.tsx` |

**Acceptance:**
- IDE: add account / browser sign-in / paste → dashboard updates without waiting for poll
- Browser: first connect activates token; connect poll up to 60s with probe
- `npm test`, `npm run browser-ext:test`, `npm run compile` green

### Phase B — KV quota relief & live stats reliability

**Goal:** Stats keep updating under KV pressure; operators see why they stopped.

#### B1. Reduce KV writes (no new infra — ship in PR)

| Change | Rationale |
|--------|-----------|
| **Skip `logSystemEvent` on successful refresh when stats unchanged** | Saves 1+ scatter puts per cron tick |
| **Record cron metadata even when cache unchanged** (already happens) but use single `putKvJsonIfChanged` for config | Avoid duplicate metadata writes |
| **Defer badge/readme SVG writes** — only when `displayTotal` or channel versions change, not any channel drift | Cuts 2 puts on noisy partial API responses |
| **KV write budget guard** in `runStatsRefresh` — read Cloudflare error; if limit hit, set in-memory flag in KV config `writesPausedUntil` (next UTC day) and skip non-essential writers | Prevents hammering quota |
| **Surface `lastRunError` + `writesPausedUntil` in `/api/health` and Cron card** | Operator visibility |

Files: `website/admin/functions/api/_shared/stats-refresh.js`, `stats-refresh-config.js`, `kv-put.js`, `health.ts`, `CronSchedulesCard.tsx`.

#### B2. Admin KV quota meter (UI only)

Add to Settings → Environment or new **Infrastructure** card:
- Note: “KV write quota is enforced by Cloudflare (not shown in-app).”
- Show: estimated writes per stats refresh, last refresh outcome, link to [Cloudflare KV limits](https://developers.cloudflare.com/kv/platform/limits/)
- When `lastRunError` matches daily limit → **danger badge** + “Pause automatic stats refresh” shortcut (sets `enabled: false`)

#### B3. Database / storage alternatives (recommendation matrix)

| Option | Fit | Pros | Cons | Recommendation |
|--------|-----|------|------|----------------|
| **A. Optimize KV (B1)** | Stats cache, config blobs | Zero new bindings; matches current arch | Still capped on Free | **Do first** in this PR |
| **B. Cloudflare R2** | `stats:readme-svg`, badge JSON blobs | Cheap storage; no daily put limit for objects | Needs new binding + read path change | **Phase 2** — best CF-native step |
| **C. Cloudflare D1** | System logs, activity, subscriber index | SQL queries; better for append-heavy data | Migration + wrangler binding | **Phase 2** — move scatter logs/subscribers |
| **D. Azure Table / Cosmos** | Multi-cloud backup of stats snapshot | User has Azure | Extra creds, latency, dual-write complexity | **Optional** — export cron snapshot via existing GHA, not runtime |
| **E. GCP Firestore / Cloud SQL** | Same as D | User has GCP | Same | **Optional** — backup/export only |
| **F. GitHub-as-source** | `site-data.json` in repo | Already used; zero KV | Not real-time | Keep as **fallback layer** (already in `site-data.js`) |
| **G. Resend/webhook-only telemetry** | Mail path | Already partially there | Not for download stats | N/A |

**PR scope:** implement **A** fully; document **B+C** as follow-up in `docs/wiki/Architecture.md` § stats storage (short subsection, no large rewrite).

### Phase C — Admin always sync

**Goal:** Mission Control reflects backend state within 60s without manual reload.

| Task | Implementation |
|------|----------------|
| **Fix `useSiteData`** | Add `refreshToken` state; `refresh()` re-runs `loadSiteData`; optional `pollIntervalMs` default **60_000** |
| **Extract `usePollingFetch` hook** | Shared by site-data, health, cron config |
| **Poll integration cards** | `MailTransportCard`, `MailSetupChecklist`, `CronSchedulesCard` — 60s refresh or subscribe to `usePollingFetch('/api/health')` |
| **`GET /api/sync/status`** (new) | Aggregate: `health`, `statsRefresh.lastRunAt`, `cache.refreshedAt`, `cache.ageSeconds`, `kvWritesPaused`, `mailConfigured`, `marketplaceSync.syncStatus` |
| **Global sync strip** | `AppShell` header: green/amber/red dot + “Last sync {time}” from `/api/sync/status` every 30s |
| **Mail sync session** | After `syncMailTransport()`, poll GHA workflow (reuse `DeployRuntimeContext` pattern) until complete or timeout |
| **Staleness badges** | Overview: warn if `liveRefreshedAt` older than `2 × intervalMinutes` |

Files: `website/admin/src/hooks/useSiteData.ts`, new `usePollingFetch.ts`, `api.ts`, `functions/api/sync/status.ts`, `AppShell.tsx`, `Settings.tsx` integration cards.

### Phase D — Settings: GCP, Azure, links, offline/online icons

**Goal:** Every integration input has context; cloud dev environments documented.

#### D1. Shared cloud environment catalog

Extend `packages/shared/src/supportedIdeWrappers.ts` OR new `cloudDevEnvironments.ts`:

```ts
export type CloudDevEnvironment = {
  id: "gcp-cloud-workstations" | "azure-dev-box" | "gitpod" | ...
  provider: "google" | "microsoft" | "other"
  name: string
  tagline: string
  docsUrl: string
  installUrl?: string
  notes: string[]  // token capture, state.vscdb location, etc.
}
```

Add entries for:
- **Google Cloud Workstations** / Cloud Shell Editor
- **Microsoft Azure Dev Box** / VS Code in browser (vscode.dev) / Azure Data Studio (already listed)

Rebuild shared package after changes.

#### D2. Admin `CloudEnvironmentsCard` (new)

Location: `Settings.tsx` after `HelpSupportCard`.

Per environment row:
- Provider icon (Google / Microsoft / generic cloud)
- **Online/offline** pill from `/api/sync/status` or health checks (see D3)
- Links: official docs, “Install extension”, “How auth works with Cursor Curse Monitor”
- Collapsible **field guide** for operators (not secrets): which env vars, which Cloudflare/GCP/Azure consoles

#### D3. Offline/online service icons (reuse pattern)

Extend `ConnectedServicesCard.tsx`:
- Add rows: **Stats cron**, **ADMIN_KV**, **Marketplace APIs**, **Firebase Analytics**
- Status: `connected` | `degraded` | `disconnected` | `checking`
- Use `Wifi` / `WifiOff` or existing `CheckCircle2` / `XCircle` from lucide-react
- **Degraded** = e.g. cache stale, partial marketplace verify, mail relay missing but Resend OK

Add compact **SyncStatusChip** to sidebar (next to existing `OnlineStatus`).

#### D4. Field-level help on every Settings input

Create small helper `FieldHelp.tsx`:
```tsx
<FieldHelp label="Resend API key" href="https://resend.com/docs/..." hint="Set via Pages secret; never paste in UI." />
```

Apply to:
- `MailTransportCard` — each transport field
- `Discord*Card` — webhook URL, invite link
- `SubscribePromptCard` — modal timing fields
- `ReindexPolicyCard` — policy toggles
- `CronSchedulesCard` — interval, enabled

Link targets: existing `docs/guides/CLOUDFLARE_EMAIL_AND_ROUTING.md`, `docs/guides/RESEND_WORKERS_FREE_SETUP.md`, wiki pages.

#### D5. Extension settings (secondary)

- `browser-extension/src/options/OptionsApp.tsx` — cloud environment section linking to shared catalog
- `src/dashboardView.ts` settings modal — short “Works in cloud IDEs” link list (read-only)

### Phase E — Mail repair (ops checklist in PR, not code secrets)

PR description + procedure file steps:

```bash
cd website/admin && npx wrangler login
node scripts/repair-mail.mjs
node scripts/verify-mail-setup.mjs
node scripts/setup-resend-secret.mjs   # if external mail needed
```

CI: remind that `main` push skips `enable-mail`; use **deploy-infra** workflow_dispatch.

Optional code (small): expose `mailRelayBound`, `mailLastVerifiedAt` on `/api/health` if not already present.

---

## 4. File change map (critical paths)

| Area | Files |
|------|-------|
| Login/sync | `src/accountCommands.ts`, `src/dashboardView.ts`, `src/usageMonitor.ts`, `browser-extension/src/lib/storage.ts`, `service-worker.ts`, `popup/App.tsx`, `options/OptionsApp.tsx` |
| Analytics (PR #118) | `packages/shared/src/usageAnalytics.ts`, `usageAnalytics.test.mjs` |
| KV / stats | `website/admin/functions/api/_shared/stats-refresh.js`, `kv-put.js`, `health.ts` |
| Admin sync | `website/admin/src/hooks/useSiteData.ts`, `hooks/usePollingFetch.ts`, `lib/api.ts`, `functions/api/sync/status.ts`, `AppShell.tsx` |
| Settings UX | `Settings.tsx`, `ConnectedServicesCard.tsx`, new `CloudEnvironmentsCard.tsx`, `FieldHelp.tsx`, integration `*Card.tsx` |
| Shared catalog | `packages/shared/src/cloudDevEnvironments.ts` (new), `supportedIdeWrappers.ts`, `index.ts` |
| Docs | `docs/wiki/Architecture.md` (stats storage note), `CHANGELOG.md` (user-visible) |
| Procedure | `procedure/f2a8c3e1_reliability-sync-kv-settings.md` |

---

## 5. Out of scope (defer)

- Full D1/R2 migration (document only in this PR)
- Cross-extension IDE↔browser token bridge
- `fs.watch` on `state.vscdb` (platform-specific, risky)
- Replacing Cloudflare KV entirely with Azure/GCP primary store
- Auto-merge PR without CI green

---

## 6. Verification plan

### Automated
```bash
npm run compile
npm test
npm run test -w @lorapok/cursor-monitor-shared
npm run browser-ext:test
cd website/admin && npm test && npx oxlint
```

Add tests:
- `useSiteData` refresh re-fetches (vitest)
- `GET /api/sync/status` shape (vitest + test-server)
- Stats refresh skips log write when unchanged (unit test in `stats-refresh` test file)
- `saveToken` activates when `!accessToken` (extend `browser-extension/tests/test-accounts.js`)

### Manual — IDE
1. F5 extension host → dashboard → Sign in with browser → Done → usage appears
2. Switch account → spinner → new email shown
3. Poll interval: sign into Cursor desktop → refresh within 30s

### Manual — Browser (Maizied Chrome profile)
1. `npm run browser-ext:build` → load unpacked
2. Popup → Sign in with browser → sign in at cursor.com/dashboard
3. Usage loads within 60s; badge shows percent

### Manual — Admin
1. `npm run dev` in `website/admin`
2. Overview totals update within 60s without reload
3. Settings → Connected services show online/degraded states
4. Cron card shows last refresh; simulate stale cache (old `refreshedAt`) → warn badge
5. Mail → Sync up → floating status tracks workflow

### Manual — Mail (ops)
```bash
node website/admin/scripts/repair-mail.mjs
node website/admin/scripts/verify-mail-setup.mjs
```
Mission Control → Mailbox → send test email

### KV pressure simulation
- Set stats refresh interval to 1 min in Settings → confirm write-reduction changes lower put count (check Cloudflare dashboard next day)
- When `lastRunError` shows daily limit → UI shows pause guidance; manual refresh still attempts with clear error

---

## 7. PR structure (single PR)

**Title:** `feat: reliable login sync, admin live sync, KV-aware stats, and cloud settings`

**Commits (suggested order):**
1. `fix: login and browser auth sync refresh paths`
2. `fix: usage analytics chart yMax and IDE chart prefs` (from PR #118)
3. `fix(admin): reduce KV writes and expose stats refresh health`
4. `feat(admin): always-sync polling, sync status API, and staleness UX`
5. `feat(admin): cloud environment card, field help links, service status icons`
6. `docs: stats storage alternatives and mail repair runbook`

**Close:** PR #118 (superseded by commit 2)  
**Procedure:** `node scripts/procedure-init.mjs --title "Reliability sync KV settings"`

---

## 8. Risk & rollback

| Risk | Mitigation |
|------|------------|
| Polling increases API load | 30–60s intervals; single `/api/sync/status` aggregator |
| KV write changes alter cron behavior | Feature-flag via env `CCM_STATS_SKIP_LOG_ON_UNCHANGED=1` default on |
| Large Settings page | Collapsible cards; lazy load cloud catalog |
| Mail repair needs secrets | Cred vault only; no secrets in PR |

Rollback: revert PR; stats fall back to last KV cache + static `site-data.json` (existing behavior).
