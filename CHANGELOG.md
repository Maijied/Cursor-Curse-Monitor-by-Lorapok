# Changelog

All notable changes to **Cursor Curse Monitor by Lorapok** are documented here.

Format based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## Unreleased

### Added

- **Universal VS Code wrapper IDE support** — shared `supportedIdeWrappers` list; bold messaging in README, marketing site (2nd section with IDE grid), IDE dashboard About panel, and browser extension Options
- **Cursor-not-found blocked UI** — full blurred overlay with “No Cursor AI found”, refresh CTA, and [lorapok.tech](https://lorapok.tech) link in IDE dashboard and browser popup
- **SEO refresh** — VS Code wrapper IDE keywords, updated meta descriptions, canonical JSON-LD download URLs via `generate-seo.mjs`

### Fixed

- **IDE dashboard stuck on loading** — webview `ready` handshake, cached snapshot delivery on visibility, and `retainContextWhenHidden` so all users see usage data instead of a blank panel
- Missing `SUBSCRIBE_PROMPT_DELAY_MS` import in `extension.ts` (compile error)
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

- **Conversation recovery** — `Reindex Missing Conversations` command rebuilds `conversation-search.db` and IDE sidebar entries from on-disk `agent-transcripts` (Aug 10 onward) without deleting existing chats
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
