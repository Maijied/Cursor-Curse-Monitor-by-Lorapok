# Deployment Guide

> **Architecture overview:** domains, hosting, Cloudflare migration, and system diagram — [README.md § Architecture](README.md#architecture).

## CI/CD Overview

All CI/CD is managed by a **single smart workflow**: [`.github/workflows/ci-cd.yml`](.github/workflows/ci-cd.yml)

| Trigger | Jobs | What it does |
|---------|------|-------------|
| **PR to `main`** | `ci` | Compile, validate assets, package VSIX |
| **Push to `main`** | `ci` → `admin-ci` → `website` | Extension CI, admin build, marketing site — **no marketplace publish** |
| **Manual dispatch** | `release-bump` → `deploy` → `website` | Version bump, commit/tag, publish to selected marketplaces, deploy website |
| **Deploy existing tag** | `deploy` | Re-publish a prior tag without rewriting `main` |
| **Rollback** | `rollback` | Restore prior tag as new patch release |

**Master admin only:** Mission Control deploy/release/rollback APIs require `ADMIN_MASTER_EMAIL`. Admin and website production deploy jobs are `workflow_dispatch`-only.

**Manual QA:** see [`docs/ADMIN_MANUAL_TEST.md`](docs/ADMIN_MANUAL_TEST.md) before tagging a stable release.

### Dynamic versioning

Root `package.json` holds the production base version. Workspace packages (`browser-extension`, `packages/shared`) use `0.0.0` in git; CI and local builds run `npm run version:sync` to resolve the real semver before packaging.

```bash
npm run version:check   # verify sync state
npm run version:sync    # write resolved versions
```

### 1. Continuous Integration

Every push to `main` automatically:
1. Builds and validates the extension and admin panel.
2. Regenerates `site-data.json` / `seo.json`.
3. Deploys the marketing website to GitHub Pages.

> **Note:** Pushes to `main` do **NOT** automatically publish to public marketplaces.

### 2. Manual Releases (Marketplace Publishing)

To publish a new version (Beta or Production):

1. Go to **Mission Control → Deployments** (master admin) or **Actions → CI/CD → Run workflow**
2. Configure the release:
   - **Publish Market**: `Both`, `VS Code Marketplace`, `Open VSX`, or `Firefox AMO`
   - **Release Channel**: `Production` or `Beta (Pre-release)`
   - **Version Bump Type**: `patch`, `minor`, `major`, `prepatch`, `preminor`, `prerelease`, or `custom`
   - **Custom Version**: (Only if you selected `custom` above)
3. Click **Run workflow**

The workflow bumps root `package.json`, runs `version:sync`, builds, tags, and publishes to the selected marketplaces.

---

## One-Time Setup

### 1. GitHub Secrets

In **Settings → Secrets and variables → Actions**, add:

| Secret | Required | Description |
|--------|----------|-------------|
| `OVSX_PAT` | Yes (Open VSX) | Open VSX access token from [open-vsx.org](https://open-vsx.org) |
| `VSCE_PAT` | Yes (VS Code) | Azure DevOps PAT for [VS Code Marketplace](https://marketplace.visualstudio.com/) |
| `AMO_JWT_ISSUER` | Yes (Firefox) | Firefox Add-ons API JWT issuer |
| `AMO_JWT_SECRET` | Yes (Firefox) | Firefox Add-ons API JWT secret |

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

## Development

```bash
npm install          # also runs husky via prepare
npm run compile
npm test          # extension tests (Node 22+)
npm run security:scan   # full-repo secretlint (same as CI)
npm run package   # build .vsix
```

### Pre-commit (contributors)

After `npm install`, Husky installs a pre-commit hook that runs `secretlint` on **staged** files. To scan the entire repo:

```bash
npm run security:scan
```

Config: [`.secretlintrc.json`](.secretlintrc.json). Test fixtures under `tests/` and docs under `website/` are allowlisted where appropriate.

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

## Admin Panel (Mission Control)

**Target URL:** `https://cursor-dev.lorapok.tech` (Pages origin: `https://cursor-monitor-admin-2x8.pages.dev`)

**Cloudflare account:** **Lorapok Facility** (`f049faaf2f67549f5c58837479596a4a`) only.  
Do **not** use orphan Worker builds under other accounts (e.g. `cursor-curse-monitor-by-lorapok` Workers Builds) — that Worker is not part of this repo. Mail: `cursor-contact@lorapok.tech` (Email Routing → Gmail).

The admin SPA lives in `website/admin/` and deploys to **Cloudflare Pages** with co-located **Pages Functions** (`website/admin/functions/api/`). It is **not** served from GitHub Pages.

Migration checklist (account consolidation): `/mnt/NewVolume/Personal_Projects/cred/CLOUDFLARE_MIGRATION.md`

### One-time Cloudflare setup

1. In **Lorapok Facility**, create a Pages project named `cursor-monitor-admin` (or run `npm run deploy:pages` from `website/admin/` once locally with `CLOUDFLARE_ACCOUNT_ID` set to Facility).
2. Create KV namespace: `wrangler kv namespace create ADMIN_KV` — paste IDs into `website/admin/wrangler.toml`.
3. **Pages → Settings → Environment variables** (Production):
   - `GITHUB_TOKEN` — PAT with `repo`, `actions:read`, and `actions:write` (workflow dispatch + runtime logs)
   - `ADMIN_MASTER_EMAIL` — `mdshuvo40@gmail.com` (Google / magic-link sign-in)
   - `FIREBASE_PROJECT_ID` — `cursor-curse-by-lorapok`
   - `SITE_DATA_URL` — `https://maijied.github.io/Cursor-Curse-Monitor-by-Lorapok/site-data.json`
   - Optional: `ADMIN_EMAILS` — comma-separated fallback if KV not ready
4. **DNS:** CNAME `cursor-dev.lorapok.tech` → `cursor-monitor-admin-2x8.pages.dev` (proxied)
5. **Firebase Console → Auth → Authorized domains:** add `cursor-dev.lorapok.tech` and your `*.pages.dev` host.
6. **Firebase magic link:** Authentication → Sign-in method → Email/Password → enable **Email link (passwordless sign-in)**. Or run `node scripts/enable-firebase-email-link.mjs` with `gcloud` authenticated.
7. **Email (outbound):** Enable Cloudflare Email Sending for `lorapok.tech`:
   ```bash
   cd website/admin
   npx wrangler email sending enable lorapok.tech
   ```
   Pages runtime uses `CLOUDFLARE_ACCOUNT_ID` (in `wrangler.toml`) plus Pages secret `CLOUDFLARE_EMAIL_API_TOKEN` (CI syncs from `CLOUDFLARE_API_TOKEN` on deploy). Fallback: `RESEND_API_KEY` with verified `cursor-contact@lorapok.tech`. Inbound routing: `cursor-contact@lorapok.tech` → `admin@lorapok.tech`.

### Firestore rules

```bash
cd website/admin
firebase deploy --only firestore:rules --project cursor-curse-by-lorapok
```

### GitHub secrets (CI auto-deploy)

| Secret | Purpose |
|--------|---------|
| `CLOUDFLARE_API_TOKEN` | Pages deploy from `admin-deploy` job |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare account ID |
| `CLOUDFLARE_EMAIL_API_TOKEN` | (Recommended) API token with **Email Sending → Send** for outbound mail; synced to Pages as `CLOUDFLARE_EMAIL_API_TOKEN` |

The deploy token alone is not enough if it lacks Email Sending permission — subscribe/invite mail will return `401 Authentication error`. Create a dedicated token in **My Profile → API Tokens** with Account **Email Sending → Send** and add it as `CLOUDFLARE_EMAIL_API_TOKEN` in the `admin-production` environment. Onboard `lorapok.tech` once under **Email Service → Email Sending** in the Cloudflare dashboard.

Push to `main` runs `admin-ci` then `admin-deploy` when secrets are configured.

### Local dev

```bash
cd website/admin
cp .env.example .env   # add GITHUB_TOKEN optional
npm run dev            # http://localhost:5173/dashboard
```

See [`docs/ADMIN_MANUAL_TEST.md`](docs/ADMIN_MANUAL_TEST.md) for the full QA checklist.

**Deprecated:** `website/admin-api/` standalone Worker — do not deploy; use Pages Functions instead.

---

## Browser extension (Firefox AMO + Chrome zip)

Built from `browser-extension/` on every release. **Not** submitted to Chrome Web Store — Chrome users download the zip from GitHub Releases or the marketing site.

### Secrets (GitHub Actions)

| Secret | Purpose |
|--------|---------|
| `AMO_JWT_ISSUER` | Firefox Add-ons API JWT issuer (`user:…`) |
| `AMO_JWT_SECRET` | Firefox Add-ons API JWT secret |

Generate at [Firefox Add-ons Developer Hub → API credentials](https://addons.mozilla.org/developers/addon/api/key/).

### CI/CD flow (release tag / manual dispatch)

1. `npm run browser-ext:build` — Vite → `browser-extension/dist/`
2. `node browser-extension/scripts/generate-amo-metadata.mjs` — fills all AMO listing fields from `amo/amo-metadata.base.json` + `CHANGELOG.md`
3. `node browser-extension/scripts/validate-amo-metadata.mjs`
4. `npx web-ext@8 sign --channel listed --amo-metadata …` — signs and submits to AMO (zero manual form filling)
5. `node browser-extension/scripts/verify-amo-status.mjs` — polls AMO API
6. Chrome zip → GitHub Release + `website/downloads/`

### Local dev

```bash
npm run build -w @lorapok/cursor-monitor-shared
npm run browser-ext:build
# Load unpacked: chrome://extensions or about:debugging → Load Temporary Add-on → dist/manifest.json
```

### Chrome install (users)

1. Download `cursor-curse-monitor-chrome-{version}.zip` from Releases or website
2. Extract folder
3. `chrome://extensions` → Developer mode → **Load unpacked** → select extracted folder

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
| AMO sign fails | Verify `AMO_JWT_ISSUER` / `AMO_JWT_SECRET`; extension ID in manifest `browser_specific_settings.gecko.id` |
| Chrome zip won't install | Use Load unpacked (not .crx); extract zip first |
| DB backup files accumulating | Stale backups (>1 hour old) are cleaned up automatically |
