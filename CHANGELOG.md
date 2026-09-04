# Changelog

All notable changes to **Cursor Curse Monitor by Lorapok** are documented here.

Format based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## Unreleased

### Fixed

- **Login sync (IDE + browser)** — dashboard refreshes immediately after sign-in, paste, or account changes; browser extension activates tokens on first connect and polls up to 60s with `probeAuth` (popup + options)
- **Usage analytics chart** — stacked chart ymax uses true stack totals; surface/model group-by shows explicit empty states; IDE chart prefs survive refresh
- **Admin site data polling** — `useSiteData` re-fetches on interval; `refresh()` triggers a real reload
- **Live stats KV pressure** — skip badge/readme writes unless `displayTotal` or sync status changes

### Added

- **Mission Control tabbed Settings** — Discord-style tabs for General, Mail, Discord, Firebase, GitHub, Cloudflare, Automation, Cloud dev, and Services; integration cards sync non-secret metadata to ADMIN_KV and Firebase client fields to GitHub `admin-production` secrets on master save
- **Firebase runtime bootstrap** — admin SPA loads client config from `GET /api/firebase-config` (or local `VITE_FIREBASE_*`); no hardcoded keys in source
- **`sync-firebase-pages-secrets.mjs`** — sync `VITE_FIREBASE_*` to Cloudflare Pages secrets when KV read quota blocks runtime bootstrap
- **Infrastructure status card** — Settings → General shows live sync health from `/api/sync/status` with KV read/write quota detection
- **Settings integration polling** — Mail, Cron, Discord, Subscribe, Reindex, and Connected Services cards refresh every 60s without a full page reload
- **FieldHelp tooltips** — contextual help on Mail sending domain, Discord webhook, subscribe fallback, reindex cap, and cron intervals

### Fixed

- **KV quota detection** — shared `kv-quota` module classifies Cloudflare KV daily read vs write limit errors; sync status and save paths surface clearer guidance
- **Stats refresh KV pause guard** — `writesPausedUntil` skips automatic stats refresh until UTC quota reset after KV limit errors; fixes sync status `lastError` field mapping
- **Mail sync workflow polling** — Settings mail cards track deploy-infra GitHub Actions after Sync up
- **Cloud dev environments card** — GCP Workstations, Azure Dev Box, and browser VS Code setup links in Settings

- **Hero layout** — orbit and community stats side-by-side on desktop; no stats card overlap; compact secondary metrics
- **Hero stats layout** — visits/engagement tiles sit in a two-column grid (was a three-column grid with two items)
- **Screen readers** — announce verified community totals once after count-up, not during animation
- **README download badges** — live Shields.io endpoints at `/api/stats/shields/*.svg` (JSON body, bot-safe path) plus `/api/stats/readme.svg` chart; committed `website/stats/*.json` remains CI/marketplace fallback
- **Marketing site stat meters** — only render download totals when `site-data.json` marks them verified; otherwise show em dash
- **Grand download total** — sum Open VSX (both namespaces) + VS Code `downloadCount` + GitHub releases (~9.6k+); hero UI leads with total, then channel breakdown
- **VS Code Marketplace stats** — use gallery `downloadCount` (updates on version publish), not unique `install` count

### Added

- **Meta AI marketing assets** — Cognitum hero, architecture shield, and carousel overview saved under `website/assets/marketing/meta-ai/`; hero ambient texture, architecture section accent, and gallery Marketing filter on the public site
- **Usage accuracy (IDE + browser)** — pool-aware hero percent, agent-credit breakdown, stale-100% banner when bonus remains, collapsible usage breakdown, help modal, and on-demand-only personal cap editing; `DISCORD_INVITE_URL` in shared product links
- **Hybrid architecture workflows** — marketing site architecture tabs now mirror full Mermaid topology (clients, deploy pipeline, edge cases, schedules) with glowing cards and animated packet flow; coverage guarded by `architecture-workflow-from-mermaid.mjs` tests
- **Asset cache busting** — `site-data.json` includes `assets.buildId`; `npm run site:data` stamps `?v=` on local CSS/JS in HTML pages
- **Discord community link** — public invite `https://discord.gg/bp42QAMC6` in `social.json`; footers on index, privacy, and terms load from `social-footer.js`
- **Subscribe mail gate** — marketing site checks `GET /api/site-config` before showing the subscribe modal; Mission Control Settings card configures Discord fallback (`https://discord.gg/MaYRtaqef`) or hidden mode when outbound mail is unavailable
- **Reindex policy (Mission Control)** — Settings card + `GET/PUT /api/integrations/reindex/config`; public fields on `GET /api/site-config` for IDE extension (`live` vs `quit-first`, enable/disable)
- **Unified Cursor index + CIP** — Mission Control controls lookback days, per-run record limits, export/import toggles, sanitization, dedupe, and cross-account import policy; IDE extension reindexes `conversation-search.db` + `state.vscdb`, exports/imports `.cip.json` packages, and shows policy-driven lookback in the dashboard
- **Outbound mail repair (Mission Control)** — Resend-first routing for external/testmail inboxes, Mailbox sync-up workflow, and Testmail E2E delivery probe
- **Unified Lorapok footer** — `social.json` drives brand + community icons (GitHub, Discord, LinkedIn, X, labs, Mission Control) across marketing pages

### Fixed

- **Live hero stats merge** — `site.js` prefers verified live `/api/site-data` download totals when fresher or higher than static `site-data.json`
- **README badge drift** — `test_badge_site_data_sync.mjs` asserts `website/stats/badge.json` matches generated site-data totals

- **Website build skill** — `lorapok-website-build` skill + `website-marketing` Cursor rule for hero, stats, subscribe, and notices workflows
- **Marketing site design restore** — six PNG feature lightbox cards, IDE icon grid, ecosystem tab a11y controls, marquee pause, and showcase assets lost during main branch divergence (`ed438d9`, `0f5df41`)
- **Admin Discord integration** — configurable deployment webhook in Settings, with notify-on-deploy API and completion watch
- **Admin deploy UX session** — floating status button, leave-warning modal, global deploy runtime context, and mobile viewport fixes
- **Extension & browser polish** — dashboard boot snapshot, retain-context webview, popup loading states, and activity bar icon refresh
- **Universal VS Code wrapper IDE support** — shared `supportedIdeWrappers` list; bold messaging in README, marketing site (2nd section with IDE grid), IDE dashboard About panel, and browser extension Options
- **Cursor-not-found blocked UI** — full blurred overlay with “No Cursor AI found”, refresh CTA, and [lorapok.tech](https://lorapok.tech) link in IDE dashboard and browser popup
- **SEO refresh** — VS Code wrapper IDE keywords, updated meta descriptions, canonical JSON-LD download URLs via `generate-seo.mjs`

### Fixed

- **Post–v1.0.16 restore** — README live download badges/chart, readme-stats generation pipeline, mail relay repair script, `/api/health` mail status fields (`relayBound`, `restConfigured`), and CI deploy resilience when Cloudflare probes are rate-limited
- **Admin deploy on Cloudflare 429** — retry deploy token probes with backoff before Pages deploy; proceed to wrangler after probe retries when rate limits persist
- Orphaned CSS in `dashboardView.ts` that broke `.connected` badge styles
- `syncStatus` override — release candidates no longer claim `synced` (uses `release-candidate` instead of misleading `dual-listing`)

### Changed

- Marketing hero and ecosystem copy emphasize Open VSX + VS Code Marketplace compatibility across all major AI IDEs

## [1.0.3] - 2026-08-25

### Added

- **Animated live stats hero** on cursor.lorapok.tech — downloads, visits, engagement, and Open VSX split meters (no duplicate marketing screenshots)
- **Browser extension What's New card** — professional changelog popup on each version bump
- **Dynamic notice templates** — bug fix, feature, security, maintenance, and incident presets in Mission Control
- **Mailbox compose templates** — invite, support response, warning, critical, and release-note presets

### Changed

- **Firefox AMO public URL** → `cursor-curse-monitor` (canonical listing slug)
- AMO listing description converted to Extension Workshop Markdown
- Marketing site gallery deduplicated — each product image appears once
- **Firefox MV3 manifest** — `background.scripts` only (no `service_worker`), `strict_min_version` 142.0 for `background.type` + data collection permissions
- **Mission Control Deployments** — clearer New Release vs Deploy vs Rollback instructions, client-side validation, and actionable GitHub dispatch errors
- **Release version preview** — uses the higher of live git tag vs `package.json` (fixes wrong `v1.0.0` preview when live tag lagged)

### Fixed

- AMO listing metadata: categories, tags, support email, homepage, technical whiteboard, EULA text
- `sync-amo-listing.mjs` — correct slug, icon upload, homepage/support sync
- React 18 for browser extension build (reduces AMO `innerHTML` linter noise vs React 19)
- **Mission Control mailbox** — `ccm-mail-relay` Worker with `send_email` binding (Pages service binding); fixes 401 from REST-only mail transport
- **Notice catalog upsert** — built-in notices merge into KV without "Notice not found" on enable

## [1.0.1] - 2026-08-25

### Added

- **v1.0.1 production release** — mail branding, deploy fixes, dynamic versioning, CI lockdown
- Branded email templates per category (product, help, notice) with dedicated logos under `website/assets/mail/`
- **Firefox AMO publish pipeline** — `publish-amo.mjs`, standalone `publish-firefox.yml`, Mission Control `Firefox AMO` market
- **Dynamic versioning** — root `package.json` holds production base; `version:sync` resolves workspace semver at build time
- Download totals from all GitHub release assets (`githubAllAssets`) with admin breakdown panel
- Global agent skills: `loragent-amo-publish`, `loragent-dynamic-versioning`, `loragent-cloudflare-mail-master`
- `scripts/sync-amo-github-secrets.mjs` — vault → GitHub AMO secrets sync

### Changed

- Mission Control deploy/release/rollback APIs restricted to **master admin** only
- Admin and website deploy jobs are `workflow_dispatch`-only (no auto-deploy on tag push alone)
- Deploy and rollback workflows route through `ci-cd.yml` (fixes 404 on removed workflows)
- Contact email unified to `cursor.curse.help@lorapok.tech` across site, add-on, and docs
- Marketing site KPI strip, gallery, and founder section polish

### Fixed

- `generate-site-data.mjs` download total logging and VSCE live stats
- AMO metadata generation before `web-ext sign` in CI (generated file is gitignored)
- `web-ext sign` errors no longer swallowed in CI

## [0.5.18] - 2026-08-25

### Fixed

- Ship `media/composer-template.json` so conversation reindex works on fresh installs
- Admin dev API subscribe handler uses async callback (fixes CI vitest startup)

## [0.5.17] - 2026-08-25

### Added

- Smart subscribe prompts — hidden when already subscribed; shown for new users in dashboard, welcome toast, browser popup, and options
- **Maybe later** snoozes subscribe prompts for a random 3–7 days, then returns with reminder copy and product icon
- Shared `@lorapok/cursor-monitor-shared` helpers: `shouldShowSubscribePrompt`, `randomSnoozeUntilMs`, first vs reminder copy

## [0.5.16] - 2026-08-25

### Added

- Professional mail identities: `cursor.monitor@lorapok.tech` (product) and `cursor.curse.help@lorapok.tech` (support)
- Ops BCC copy to `lorapokdev@gmail.com` on every outbound send; messages logged in Mission Control Mailbox
- **Email all subscribers** on Notices and Subscribers admin pages (`POST /api/subscribers/broadcast`)
- `scripts/setup-email-addresses.mjs` for Cloudflare Email Sending + Routing setup

### Changed

- Extension and browser add-on footers link Help and Updates mailto addresses
- Dashboard footer shows Help / Updates contact links
- Marketing site contact links updated to new addresses

## [0.5.15] - 2026-08-25

### Added

- **Conversation recovery** — `Reindex Missing Conversations` rebuilds `conversation-search.db` and IDE sidebar entries from on-disk `agent-transcripts` using the Mission Control lookback window (0 = all time) without deleting existing chats
- Dashboard **Data recovery** card with one-click reindex and reload guidance
- Admin catalog preset **Recover Missing Agent Conversations** notice for the marketing-site top banner (enable from Mission Control → Notices)
- Automatic DB backups before each reindex (`*.bak-pre-ccm-reindex`)

### Fixed

- Safer discovery of orphaned chats after worktree switches, branch changes, or workspace path mismatches

## [0.5.7] - 2026-08-14

### Fixed

- **Critical:** Fallback model writes no longer replace the entire `state.vscdb` file via sql.js export, which left stale WAL/SHM sidecars and corrupted Cursor storage on install/reload
- Auth reads now fail fast with a recovery hint when `state.vscdb` header is invalid
- Removed sql.js/WASM dependency from the extension runtime (smaller VSIX, no full-DB rewrite path)

## [0.5.6] - 2026-08-14

### Added

- **Admin Mission Control panel** (`website/admin/`) — Overview, Marketplace, Releases, Activity, Community, Deployments, SEO, Settings, Team Access
- Firebase auth guard with master admin + Firestore team invites
- Dev API middleware (`vite-dev-api.mjs`) for local `/api/*`, `site-data.json`, visitor stats
- Cloudflare Pages functions for tags, deploy, releases, workflows, marketplace sync, analytics, discussions
- `SyncRadar`, download breakdown, visitor stats, drift alerts on Overview
- `github.tags` cache in site-data for deployment tag fallback when GitHub API is rate-limited
- `docs/ADMIN_MANUAL_TEST.md` — manual QA checklist for the admin panel and release flow

### Fixed

- Admin panel scroll flicker — separated fixed background from scroll layer; removed `backdrop-filter` on glass panels
- GitHub tags 403 on Deployments — cached fallback from `site-data.json` + optional `GITHUB_TOKEN` in dev/Cloudflare
- PostCSS `@import` font warning — Google Fonts loaded via `index.html` link instead of CSS `@import`
- Extension dashboard HTML escape, refresh mutex, budget-aware warnings, version from `package.json`

### Changed

- Admin CI job: test, build, `verify:marketplace`

## [0.5.5] - 2026-08-14

### Added

- `scripts/publish-ovsx.mjs` — repacks VSIX with Open VSX publisher `lorapok-labs` before publish
- `scripts/verify-marketplace-sync.mjs` — CI guard for canonical vs duplicate Open VSX version parity
- `syncStatus` and `ovsxDuplicate` fields in `website/site-data.json`
- `cursorCurseMonitor.statusBarUsageSource` (`plan`, `autoApi`, `both`)

### Fixed

- Open VSX CI publish no longer uses bare `ovsx publish`
- Auth token reads via file-backed `node:sqlite` for large databases

### Changed

- `cursorCurseMonitor.autoApplyFallbackModel` defaults to `false`

## [0.5.0] - 2026-08-13

### Added

- **Unified CI/CD workflow** — consolidated `ci.yml`, `deploy.yml`, `version-bump.yml`, `pages.yml` into a single `ci-cd.yml`
- **Auto-patch releases** — every push to `main` automatically bumps patch version, tags, deploys to both marketplaces, and updates the website
- **Manual major/minor releases** — via GitHub Actions workflow dispatch
- **VS Code Marketplace support** — extension now publishes to both Open VSX and VS Code Marketplace
- **Website marketplace links** — live links and status badges for both Open VSX and VS Code Marketplace on the project website
- **Database safety improvements**:
  - Parameterized SQL queries (prevents injection)
  - Operation timeout protection (15s max)
  - Stale backup auto-cleanup (>1 hour old)
  - Cross-filesystem atomic write fallback
  - Explicit JSON parse error handling
  - Close DB before file I/O to avoid holding references

### Fixed

- Double-delete backup race condition in error handler
- Backup not cleaned up when model config was already set
- `readKeyValue` SQL injection vulnerability (string interpolation → parameterized query)

### Removed

- Separate `ci.yml`, `deploy.yml`, `version-bump.yml`, `pages.yml` workflows (merged into `ci-cd.yml`)
- `azure-pipelines.yml` (stale, unused)

### Changed

- README updated with both marketplace badges, install instructions, CI/CD documentation, and DB safety section
- DEPLOYMENT.md rewritten for unified workflow
- Website install section now shows both Open VSX and VS Code Marketplace options
- Release section updated to reflect auto-patch flow

## [0.4.1] - 2026-08-13

### Fixed

- Enhanced error reporting in fallback model application with detailed error messages
- Added specific error messages for database integrity issues, file permissions, and configuration structure changes
- Improved error propagation through retry logic with backup cleanup on errors

## [0.2.1] - 2026-08-11

### Added

- Transparent animated `logo.svg` with watching eyes (usage-reactive colors)
- `icon.svg` and improved `activity-bar.svg`
- `npm run validate:assets` and `npm run sync:icons` — checked before package/release

## [0.2.0] - 2026-08-11

### Added

- Cybernetic Soldier Fly Larva mascot logo (neon-green / charcoal armor)
- Redesigned Usage Dashboard with header, gauge budget tracker, and API feature chips
- Detailed budget tracker: cap, amount left, threshold warning, on-demand spend
- VS Code Marketplace publish in Deploy CI (`VSCE_PAT`)

### Fixed

- Activity bar gray square icon — now uses `media/activity-bar.svg` (VS Code requires SVG)

## [0.1.4] - 2026-08-11

### Fixed

- Deploy workflow runs only on version tags (avoids duplicate Open VSX publish on `main`)
- Treat "already published" Open VSX errors as success when re-running deploy
- Global deploy concurrency lock to prevent tag/main race conditions

## [0.1.3] - 2026-08-11

### Fixed

- Slim VSIX package (exclude website, CI files, full sql.js tree)
- Deploy workflow auto-creates Open VSX namespace `lorapok-labs`
- Deploy publishes to Open VSX on version tags

## [0.1.2] - 2026-08-11

### Changed

- Publisher changed to Lorapok Labs (`lorapok-labs`)

## [0.1.1] - 2026-08-11

### Added

- GitHub Pages website with SEO, sitemap, and privacy policy
- Privacy messaging: only logged-in user's usage is visible

## [0.1.0] - 2026-08-11

### Added

- Live usage dashboard in Cursor activity bar
- Status bar usage percentage indicator
- Auto-refresh from Cursor `usage-summary` API
- Custom personal budget cap (USD) in dashboard UI
- Warning notification at configurable usage threshold (default 80%)
- Automatic Composer 2.5 (Fast off) fallback when limit is exceeded
- Team and individual limit type display
- Billing cycle and days-until-reset display
- On-demand spend visibility
- Open VSX publish workflow via GitHub Actions
- Lorapok Labs branding and extension icon

[0.5.0]: https://github.com/Maijied/Cursor-Curse-Monitor-by-Lorapok/releases/tag/v0.5.0
[0.4.1]: https://github.com/Maijied/Cursor-Curse-Monitor-by-Lorapok/releases/tag/v0.4.1
[0.2.1]: https://github.com/Maijied/Cursor-Curse-Monitor-by-Lorapok/releases/tag/v0.2.1
[0.2.0]: https://github.com/Maijied/Cursor-Curse-Monitor-by-Lorapok/releases/tag/v0.2.0
[0.1.4]: https://github.com/Maijied/Cursor-Curse-Monitor-by-Lorapok/releases/tag/v0.1.4
[0.1.3]: https://github.com/Maijied/Cursor-Curse-Monitor-by-Lorapok/releases/tag/v0.1.3
[0.1.2]: https://github.com/Maijied/Cursor-Curse-Monitor-by-Lorapok/releases/tag/v0.1.2
[0.1.1]: https://github.com/Maijied/Cursor-Curse-Monitor-by-Lorapok/releases/tag/v0.1.1
[0.1.0]: https://github.com/Maijied/Cursor-Curse-Monitor-by-Lorapok/releases/tag/v0.1.0
