# Deployment Guide

## CI/CD Overview

All CI/CD is managed by a **single smart workflow**: [`.github/workflows/ci-cd.yml`](.github/workflows/ci-cd.yml)

| Trigger | Jobs | What it does |
|---------|------|-------------|
| **PR to `main`** | `ci` | Compile, validate assets, package VSIX |
| **Push to `main`** | `ci` → `website` | Builds dynamic per-commit Beta VSIX, saves as artifact, deploys website |
| **Manual dispatch** | `release-bump` → `deploy` → `website` | Auto-bumps version, commits/tags, conditionally publishes to marketplaces, deploys website |
| **Tag `v*` push** | `deploy` → `website` | Publishes existing tag to marketplaces, creates GitHub Release, deploys website |

### 1. Continuous Integration (Dynamic Per-Commit Builds)

Every push to `main` automatically:
1. Builds and validates the extension.
2. Dynamically generates a version using the commit hash (e.g., `0.5.2-beta.a1b2c3d`).
3. Packages the VSIX and saves it as a **workflow artifact**.
4. Deploys the project website to ensure documentation is always up to date.

> **Note:** Pushes to `main` do **NOT** automatically publish to the public marketplaces.

### 2. Manual Releases (Marketplace Publishing)

To actually publish a new version (Beta or Production) to the marketplaces:

1. Go to **Actions → CI/CD → Run workflow**
2. Configure the release:
   - **Publish Market**: `Both`, `VS Code Marketplace`, or `Open VSX`
   - **Release Channel**: `Production` or `Beta (Pre-release)`
   - **Version Bump Type**: `patch`, `minor`, `major`, `prepatch`, `preminor`, `prerelease`, or `custom`
   - **Custom Version**: (Only if you selected `custom` above)
3. Click **Run workflow**

The workflow will automatically bump `package.json`, commit, tag, and publish to the selected marketplaces with the appropriate flags (e.g., `--pre-release` for Beta).

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
# Open VSX (canonical lorapok-labs namespace — do NOT use bare ovsx publish)
npm run package
npm run publish:ovsx

# VS Code Marketplace (uses LorapokLabs from package.json)
npx vsce publish -p $VSCE_PAT

# Verify all channels match package.json version
npm run verify:marketplace
```

### Open VSX publisher namespaces

| Namespace | Purpose | How it is published |
|-----------|---------|---------------------|
| **`lorapok-labs`** | Canonical Open VSX listing (verified) | `npm run publish:ovsx` repacks VSIX with this publisher |
| **`LorapokLabs`** | VS Code Marketplace publisher only | `vsce publish` — **never** bare `ovsx publish` |

`package.json` keeps `"publisher": "LorapokLabs"` for VS Code Marketplace. The `ovsx` CLI reads the publisher from the VSIX manifest, so CI uses `scripts/publish-ovsx.mjs` to repack before publishing to `lorapok-labs`.

If search shows two Open VSX listings, the duplicate `LorapokLabs/...` entry was created by earlier bare `ovsx publish` runs. After syncing `lorapok-labs` to the latest version, request deprecation of the duplicate via [Open VSX](https://open-vsx.org).

Or trigger the **Sync Open VSX (Canonical)** workflow after pushing:

1. Push changes to `main`
2. **Actions → Sync Open VSX (Canonical) → Run workflow**
3. Confirm `verify-marketplace-sync.mjs --strict` passes in the workflow log

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
3. Extract the downloaded ZIP file.
4. Install:

```bash
cursor --install-extension cursor-curse-monitor-by-lorapok-*.vsix
```

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Activity bar shows gray square | Use SVG icon (`media/activity-bar.svg`) — fixed in v0.2.0 |
| Open VSX version drift (lorapok-labs behind) | Run `npm run package && npm run publish:ovsx` with `OVSX_PAT` set |
| Duplicate Open VSX listing (LorapokLabs) | Stop using bare `ovsx publish`; use `publish-ovsx.mjs`; request duplicate deprecation |
| Deploy fails on Open VSX | Check `OVSX_PAT` secret and namespace `lorapok-labs` |
| Deploy fails on VS Code Marketplace | Check `VSCE_PAT` secret and publisher `LorapokLabs` |
| "Already published" warning | Normal — CI treats this as success. Bump version if you need to re-publish |
| Extension not in Cursor search | Lower `engines.vscode` if too high; reload window; wait for Open VSX sync |
| Workflow push rejected | Run `gh auth refresh -h github.com -s workflow` |
| Website not updating | Check GitHub Pages is enabled with source: GitHub Actions |
| DB backup files accumulating | Stale backups (>1 hour old) are cleaned up automatically |
