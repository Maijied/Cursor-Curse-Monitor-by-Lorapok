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
| `OVSX_PAT` | Yes (for Open VSX) | Open VSX access token from [open-vsx.org](https://open-vsx.org) |
| `VSCE_PAT` | Optional | Azure DevOps PAT for [VS Code Marketplace](https://marketplace.visualstudio.com/) publish |

### 2. VS Code Marketplace publisher

1. Create a publisher at [marketplace.visualstudio.com/manage](https://marketplace.visualstudio.com/manage) with name `LorapokLabs`
2. Generate an Azure DevOps Personal Access Token with **Marketplace (Manage)** scope
3. Add it as GitHub secret `VSCE_PAT`

Local publish:

```bash
npx vsce login LorapokLabs
npm run publish:vscode
```

### 3. Open VSX namespace

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
3. Publishes to VS Code Marketplace (if `VSCE_PAT` is set)
4. Creates GitHub Release with VSIX attached

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

## Cursor / VS Code marketplace

After publish, search in Extensions:

- **Open VSX / Cursor:** `lorapok-labs.cursor-curse-monitor-by-lorapok`
- **VS Code Marketplace:** [Cursor Curse Monitor by Lorapok](https://marketplace.visualstudio.com/search?term=lorapok-labs.cursor-curse-monitor-by-lorapok)

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Activity bar shows gray square | Use SVG icon (`media/activity-bar.svg`) — fixed in v0.2.0 |
| Deploy fails on Open VSX | Check `OVSX_PAT` secret and namespace `lorapok-labs` (Lorapok Labs) |
| "Already published but isn't active" | Log into [open-vsx.org](https://open-vsx.org), open extension settings, delete the inactive version, bump version, and re-tag |
| Extension not in Cursor search | Lower `engines.vscode` if too high; reload window; wait for Open VSX sync |
| Workflow push rejected | Run `gh auth refresh -h github.com -s workflow` |
