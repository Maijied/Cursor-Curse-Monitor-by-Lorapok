<div align="center">

  <img src="media/icon.png" alt="Cursor Curse Monitor by Lorapok" width="128" />

  <h1>Cursor Curse Monitor by Lorapok</h1>

  <p>
    <strong>Live Cursor usage dashboard for limits, budget, billing cycles, and free-fallback model switching.</strong>
  </p>

  <p>
    <a href="https://lorapok.tech">Lorapok Labs</a> · Built for Cursor IDE & VS Code
  </p>

  <p>
    <a href="https://github.com/Maijied/Cursor-Curse-Monitor-by-Lorapok/actions"><img src="https://img.shields.io/github/actions/workflow/status/Maijied/Cursor-Curse-Monitor-by-Lorapok/ci-cd.yml?branch=main&label=CI%2FCD" alt="CI/CD" /></a>
    <a href="https://open-vsx.org/extension/lorapok-labs/cursor-curse-monitor-by-lorapok"><img src="https://img.shields.io/open-vsx/v/lorapok-labs/cursor-curse-monitor-by-lorapok?label=Open%20VSX" alt="Open VSX" /></a>
    <a href="https://marketplace.visualstudio.com/items?itemName=LorapokLabs.cursor-curse-monitor-by-lorapok"><img src="https://img.shields.io/visual-studio-marketplace/v/LorapokLabs.cursor-curse-monitor-by-lorapok?label=VS%20Code%20Marketplace" alt="VS Code Marketplace" /></a>
    <img src="https://img.shields.io/badge/license-MIT-green" alt="MIT License" />
    <img src="https://img.shields.io/badge/platform-Cursor%20%7C%20VS%20Code-6C5CE7" alt="Platform" />
  </p>

  <p>
    <a href="https://github.com/Maijied/Cursor-Curse-Monitor-by-Lorapok/releases/latest"><img src="https://img.shields.io/github/v/release/Maijied/Cursor-Curse-Monitor-by-Lorapok?label=Latest%20Release" alt="Latest Release" /></a>
    <a href="https://github.com/Maijied/Cursor-Curse-Monitor-by-Lorapok/releases"><img src="https://img.shields.io/github/downloads/Maijied/Cursor-Curse-Monitor-by-Lorapok/total?label=Downloads" alt="Downloads" /></a>
  </p>

</div>

---

## Overview

**Cursor Curse Monitor by Lorapok** helps developers track Cursor AI usage in real time — included limits, remaining quota, billing cycle reset, on-demand spend, and automatic fallback to **Composer 2.5 (Fast off)** when limits are exceeded (free slow-pool mode).

> *"Know your limits before they know you."* — Lorapok Labs

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
| `cursorCurseMonitor.warnAtPercent` | `80` | Warning notification threshold |

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

All CI/CD is managed by a **single workflow** ([ci-cd.yml](.github/workflows/ci-cd.yml)):

| Trigger | What happens |
|---------|-------------|
| **PR to `main`** | Build, compile, validate, package — no deploy |
| **Push to `main`** | Auto-patch bump → deploy to both marketplaces → update website |
| **Manual dispatch** | Major/minor/patch bump → deploy → update website |
| **Tag `v*`** | Deploy to both marketplaces → update website |

### Auto-patch (default)

Every push to `main` automatically:
1. Bumps the patch version (e.g., `0.5.0` → `0.5.1`)
2. Creates and pushes a git tag
3. Publishes to Open VSX + VS Code Marketplace
4. Creates a GitHub Release with VSIX
5. Updates the project website

### Major/Minor releases

For breaking or feature releases, use GitHub Actions:
1. Go to **Actions → CI/CD → Run workflow**
2. Select `major` or `minor`
3. Optionally set a custom version
4. Run

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

See [DEPLOYMENT.md](DEPLOYMENT.md) for full CI/CD setup.

Requires GitHub secrets:
- `OVSX_PAT` — Open VSX access token
- `VSCE_PAT` — VS Code Marketplace personal access token

## Marketplace Links

| Marketplace | URL |
|-------------|-----|
| **Open VSX** (Cursor) | https://open-vsx.org/extension/lorapok-labs/cursor-curse-monitor-by-lorapok |
| **VS Code Marketplace** | https://marketplace.visualstudio.com/items?itemName=LorapokLabs.cursor-curse-monitor-by-lorapok |
| **GitHub Releases** | https://github.com/Maijied/Cursor-Curse-Monitor-by-Lorapok/releases |
| **Project Website** | https://maijied.github.io/Cursor-Curse-Monitor-by-Lorapok/ |

## Author

| Field | Detail |
|-------|--------|
| **Name** | Mohammad Maizied Hasan Majumder |
| **Alias** | Maijied |
| **Publisher** | Lorapok Labs (`lorapok-labs` on Open VSX, `LorapokLabs` on VS Code Marketplace) |
| **Role** | Founder and Principal Engineer @ [Lorapok Labs](https://lorapok.tech) · Senior Software Engineer @ [Shohoz Ltd](https://shohoz.com) |
| **Location** | Dhaka, Bangladesh |
| **Email** | [mdshuvo40@gmail.com](mailto:mdshuvo40@gmail.com) |
| **GitHub** | [@Maijied](https://github.com/Maijied) |

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

MIT © [Mohammad Maizied Hasan Majumder](https://github.com/Maijied) / [Lorapok Labs](https://lorapok.tech)

See [LICENSE](LICENSE) for details.

## Disclaimer

This extension is an independent open-source product by Lorapok Labs. It is not affiliated with, endorsed by, or sponsored by Cursor / Anysphere. "Cursor" is a trademark of its respective owner.
