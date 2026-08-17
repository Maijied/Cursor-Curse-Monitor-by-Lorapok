# Changelog

All notable changes to **Cursor Curse Monitor by Lorapok** are documented here.

Format based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## Unreleased

## [0.5.9] - 2026-08-17

### Added

- **Logs panel** and **Mailbox** in Mission Control — unified API/mail/system logs with filters; compose and test outbound mail
- Mail ops scripts: `probe-mail-token.mjs`, `setup-mail-secrets.mjs`, `enable-mail.mjs`
- GitHub social preview asset (`media/github-social-preview.png`, `website/assets/marketing/github-social-preview.png`)
- Refreshed OG social card for v0.5.9 stable (Mission Control, Mailbox, Logs, PWA)

### Fixed

- CI deploy syncs `CLOUDFLARE_EMAIL_API_TOKEN` **before** Pages deploy; dedicated email secret supported
- Outbound mail via Cloudflare Email REST API with mailbox logging and subscribe confirmation emails
- Android PWA routing, Remember me auth, SEO CI audit/publish workflow

### Changed

- Marketing OG image and GitHub social preview updated for stable release branding

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
