<div align="center">

  <img src="media/icon.png" alt="Cursor Curse Monitor by Lorapok" width="128" />

  <h1>Cursor Curse Monitor by Lorapok</h1>

  <p>
    <strong>Live Cursor usage dashboard for limits, budget, billing cycles, and free-fallback model switching.</strong>
  </p>

  <p>
    <a href="https://lorapok.tech">Lorapok Labs</a> · Built for Cursor IDE &amp; VS Code
  </p>

  <p>
    <a href="https://github.com/Maijied/Cursor-Curse-Monitor-by-Lorapok/actions"><img src="https://img.shields.io/github/actions/workflow/status/Maijied/Cursor-Curse-Monitor-by-Lorapok/ci-cd.yml?branch=main&label=CI%2FCD" alt="CI/CD" /></a>
    <a href="https://open-vsx.org/extension/lorapok-labs/cursor-curse-monitor-by-lorapok"><img src="https://img.shields.io/open-vsx/v/lorapok-labs/cursor-curse-monitor-by-lorapok?label=Open%20VSX" alt="Open VSX" /></a>
    <a href="https://marketplace.visualstudio.com/items?itemName=LorapokLabs.cursor-curse-monitor-by-lorapok"><img src="https://img.shields.io/visual-studio-marketplace/v/LorapokLabs.cursor-curse-monitor-by-lorapok?label=VS%20Code%20Marketplace" alt="VS Code Marketplace" /></a>
    <img src="https://img.shields.io/badge/license-Proprietary-red" alt="Proprietary License" />
    <img src="https://img.shields.io/badge/platform-Cursor%20%7C%20VS%20Code-6C5CE7" alt="Platform" />
  </p>

  <p>
    <a href="https://github.com/Maijied/Cursor-Curse-Monitor-by-Lorapok/releases/latest"><img src="https://img.shields.io/github/v/release/Maijied/Cursor-Curse-Monitor-by-Lorapok?label=Latest%20Release" alt="Latest Release" /></a>
    <a href="https://maijied.github.io/Cursor-Curse-Monitor-by-Lorapok/">Website</a> ·
    <a href="https://cursor-dev.lorapok.tech">Mission Control</a> ·
    <a href="CONTRIBUTING.md">Contributing</a> ·
    <a href="DEPLOYMENT.md">Deployment</a> ·
    <a href="docs/wiki/Home.md">Wiki</a>
  </p>

</div>

---

## Overview

**Cursor Curse Monitor by Lorapok** helps developers track Cursor AI usage in real time — included quota with Auto/API meters, remaining units, billing cycle reset, on-demand spend, local session insights, and optional fallback to **Composer 2.5 (Fast off)** when limits are exceeded.

This repository is a **monorepo** with three production surfaces:

| Component | Path | Public URL |
|-----------|------|------------|
| **Extension** | `src/` | Open VSX · VS Code Marketplace · GitHub Releases |
| **Marketing site** | `website/` | https://maijied.github.io/Cursor-Curse-Monitor-by-Lorapok/ |
| **Mission Control (admin)** | `website/admin/` | https://cursor-dev.lorapok.tech |

---

## Architecture

### System diagram

```mermaid
flowchart TB
  subgraph Users["Users"]
    IDE["Cursor / VS Code + Extension"]
    Visitor["Marketing site visitor"]
    Admin["Admin operator"]
  end

  subgraph Local["On the developer machine"]
    IDE -->|"usage-summary + profile"| CursorAPI["Cursor API"]
    IDE -->|"read-only metadata"| VSCDB["state.vscdb"]
    IDE -->|"optional quit-then-write"| VSCDB
    IDE -->|"opt-in heartbeat"| Ping["/api/usage/ping"]
  end

  subgraph GitHub["GitHub — Maijied/Cursor-Curse-Monitor-by-Lorapok"]
    Repo["Monorepo source"]
    GHA["GitHub Actions CI/CD"]
    GHPages["GitHub Pages (static marketing)"]
    Releases["Releases + VSIX assets"]
    GHDisc["Discussions / Issues"]
  end

  subgraph Marketplaces["Extension distribution"]
    OVSX["Open VSX — lorapok-labs"]
    VSCE["VS Code Marketplace — LorapokLabs"]
  end

  subgraph CF["Cloudflare — Lorapok Facility account"]
    DNS["cursor-dev.lorapok.tech"]
    Pages["Pages: cursor-monitor-admin"]
    Fn["Pages Functions /api/*"]
    KV["ADMIN_KV"]
    Email["Email Routing — cursor-contact@lorapok.tech"]
  end

  subgraph Firebase["Firebase — cursor-curse-by-lorapok"]
    Auth["Auth (Google + magic link)"]
    FS["Firestore (visitor stats, rules)"]
  end

  GHA -->|"vsce / publish-ovsx"| OVSX
  GHA -->|"vsce publish"| VSCE
  GHA -->|"site:data + Pages deploy"| GHPages
  GHA -->|"wrangler pages deploy"| Pages
  Repo --> GHA

  Visitor --> GHPages
  Visitor -->|"notice banner, analytics beacon"| Fn
  Admin --> DNS --> Pages
  Pages --> Fn
  Fn --> KV
  Fn --> Auth
  Fn -->|"deploy dispatch"| GHA
  Fn -->|"discussions GraphQL"| GHDisc
  Ping --> Fn
  Fn --> FS
```

### Domains & hosting

| Surface | Domain / host | Provider | Deploy path |
|---------|---------------|----------|-------------|
| Marketing website | `maijied.github.io/Cursor-Curse-Monitor-by-Lorapok` | **GitHub Pages** | `ci-cd.yml` → `website` job |
| Admin SPA + API | `cursor-dev.lorapok.tech` | **Cloudflare Pages** (project `cursor-monitor-admin`) | `ci-cd.yml` → `admin-deploy` job |
| Pages origin (fallback) | `cursor-monitor-admin-2x8.pages.dev` | Cloudflare Pages | Same as admin |
| Brand / DNS zone | `lorapok.tech` | **Cloudflare DNS** | CNAME `cursor-dev` → Pages |
| Extension registries | Open VSX, VS Code Marketplace | Third-party | `deploy` job on release |
| Auth & analytics store | Firebase project `cursor-curse-by-lorapok` | **Google Firebase** | Rules via `firebase deploy` |

**Cloudflare migration:** Admin and API were consolidated onto the **Lorapok Facility** Cloudflare account. DNS for `cursor-dev.lorapok.tech` points at the Pages project; the legacy standalone Worker in `website/admin-api/` is **deprecated** — all `/api/*` routes live in `website/admin/functions/api/`. See [DEPLOYMENT.md](DEPLOYMENT.md) for secrets, KV bindings, and the full checklist.

### Project structure

```
cursor-usage-monitor/
├── src/                          # VS Code / Cursor extension (TypeScript)
├── dist/                         # Compiled extension output
├── media/                        # Icons and marketing assets
├── scripts/
│   ├── generate-site-data.mjs    # Builds website/site-data.json (marketplace + analytics)
│   ├── generate-seo.mjs          # Builds sitemap.xml, robots.txt, seo.json
│   ├── validate-seo.mjs          # Lint SEO artifacts + canonical URL guard
│   └── publish-ovsx.mjs          # Repacks VSIX for lorapok-labs namespace
├── tests/                        # Extension unit tests (node:sqlite)
├── website/
│   ├── index.html                # Marketing landing page
│   ├── site.js / analytics.js    # Client scripts (notice banner + live KPI beacon)
│   ├── site-data.json            # Generated marketplace + download stats
│   ├── seo.json / sitemap.xml    # Generated SEO manifest + sitemap
│   └── admin/
│       ├── src/                  # React Mission Control SPA (PWA-installable)
│       ├── functions/api/        # Cloudflare Pages Functions (production API)
│       └── vite-dev-api.mjs      # Local dev API middleware
├── .github/workflows/
│   ├── ci-cd.yml                 # Unified CI/CD pipeline
│   └── seo.yml                   # SEO audit, validation, and artifact refresh
├── .github/ISSUE_TEMPLATE/       # Extension bug, website issue, security templates
├── DEPLOYMENT.md                 # Release + Cloudflare setup
└── AGENTS.md                     # Agent / cloud dev instructions
```

### Data flows (summary)

1. **Extension** — Reads local Cursor auth and privacy-safe metadata (daily line stats, active models, session titles), calls `api2.cursor.sh` for quota, optionally writes fallback model after quit with WAL-safe backups. Opt-in heartbeats feed live-user counts to Mission Control. Native workbench toasts overlay the open editor (no extra notification tab).
2. **Marketing site** — Static HTML on GitHub Pages; loads `site-data.json` for download counts, polls `/api/analytics/stats` for live visitor KPIs, and uses `/api/notice` for the public banner.
3. **Mission Control** — Firebase-authenticated PWA on Cloudflare Pages; Pages Functions read/write KV (notices, admins), dispatch GitHub deploys, proxy analytics, and expose marketplace health APIs.
4. **CI/CD** — Extension build, admin deploy, GitHub Pages publish, and a dedicated SEO workflow that regenerates sitemap and site-data artifacts on schedule and on merge to `main`.

---

## Features

| Feature | Description |
|--------|-------------|
| **Sidebar dashboard** | Included quota, Auto/API meters, budget gauge, billing reset, local insights, cycle trend |
| **Status bar** | Live usage percentage at a glance |
| **Auto refresh** | Polls Cursor API every 60s (configurable) |
| **Local insights** | Today’s accepted lines, active models, recent session titles (no chat bodies) |
| **Cycle trend** | Sparkline from on-machine usage history |
| **Custom budget** | Set a personal USD cap in the dashboard |
| **Limit alerts** | Native toast at 80% (configurable), over the open editor |
| **Free fallback** | Auto-switches to Composer 2.5 (Fast off) at 100% |
| **Team aware** | Shows team vs individual limit type |
| **DB safety** | Read-only while Cursor runs; quit-then-write with WAL/SHM backup + integrity checks |

## Installation

### Open VSX (Cursor) — recommended

[open-vsx.org/extension/lorapok-labs/cursor-curse-monitor-by-lorapok](https://open-vsx.org/extension/lorapok-labs/cursor-curse-monitor-by-lorapok)

Search: `lorapok-labs.cursor-curse-monitor-by-lorapok`

### VS Code Marketplace

[marketplace.visualstudio.com/items?itemName=LorapokLabs.cursor-curse-monitor-by-lorapok](https://marketplace.visualstudio.com/items?itemName=LorapokLabs.cursor-curse-monitor-by-lorapok)

### From VSIX

```bash
git clone https://github.com/Maijied/Cursor-Curse-Monitor-by-Lorapok.git
cd Cursor-Curse-Monitor-by-Lorapok
npm install && npm run compile && npm run package
cursor --install-extension *.vsix
```

## Configuration

| Setting | Default | Description |
|---------|---------|-------------|
| `cursorCurseMonitor.pollIntervalSeconds` | `60` | API refresh interval |
| `cursorCurseMonitor.customBudgetLimit` | `0` | Personal USD budget cap |
| `cursorCurseMonitor.autoApplyFallbackModel` | `false` | Auto-switch at 100% (writes `state.vscdb`) |
| `cursorCurseMonitor.showStatusBar` | `true` | Show usage in status bar |
| `cursorCurseMonitor.statusBarUsageSource` | `autoApi` | `plan`, `autoApi`, or `both` |
| `cursorCurseMonitor.warnAtPercent` | `80` | Warning notification threshold |

## Development

```bash
npm install
npm run compile
npm test          # extension tests (Node 22+)
npm run package   # build .vsix
```

Press **F5** in Cursor/VS Code for the Extension Development Host.

**Admin panel (local):**

```bash
cd website/admin && npm install && npm run dev
# http://localhost:5173
```

See [website/admin/README.md](website/admin/README.md) and [AGENTS.md](AGENTS.md) for component-specific commands.

## CI/CD

| Workflow | File | Purpose |
|----------|------|---------|
| **CI/CD** | [`.github/workflows/ci-cd.yml`](.github/workflows/ci-cd.yml) | Extension build, admin deploy, GitHub Pages |
| **SEO** | [`.github/workflows/seo.yml`](.github/workflows/seo.yml) | Regenerate `site-data.json`, sitemap, validate canonical URLs |

### CI/CD triggers

| Trigger | Result |
|---------|--------|
| PR to `main` | Build, validate, package, SEO audit — no deploy |
| Push to `main` | Extension CI, admin build/deploy*, marketing site update, SEO publish* |
| Weekly (Mon 06:00 UTC) | Refresh SEO artifacts and marketplace stats |
| Manual dispatch | Version bump → marketplace publish → website |
| Tag `v*` | Marketplace deploy + GitHub Release + website |

\* Admin deploy requires `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`. SEO publish commits refreshed artifacts when they change.

Regenerate SEO locally:

```bash
npm run site:data && npm run site:seo && npm run site:seo:validate
```

Full setup: [DEPLOYMENT.md](DEPLOYMENT.md)

## Privacy

- Auth token stays on your machine; API calls go only to `api2.cursor.sh`
- Local insights read session titles, model names, and line-accept stats — never chat transcripts
- Opt-in install heartbeat uses an anonymous `installId` when enabled
- No third-party analytics in the extension itself

[Privacy policy](https://maijied.github.io/Cursor-Curse-Monitor-by-Lorapok/privacy.html)

## Links

| Resource | URL |
|----------|-----|
| Website | https://maijied.github.io/Cursor-Curse-Monitor-by-Lorapok/ |
| Admin (Mission Control) | https://cursor-dev.lorapok.tech |
| Open VSX (canonical) | https://open-vsx.org/extension/lorapok-labs/cursor-curse-monitor-by-lorapok |
| VS Code Marketplace | https://marketplace.visualstudio.com/items?itemName=LorapokLabs.cursor-curse-monitor-by-lorapok |
| GitHub Releases | https://github.com/Maijied/Cursor-Curse-Monitor-by-Lorapok/releases |
| Report a bug | [Issue templates](.github/ISSUE_TEMPLATE/) |
| Security | [.github/SECURITY.md](.github/SECURITY.md) |
| Lorapok Labs | https://lorapok.tech |

## Author

**Mohammad Maizied Hasan Majumder** (Maijied) — Founder & Principal Engineer @ [Lorapok Labs](https://lorapok.tech)

## License

**Proprietary product of [Lorapok Labs](https://lorapok.tech).**  
Founder: **Mohammad Maizied Hasan Majumder**

You may download, install, and use this extension for personal or internal use from official Lorapok Labs channels. You may **not** sell, redistribute, modify, or create derivative works without written permission from Lorapok Labs.

Full terms: [LICENSE](LICENSE) · [Terms of Use](https://maijied.github.io/Cursor-Curse-Monitor-by-Lorapok/terms.html)

## Disclaimer

Independent product by Lorapok Labs. Not affiliated with, endorsed by, or sponsored by Cursor / Anysphere.
