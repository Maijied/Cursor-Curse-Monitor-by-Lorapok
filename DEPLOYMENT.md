# Deployment Guide

## CI/CD overview

| Workflow | Trigger | What it does |
|----------|---------|--------------|
| **CI** | Push/PR to `main` | Compile, package VSIX, upload artifact |
| **Deploy** | Tag `v*` or manual | Package, publish Open VSX, GitHub Release |

## One-time setup

### 1. GitHub secrets

In **Settings → Secrets and variables → Actions**, add:

| Secret | Required | Description |
|--------|----------|-------------|
| `OVSX_PAT` | Yes (for deploy) | Open VSX access token from [open-vsx.org](https://open-vsx.org) |

### 2. Open VSX namespace

```bash
npx ovsx create-namespace lorapok-labs -p <OVSX_PAT>
```

### 3. GitHub environment (optional)

Create environment **`production`** in repo settings if you want approval gates before deploy.

## Deploy a release

### Recommended: tag release

```bash
./scripts/release.sh patch   # bump patch, tag, push — CI does the rest
# or
./scripts/release.sh minor
./scripts/release.sh         # tag current package.json version
```

This runs **Deploy** workflow automatically:
1. Builds VSIX
2. Publishes to Open VSX
3. Creates GitHub Release with VSIX attached

The **website** rebuilds on push and auto-fills install commands from GitHub + Open VSX APIs (`npm run site:data`).

### Manual deploy

1. Go to **Actions → Deploy → Run workflow**
2. Set version (optional)
3. Toggle Open VSX publish / GitHub release
4. Run

## Install from CI artifact

1. Open **Actions → CI** run
2. Download **cursor-curse-monitor-vsix-*** artifact
3. Install:

```bash
cursor --install-extension cursor-curse-monitor-by-lorapok-0.1.0.vsix
```

## Cursor marketplace

After Open VSX publish, wait a few hours for Cursor to sync, then search:

`lorapok-labs.cursor-curse-monitor-by-lorapok`

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Deploy fails on Open VSX | Check `OVSX_PAT` secret and namespace `lorapok-labs` (Lorapok Labs) |
| "Already published but isn't active" | Log into [open-vsx.org](https://open-vsx.org), open extension settings, delete the inactive version, bump version, and re-tag |
| Extension not in Cursor search | Lower `engines.vscode` if too high; reload window; wait for Open VSX sync |
| Workflow push rejected | Run `gh auth refresh -h github.com -s workflow` |
