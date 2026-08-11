# Changelog

All notable changes to **Cursor Curse Monitor by Lorapok** are documented here.

Format based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

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

[0.1.0]: https://github.com/Maijied/Cursor-Curse-Monitor-by-Lorapok/releases/tag/v0.1.0
