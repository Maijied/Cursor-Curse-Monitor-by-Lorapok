<div align="center">

  <img src="media/logo.png" alt="Cursor Curse Monitor by Lorapok — Lorapok Larvae mascot" width="128" height="128" />

  <h1>Cursor Curse Monitor by Lorapok</h1>

  <p>
    <strong>Live Cursor usage dashboard for limits, budget, billing cycles, and free-fallback model switching.</strong>
  </p>

  <p>
    <strong>Supports every major VS Code wrapper AI IDE</strong> — install from Open VSX or the VS Code Marketplace and run in
    <strong>Cursor, Visual Studio Code, Windsurf, VSCodium, Void, Gitpod, Positron, Trae, Kiro, Qoder, PearAI, code-server, Eclipse Theia, Azure Data Studio, Coder</strong>, and any other VS Code–compatible host.
  </p>

  <p>
    <a href="https://lorapok.tech">Lorapok Labs</a> · Built for Cursor IDE & VS Code
  </p>

  <p>
    <a href="https://github.com/Maijied/Cursor-Curse-Monitor-by-Lorapok/actions"><img src="https://img.shields.io/github/actions/workflow/status/Maijied/Cursor-Curse-Monitor-by-Lorapok/ci-cd.yml?branch=main&label=CI%2FCD" alt="CI/CD" /></a>
    <a href="https://open-vsx.org/extension/lorapok-labs/cursor-curse-monitor-by-lorapok"><img src="https://img.shields.io/open-vsx/v/lorapok-labs/cursor-curse-monitor-by-lorapok?label=Open%20VSX" alt="Open VSX" /></a>
    <a href="https://marketplace.visualstudio.com/items?itemName=LorapokLabs.cursor-curse-monitor-by-lorapok"><img src="https://img.shields.io/visual-studio-marketplace/v/LorapokLabs.cursor-curse-monitor-by-lorapok?label=VS%20Code%20Marketplace" alt="VS Code Marketplace" /></a>
    <img src="https://img.shields.io/badge/license-GPL--3.0-blue" alt="GPL-3.0 License" />
    <img src="https://img.shields.io/badge/platform-All%20VS%20Code%20AI%20IDEs-6C5CE7" alt="All VS Code AI IDEs" />
  </p>

  <p>
    <a href="https://github.com/Maijied/Cursor-Curse-Monitor-by-Lorapok/releases/latest"><img src="https://img.shields.io/github/v/release/Maijied/Cursor-Curse-Monitor-by-Lorapok?label=Latest%20Release" alt="Latest Release" /></a>
    <img src="https://img.shields.io/endpoint?url=https://raw.githubusercontent.com/Maijied/Cursor-Curse-Monitor-by-Lorapok/main/website/stats/badge.json" alt="Total downloads (live)" />
    <img src="https://img.shields.io/endpoint?url=https://raw.githubusercontent.com/Maijied/Cursor-Curse-Monitor-by-Lorapok/main/website/stats/badge-openvsx.json" alt="Open VSX canonical downloads" />
    <img src="https://img.shields.io/endpoint?url=https://raw.githubusercontent.com/Maijied/Cursor-Curse-Monitor-by-Lorapok/main/website/stats/badge-openvsx-total.json" alt="Open VSX total downloads" />
    <img src="https://img.shields.io/endpoint?url=https://raw.githubusercontent.com/Maijied/Cursor-Curse-Monitor-by-Lorapok/main/website/stats/badge-vscode.json" alt="VS Code Marketplace downloads" />
  </p>

  <p align="center">
    <a href="https://cursor.lorapok.tech/site-data.json">
      <img src="https://cursor.lorapok.tech/readme-stats.png" alt="Community download stats chart" width="720" />
    </a>
  </p>
  <p><sub>📊 <a href="https://cursor.lorapok.tech/readme-stats.png">Download chart</a> · counts synced from marketplace APIs in CI · <a href="https://cursor.lorapok.tech/site-data.json">site-data.json</a> · live overlay from <a href="https://cursor-dev.lorapok.tech/api/site-data">Mission Control</a></sub></p>

</div>

---

## Overview

**Cursor Curse Monitor by Lorapok** helps developers track Cursor AI usage in real time — included limits, remaining quota, billing cycle reset, on-demand spend, and automatic fallback to **Composer 2.5 (Fast off)** when limits are exceeded (free slow-pool mode).

**This extension supports all VS Code wrapper–based AI IDEs** where Open VSX or the VS Code Marketplace is available — not just Cursor. One install works across Cursor, Windsurf, VSCodium, Void, Gitpod/Ona, Positron, Trae, Kiro, Qoder, PearAI, code-server, Eclipse Theia, Azure Data Studio, Coder, and Visual Studio Code itself.

> *"Know your limits before they know you."* — Lorapok Labs

More Lorapok Labs software: [lorapok.tech](https://lorapok.tech)

## Features

| Feature | Description |
|--------|-------------|
| **Sidebar dashboard** | Activity bar → **Cursor Curse Monitor** |
| **Status bar** | Live usage percentage at a glance |
| **Auto refresh** | Polls Cursor API every 60s (configurable) |
| **Custom budget** | Set a personal USD cap in the dashboard |
| **Limit alerts** | Warning at 80% (configurable) |
| **Free fallback** | Auto-switches to Composer 2.5 (Fast off) at 100% |
| **Team aware** | Shows team vs individual limit type |
| **DB safety** | Atomic writes, backup/restore, integrity checks |

## Screenshots

Open the **Cursor Curse Monitor** panel in the activity bar after install to see:

- Usage progress bar (included / remaining)
- Billing cycle and days until reset
- On-demand status and spend
- Fallback model status when limit is crossed

## Installation

> **Also available on:** [Open VSX](https://open-vsx.org/extension/lorapok-labs/cursor-curse-monitor-by-lorapok) · [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=LorapokLabs.cursor-curse-monitor-by-lorapok) · Firefox AMO *(coming soon — use [GitHub Release](https://github.com/Maijied/Cursor-Curse-Monitor-by-Lorapok/releases/latest) meanwhile)* · [Chrome zip](https://github.com/Maijied/Cursor-Curse-Monitor-by-Lorapok/releases/latest) · [Product site](https://cursor.lorapok.tech/)

The [marketing site](https://cursor.lorapok.tech/) hero uses **animated live download and visit meters** synced from marketplace APIs — product screenshots appear once in the ecosystem tabs, not duplicated across the page.

### From Open VSX (Cursor Marketplace) — Recommended for Cursor

1. Open **Extensions** in Cursor
2. Search `Cursor Curse Monitor by Lorapok` or `lorapok-labs.cursor-curse-monitor-by-lorapok`
3. Click **Install**

**Direct link:** [Open VSX Registry](https://open-vsx.org/extension/lorapok-labs/cursor-curse-monitor-by-lorapok)

### From VS Code Marketplace — Recommended for VS Code

1. Open **Extensions** in VS Code
2. Search `Cursor Curse Monitor by Lorapok` or `LorapokLabs.cursor-curse-monitor-by-lorapok`
3. Click **Install**

**Direct link:** [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=LorapokLabs.cursor-curse-monitor-by-lorapok)

### From VSIX (manual)

```bash
git clone https://github.com/Maijied/Cursor-Curse-Monitor-by-Lorapok.git
cd Cursor-Curse-Monitor-by-Lorapok
npm install
npm run compile
npm run package
cursor --install-extension *.vsix
```

Reload Cursor: `Developer: Reload Window`

## Configuration

| Setting | Default | Description |
|---------|---------|-------------|
| `cursorCurseMonitor.pollIntervalSeconds` | `60` | API refresh interval |
| `cursorCurseMonitor.customBudgetLimit` | `0` | Personal USD budget cap |
| `cursorCurseMonitor.autoApplyFallbackModel` | `false` | Auto-switch to Composer 2.5 (Fast off) at 100%. Rewrites `state.vscdb`; unsafe on large databases. |
| `cursorCurseMonitor.showStatusBar` | `true` | Show usage in status bar |
| `cursorCurseMonitor.statusBarUsageSource` | `autoApi` | Status bar numbers: `plan` (included/budget %), `autoApi` (Auto · API %), or `both` |
| `cursorCurseMonitor.warnAtPercent` | `80` | Warning notification threshold |

### Status bar

Toggle visibility and choose which Cursor usage numbers appear in the bottom status bar. Open **Cursor Settings → Extensions → Cursor Curse Monitor by Lorapok**.

- `cursorCurseMonitor.showStatusBar` — show or hide the status bar item.
- `cursorCurseMonitor.statusBarUsageSource`:
  - `plan` — included quota (`totalPercentUsed`) or USD budget %, rounded. Same number as the dashboard Usage gauge. This is **not** the API features percent.
  - `autoApi` (default) — `Auto X% · API Y%` from Cursor (`autoPercentUsed` / `apiPercentUsed`), up to 2 decimal places. Same numbers as the **API features** chip.
  - `both` — plan percent plus Auto/API.

Hover the status bar to see Plan, Auto, and API percentages together.

## Commands

| Command | Description |
|---------|-------------|
| `Cursor Curse Monitor: Open Dashboard` | Open sidebar panel |
| `Cursor Curse Monitor: Refresh Now` | Force refresh usage data |
| `Cursor Curse Monitor: Apply Free Fallback Model` | Manually apply Composer 2.5 (Fast off) |

## How it works

1. Reads `cursorAuth/accessToken` from Cursor's local SQLite state (`state.vscdb`)
2. Calls `https://api2.cursor.sh/auth/usage-summary`
3. Calls `https://api2.cursor.sh/auth/full_stripe_profile`
4. When usage ≥ 100%, optionally writes Composer 2.5 (Fast off) into Cursor model config

> **Note:** Uses undocumented Cursor internal APIs. Behavior may change if Cursor updates their endpoints.

### Database Safety

The extension takes multiple precautions when writing to the Cursor state database:

- **Pre-write integrity check** — validates SQLite header, file size, and existence
- **Automatic backup** — creates a timestamped backup before any write
- **Atomic writes** — writes to a temp file then renames (with cross-filesystem fallback)
- **Post-write verification** — validates integrity after writing
- **Automatic restore** — restores from backup on any failure
- **Retry with backoff** — retries once after restoring the backup
- **Timeout protection** — operations abort after 15s to prevent hangs
- **Parameterized queries** — prevents SQL injection
- **Stale backup cleanup** — removes old backups automatically

## CI/CD

All CI/CD is managed by a **single workflow** ([ci-cd.yml](.github/workflows/ci-cd.yml)). **Marketplace publishing is manual** — pushes to `main` run CI and update the website; releases are triggered from Mission Control or GitHub Actions.

| Trigger | What happens |
|---------|-------------|
| **PR to `main`** | Build, compile, validate, package — no deploy |
| **Push to `main`** | Extension CI, admin CI, marketing site deploy |
| **Manual dispatch** | Version bump → tag → publish to selected marketplaces (Open VSX, VS Code, Firefox AMO, or Both) |
| **Deploy existing tag** | Re-publish a prior tag without rewriting `main` |
| **Rollback** | Restore a previous tag as a new patch release |

### Releases (master admin only)

Production releases are dispatched from **[Mission Control](https://cursor-dev.lorapok.tech)** (Deployments) or **Actions → CI/CD → Run workflow**. Only the master admin account can trigger deploy, release, and rollback APIs.

1. Choose **Release Channel** (Production or Beta)
2. Choose **Publish Market** (`Both`, `Open VSX`, `VS Code Marketplace`, or `Firefox AMO`)
3. Select version bump type or custom version

### Dynamic versioning

Root `package.json` holds the **production base version** (e.g. `1.0.1`). Workspace packages (`browser-extension`, `packages/shared`) stay at `0.0.0` in git; `npm run version:sync` resolves the real semver at build time.

See [DEPLOYMENT.md](DEPLOYMENT.md) for full setup details.

## Privacy

**Only your logged-in Cursor account** can see usage in this extension. Team members' individual usage is not shown.

- Auth token stays on your machine
- API calls go only to `api2.cursor.sh`
- No telemetry, analytics, or third-party tracking

See the [privacy policy](https://maijied.github.io/Cursor-Curse-Monitor-by-Lorapok/privacy.html).

## Development

```bash
npm install
npm run compile
npm run watch   # optional, during development
```

Press **F5** in Cursor/VS Code to launch the Extension Development Host.

## Publishing

See [DEPLOYMENT.md](DEPLOYMENT.md) and [MARKETPLACE_PUBLISHING.md](MARKETPLACE_PUBLISHING.md) for full CI/CD setup.

Requires GitHub secrets:
- `OVSX_PAT` — Open VSX access token
- `VSCE_PAT` — VS Code Marketplace personal access token
- `AMO_JWT_ISSUER` / `AMO_JWT_SECRET` — Firefox Add-ons API (browser extension)

## Marketplace Links

| Marketplace | URL |
|-------------|-----|
| **Open VSX** (Cursor) | https://open-vsx.org/extension/lorapok-labs/cursor-curse-monitor-by-lorapok |
| **VS Code Marketplace** | https://marketplace.visualstudio.com/items?itemName=LorapokLabs.cursor-curse-monitor-by-lorapok |
| **Firefox Add-ons** (browser) | AMO listing pending — install from [GitHub Releases](https://github.com/Maijied/Cursor-Curse-Monitor-by-Lorapok/releases/latest) until published |
| **GitHub Releases** | https://github.com/Maijied/Cursor-Curse-Monitor-by-Lorapok/releases |
| **Mission Control** (admin) | https://cursor-dev.lorapok.tech |
| **Project Website** | https://maijied.github.io/Cursor-Curse-Monitor-by-Lorapok/ |

## Author

| Field | Detail |
|-------|--------|
| **Name** | Mohammad Maizied Hasan Majumder |
| **Alias** | Maijied |
| **Publisher** | Lorapok Labs (`lorapok-labs` on Open VSX, `LorapokLabs` on VS Code Marketplace) |
| **Role** | Founder and Principal Engineer @ [Lorapok Labs](https://lorapok.tech) · Senior Software Engineer @ [Shohoz Ltd](https://shohoz.com) |
| **Location** | Dhaka, Bangladesh |
| **Email** | [admin@lorapok.tech](mailto:admin@lorapok.tech) |
| **GitHub** | [@Maijied](https://github.com/Maijied) |

## Contributors

Thanks to everyone who has improved the project through pull requests:

| Contributor | Contribution |
|-------------|--------------|
| [**Andrew Ryder**](https://github.com/andrewtryder) | File-backed SQLite auth reads (fixes large `state.vscdb` crashes), configurable status bar usage source (`plan` / `autoApi` / `both`) — [PR #1](https://github.com/Maijied/Cursor-Curse-Monitor-by-Lorapok/pull/1) |

See also [AUTHORS.md](AUTHORS.md) and [CONTRIBUTING.md](CONTRIBUTING.md) if you would like to contribute.

### Lorapok Labs

| | |
|---|---|
| **Company** | [Lorapok Labs](https://lorapok.tech) |
| **Model** | Mostly open source — **20+** public projects |
| **Focus** | Cross-platform media, Laravel packages, Android AI |
| **Platforms** | Web · Windows · Mac · Linux · Android · npm · PyPI · Packagist |

> *"Code is the language of the future. Every line written is a step toward it."*  
> — **Maizied**

## License

GPL-3.0 © [Mohammad Maizied Hasan Majumder](https://github.com/Maijied) / [Lorapok Labs](https://lorapok.tech)

See [LICENSE](LICENSE) for details. Community standards are in [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).

## Code of Conduct

This project follows the [Contributor Covenant](CODE_OF_CONDUCT.md). Please be respectful in issues, discussions, and contributions.

## Disclaimer

This extension is an independent open-source product by Lorapok Labs. It is not affiliated with, endorsed by, or sponsored by Cursor / Anysphere. "Cursor" is a trademark of its respective owner.
