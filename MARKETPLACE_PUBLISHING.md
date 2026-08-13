# Marketplace Publishing Guide

This guide explains how to publish the Cursor Curse Monitor extension to the VS Code Marketplace and Open VSX Registry using the unified CI/CD workflow.

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

### 3. Add GitHub Secrets

1. Go to your GitHub repository: `Maijied/Cursor-Curse-Monitor-by-Lorapok`
2. Navigate to **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Add the following secrets:

| Secret Name | Value | Description |
|-------------|-------|-------------|
| `VSCE_PAT` | Your VS Code Marketplace token | For publishing to VS Code Marketplace |
| `OVSX_PAT` | Your Open VSX token | For publishing to Open VSX Registry |

## Deployment Methods

### Method 1: Auto-Patch on Push (Default)

Every push to `main` automatically:
1. Bumps the patch version
2. Creates a git tag
3. Publishes to both marketplaces
4. Creates a GitHub Release with VSIX
5. Updates the project website

Simply push your changes:
```bash
git push origin main
```

### Method 2: Manual Major/Minor Release via GitHub Actions

1. Go to **Actions** tab in your GitHub repository
2. Select **CI/CD** workflow
3. Click **Run workflow**
4. Configure options:
   - **Version bump type**: `major`, `minor`, or `patch`
   - **Custom version**: Leave empty for auto-bump, or specify a version
   - **Create GitHub Release**: Check to create a release (default: true)
5. Click **Run workflow**

### Method 3: Tag-Based Release (via release script)

```bash
./scripts/release.sh patch   # bump patch, tag, push
./scripts/release.sh minor   # bump minor, tag, push
./scripts/release.sh         # tag current version, push
```

### Method 4: Local Manual Publishing

#### Publish to VS Code Marketplace
```bash
npm run compile
npm run package
npx vsce publish -p YOUR_VSCE_PAT
```

#### Publish to Open VSX
```bash
npm run compile
npm run package
npx ovsx publish -p YOUR_OVSX_PAT
```

## Verification

After publishing, verify the extension is available:

- **Open VSX**: https://open-vsx.org/extension/lorapok-labs/cursor-curse-monitor-by-lorapok
- **VS Code Marketplace**: https://marketplace.visualstudio.com/items?itemName=LorapokLabs.cursor-curse-monitor-by-lorapok
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
The workflow handles this gracefully and will continue without error. If you need to republish:
1. Bump the version (auto-patch does this automatically)
2. Push to `main` or trigger manually

### Auto-Patch Creating Too Many Releases
This is by design — every push creates a release. To batch changes:
- Use feature branches and merge via PR
- Only merge to `main` when ready to release

## Current Configuration

| Setting | Value |
|---------|-------|
| **VS Code Marketplace Publisher** | `LorapokLabs` |
| **Open VSX Publisher** | `lorapok-labs` |
| **Extension Name** | `cursor-curse-monitor-by-lorapok` |
| **CI/CD Workflow** | `.github/workflows/ci-cd.yml` |
| **Auto-patch** | Enabled (push to `main`) |
| **Manual bump** | `workflow_dispatch` |
