<div align="center">

  <img src="media/icon.png" alt="Cursor Curse Monitor by Lorapok" width="128" />

  <h1>Cursor Curse Monitor by Lorapok</h1>

  <p>
    <strong>Live Cursor usage dashboard for limits, budget, billing cycles, and free-fallback model switching.</strong>
  </p>

  <p>
    <a href="https://lorapok.tech">Lorapok Labs</a> · Built for Cursor IDE
  </p>

  <p>
    <a href="https://github.com/Maijied/Cursor-Curse-Monitor-by-Lorapok/actions"><img src="https://img.shields.io/github/actions/workflow/status/Maijied/Cursor-Curse-Monitor-by-Lorapok/ci.yml?branch=main&label=CI" alt="CI" /></a>
    <a href="https://open-vsx.org/extension/lorapok-labs/cursor-curse-monitor-by-lorapok"><img src="https://img.shields.io/badge/Open%20VSX-Lorapok%20Labs-blue" alt="Open VSX" /></a>
    <img src="https://img.shields.io/badge/license-MIT-green" alt="MIT License" />
    <img src="https://img.shields.io/badge/platform-Cursor%20%7C%20VS%20Code-6C5CE7" alt="Platform" />
  </p>

  <p>
    <img src="https://img.shields.io/badge/downloads-Coming%20Soon-orange" alt="Downloads" />
    <img src="https://img.shields.io/badge/views-Coming%20Soon-blue" alt="Views" />
    <img src="https://img.shields.io/badge/version-0.2.1-brightgreen" alt="Version" />
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

## Screenshots

Open the **Cursor Curse Monitor** panel in the activity bar after install to see:

- Usage progress bar (included / remaining)
- Billing cycle and days until reset
- On-demand status and spend
- Fallback model status when limit is crossed

## Installation

### From Open VSX (Cursor Marketplace)

1. Open **Extensions** in Cursor
2. Search `Cursor Curse Monitor by Lorapok` or `lorapok-labs.cursor-curse-monitor-by-lorapok`
3. Click **Install**

### From VSIX (local)

```bash
git clone https://github.com/Maijied/Cursor-Curse-Monitor-by-Lorapok.git
cd Cursor-Curse-Monitor-by-Lorapok
npm install
npm run compile
npm run package
cursor --install-extension cursor-curse-monitor-by-lorapok-0.1.0.vsix
```

Reload Cursor: `Developer: Reload Window`

## Configuration

| Setting | Default | Description |
|---------|---------|-------------|
| `cursorCurseMonitor.pollIntervalSeconds` | `60` | API refresh interval |
| `cursorCurseMonitor.customBudgetLimit` | `0` | Personal USD budget cap |
| `cursorCurseMonitor.autoApplyFallbackModel` | `true` | Auto-switch to Composer 2.5 (Fast off) at 100% |
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

## Privacy

- Auth token stays on your machine
- API calls go only to `api2.cursor.sh`
- No telemetry, analytics, or third-party tracking

## Development

```bash
npm install
npm run compile
npm run watch   # optional, during development
```

Press **F5** in Cursor/VS Code to launch the Extension Development Host.

## Privacy

**Only your logged-in Cursor account** can see usage in this extension. Team members' individual usage is not shown. See the [privacy policy](https://maijied.github.io/Cursor-Curse-Monitor-by-Lorapok/privacy.html).

## Publishing

See [DEPLOYMENT.md](DEPLOYMENT.md) for full CI/CD setup.

**Quick release:**

```bash
git tag v0.1.0
git push origin v0.1.0
```

Requires GitHub secret `OVSX_PAT`.

## Author

| Field | Detail |
|-------|--------|
| **Name** | Mohammad Maizied Hasan Majumder |
| **Alias** | Maijied |
| **Publisher** | Lorapok Labs (`lorapok-labs`) |
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
