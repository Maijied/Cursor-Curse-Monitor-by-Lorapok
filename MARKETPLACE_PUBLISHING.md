# Marketplace Publishing Guide

This guide explains how to publish the Cursor Curse Monitor extension to the VS Code Marketplace, Open VSX Registry, and Firefox AMO using the unified CI/CD workflow.

## Prerequisites

### 1. Register Publisher Name

#### VS Code Marketplace
1. Go to [Visual Studio Marketplace Publisher Management](https://marketplace.visualstudio.com/manage/publishers)
2. Sign in with your Microsoft account
3. Click "Create Publisher"
4. Enter publisher name: `LorapokLabs`
5. Display name: `Lorapok Labs`
6. Add description and website (https://lorapok.tech)
7. Save the publisher

#### Open VSX Registry
1. Go to [Open VSX Registry](https://open-vsx.org/)
2. Sign in with your GitHub account
3. Go to [Publishers](https://open-vsx.org/publishers)
4. Create publisher with name: `lorapok-labs`
5. Display name: `Lorapok Labs`
6. Add description and website

#### Firefox Add-ons (AMO)
1. Go to [Firefox Add-ons Developer Hub](https://addons.mozilla.org/developers/)
2. Create or claim the add-on listing for extension ID `cursor-curse-monitor@lorapok.tech`
3. Generate API credentials (JWT issuer + secret)

### 2. Generate Access Tokens

#### VS Code Marketplace Token (VSCE_PAT)
1. Go to [Azure DevOps](https://dev.azure.com/)
2. Click **User Settings** → **Personal access tokens**
3. Click **New Token**
4. Name: `Cursor Curse Monitor CI/CD`
5. Organization: **All accessible organizations**
6. Scopes: **Marketplace → Manage**
7. Click **Create**
8. **Copy the token immediately** — you won't see it again!

#### Open VSX Token (OVSX_PAT)
1. Go to [Open VSX](https://open-vsx.org/)
2. Sign in with your GitHub account
3. Click your profile → **User Settings**
4. Go to **Personal Access Tokens** section
5. Click **Generate New Token**
6. Name: `Cursor Curse Monitor CI/CD`
7. Click **Generate**
8. **Copy the token immediately** — you won't see it again!

#### Firefox AMO (AMO_JWT_ISSUER / AMO_JWT_SECRET)
1. Go to [Firefox Add-ons Developer Hub → API credentials](https://addons.mozilla.org/developers/addon/api/key/)
2. Generate JWT credentials
3. Store in credential vault as `firefox/jwt_issuer` and `firefox/jwt_secret`
4. Sync to GitHub: `CRED_PASSPHRASE=… npm run amo:secrets`

### 3. Add GitHub Secrets

1. Go to your GitHub repository: `Maijied/Cursor-Curse-Monitor-by-Lorapok`
2. Navigate to **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Add the following secrets:

| Secret Name | Value | Description |
|-------------|-------|-------------|
| `VSCE_PAT` | Your VS Code Marketplace token | For publishing to VS Code Marketplace |
| `OVSX_PAT` | Your Open VSX token | For publishing to Open VSX Registry |
| `AMO_JWT_ISSUER` | Firefox JWT issuer | For `web-ext sign` (browser extension) |
| `AMO_JWT_SECRET` | Firefox JWT secret | For `web-ext sign` (browser extension) |

## Deployment Methods

### Method 1: Mission Control (recommended)

1. Sign in to [Mission Control](https://cursor-dev.lorapok.tech) as **master admin**
2. Go to **Deployments → Release**
3. Choose publish market (`Both`, `Open VSX`, `VS Code Marketplace`, or `Firefox AMO`)
4. Select version bump and release channel
5. Submit — runtime logs stream in the panel

### Method 2: GitHub Actions workflow_dispatch

1. Go to **Actions** tab in your GitHub repository
2. Select **CI/CD** workflow
3. Click **Run workflow**
4. Configure options:
   - **Action type**: `release`
   - **Publish market**: `Both`, `Open VSX`, `VS Code Marketplace`, or `Firefox AMO`
   - **Version bump type**: `patch`, `minor`, `major`, or `custom`
   - **Release channel**: `Production` or `Beta (Pre-release)`
5. Click **Run workflow**

### Method 3: Deploy existing tag

Re-publish a prior release without bumping `main`:

1. Mission Control **Deployments → Deploy** or workflow_dispatch with `action_type` = `publish-tag`
2. Set `target_tag` (e.g. `v1.0.1`)
3. Choose publish market

### Method 4: Standalone Firefox publish

For AMO-only signing without a full release:

1. **Actions → Publish Firefox Extension → Run workflow**
2. Optionally set `version` input

### Method 5: Local Manual Publishing

#### Publish to VS Code Marketplace
```bash
npm run version:sync
npm run compile
npm run package
npx vsce publish -p YOUR_VSCE_PAT
```

#### Publish to Open VSX
```bash
npm run version:sync
npm run publish:ovsx -- -p YOUR_OVSX_PAT
```

#### Publish to Firefox AMO
```bash
npm run version:sync
npm run browser-ext:build
node browser-extension/scripts/publish-amo.mjs
```

## Verification

After publishing, verify the extension is available:

- **Open VSX**: https://open-vsx.org/extension/lorapok-labs/cursor-curse-monitor-by-lorapok
- **VS Code Marketplace**: https://marketplace.visualstudio.com/items?itemName=LorapokLabs.cursor-curse-monitor-by-lorapok
- **Firefox AMO**: https://addons.mozilla.org/en-US/firefox/addon/cursor-curse-monitor/

AMO listing descriptions use [Extension Workshop Markdown](https://extensionworkshop.com/documentation/develop/create-an-appealing-listing/#make-use-of-markdown) in `browser-extension/amo/amo-metadata.base.json`.
- **GitHub Releases**: https://github.com/Maijied/Cursor-Curse-Monitor-by-Lorapok/releases
- **Project Website**: https://maijied.github.io/Cursor-Curse-Monitor-by-Lorapok/

## Troubleshooting

### Publisher Name Already Exists
If the publisher name is already taken on either marketplace:
- **VS Code Marketplace**: Use `LorapokLabs` (already registered)
- **Open VSX**: Use `lorapok-labs` (already registered)

### Token Not Working
- Ensure the token has the correct permissions
- Regenerate the token if it's expired
- Verify the secret name matches exactly in GitHub Secrets

### Version Already Published
The workflow handles this gracefully and will continue without error. Bump the version and trigger a new release.

### AMO sign fails
- Verify `AMO_JWT_ISSUER` / `AMO_JWT_SECRET` in GitHub secrets
- Ensure `generate-amo-metadata.mjs` ran before `web-ext sign`
- Check extension ID in `browser_specific_settings.gecko.id`

## Current Configuration

| Setting | Value |
|---------|-------|
| **VS Code Marketplace Publisher** | `LorapokLabs` |
| **Open VSX Publisher** | `lorapok-labs` |
| **Firefox AMO slug** | `cursor-curse-monitor` |
| **Firefox Extension ID** | `cursor-curse-monitor@lorapok.tech` |
| **Extension Name** | `cursor-curse-monitor-by-lorapok` |
| **CI/CD Workflow** | `.github/workflows/ci-cd.yml` |
| **Firefox Workflow** | `.github/workflows/publish-firefox.yml` |
| **Auto-publish on push** | Disabled — manual dispatch only |
| **Production base version** | Root `package.json` (dynamic `version:sync` at build) |
