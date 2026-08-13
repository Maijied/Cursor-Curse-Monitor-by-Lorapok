# Deployment Guide

## CI/CD Overview

All CI/CD is managed by a **single workflow**: [`.github/workflows/ci-cd.yml`](.github/workflows/ci-cd.yml)

| Trigger | Jobs | What it does |
|---------|------|-------------|
| **PR to `main`** | `ci` | Compile, validate assets, package VSIX, upload artifact |
| **Push to `main`** | `ci` → `auto-patch` → `deploy` → `website` | Auto-bump patch, tag, publish to both marketplaces, update website |
| **Manual dispatch** | `manual-bump` → `deploy` → `website` | Bump major/minor/patch, tag, publish, update website |
| **Tag `v*` push** | `deploy` → `website` | Publish to both marketplaces, create GitHub Release, update website |

### Auto-Patch (Default)

Every push to `main` automatically:
1. Builds and validates the extension
2. Bumps the patch version (e.g., `0.5.0` → `0.5.1`)
3. Commits the version bump and creates a git tag
4. Publishes to Open VSX and VS Code Marketplace
5. Creates a GitHub Release with VSIX attached
6. Deploys the website with fresh marketplace data

> **Note:** Bot commits (from `github-actions[bot]`) are skipped to prevent infinite loops.

### Manual Major/Minor Releases

For breaking changes or new features:
1. Go to **Actions → CI/CD → Run workflow**
2. Select `major`, `minor`, or `patch`
3. Optionally enter a custom version
4. Check "Create GitHub Release" (default: true)
5. Click **Run workflow**

---

## One-Time Setup

### 1. GitHub Secrets

In **Settings → Secrets and variables → Actions**, add:

| Secret | Required | Description |
|--------|----------|-------------|
| `OVSX_PAT` | Yes (Open VSX) | Open VSX access token from [open-vsx.org](https://open-vsx.org) |
| `VSCE_PAT` | Yes (VS Code) | Azure DevOps PAT for [VS Code Marketplace](https://marketplace.visualstudio.com/) |

### 2. VS Code Marketplace Publisher

1. Create a publisher at [marketplace.visualstudio.com/manage](https://marketplace.visualstudio.com/manage) with name `LorapokLabs`
2. Generate an Azure DevOps Personal Access Token with **Marketplace (Manage)** scope
3. Add it as GitHub secret `VSCE_PAT`

### 3. Open VSX Namespace

```bash
npx ovsx create-namespace lorapok-labs -p <OVSX_PAT>
```

### 4. GitHub Pages

Enable GitHub Pages in repo settings:
- Source: **GitHub Actions**

### 5. GitHub Environment (Optional)

Create environment **`production`** in repo settings if you want approval gates before deploy.

---

## Local Development Release

For testing locally:

```bash
npm run compile
npm run package
cursor --install-extension *.vsix
```

For a manual local publish:

```bash
# Open VSX
npx ovsx publish -p $OVSX_PAT

# VS Code Marketplace
npx vsce publish -p $VSCE_PAT
```

Or use the release script for a tag-based release:

```bash
./scripts/release.sh patch   # bump patch, tag, push — CI does the rest
./scripts/release.sh minor   # bump minor
./scripts/release.sh         # tag current package.json version
```

---

## Marketplace Links

| Marketplace | URL |
|-------------|-----|
| **Open VSX** (Cursor) | https://open-vsx.org/extension/lorapok-labs/cursor-curse-monitor-by-lorapok |
| **VS Code Marketplace** | https://marketplace.visualstudio.com/items?itemName=LorapokLabs.cursor-curse-monitor-by-lorapok |
| **GitHub Releases** | https://github.com/Maijied/Cursor-Curse-Monitor-by-Lorapok/releases |
| **Project Website** | https://maijied.github.io/Cursor-Curse-Monitor-by-Lorapok/ |

After publish, search in Extensions:

- **Cursor (Open VSX):** `lorapok-labs.cursor-curse-monitor-by-lorapok`
- **VS Code Marketplace:** `LorapokLabs.cursor-curse-monitor-by-lorapok`

---

## Install from CI Artifact

1. Open **Actions → CI/CD** run
2. Download **cursor-curse-monitor-vsix-*** artifact
3. Install:

```bash
cursor --install-extension cursor-curse-monitor-by-lorapok-*.vsix
```

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Activity bar shows gray square | Use SVG icon (`media/activity-bar.svg`) — fixed in v0.2.0 |
| Deploy fails on Open VSX | Check `OVSX_PAT` secret and namespace `lorapok-labs` |
| Deploy fails on VS Code Marketplace | Check `VSCE_PAT` secret and publisher `LorapokLabs` |
| "Already published" warning | Normal — CI treats this as success. Bump version if you need to re-publish |
| Extension not in Cursor search | Lower `engines.vscode` if too high; reload window; wait for Open VSX sync |
| Workflow push rejected | Run `gh auth refresh -h github.com -s workflow` |
| Auto-patch creates too many releases | This is by design — every push to `main` creates a release. Use feature branches and PRs to batch changes |
| Website not updating | Check GitHub Pages is enabled with source: GitHub Actions |
| DB backup files accumulating | Stale backups (>1 hour old) are cleaned up automatically |
