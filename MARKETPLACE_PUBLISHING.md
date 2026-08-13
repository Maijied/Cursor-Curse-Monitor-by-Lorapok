# Marketplace Publishing Guide

This guide explains how to publish the Cursor Curse Monitor extension to the VS Code Marketplace and Open VSX Registry using automated CI/CD.

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
1. Go to [Visual Studio Marketplace Publisher Management](https://marketplace.visualstudio.com/manage/publishers)
2. Select your publisher: `LorapokLabs`
3. Go to "Personal Access Tokens" tab
4. Click "Create New Token"
5. Name: `Cursor Curse Monitor CI/CD`
6. Scopes: Check "Manage" (full access)
7. Click "Create"
8. **Copy the token immediately** - you won't see it again!

#### Open VSX Token (OVSX_PAT)
1. Go to [Open VSX](https://open-vsx.org/)
2. Sign in with your GitHub account
3. Click your profile → "User Settings"
4. Go to "Personal Access Tokens" section
5. Click "Generate New Token"
6. Name: `Cursor Curse Monitor CI/CD`
7. Click "Generate"
8. **Copy the token immediately** - you won't see it again!

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

### Method 1: Automated Tag-Based Deployment (Recommended)

1. Update version in `package.json` (e.g., `0.2.1` → `0.2.2`)
2. Commit the changes:
   ```bash
   git add package.json
   git commit -m "Bump version to 0.2.2"
   ```
3. Create and push a version tag:
   ```bash
   git tag v0.2.2
   git push origin v0.2.2
   ```
4. The GitHub Actions workflow will automatically:
   - Build the extension
   - Publish to VS Code Marketplace
   - Publish to Open VSX Registry
   - Create a GitHub Release with the VSIX file

### Method 2: Manual Deployment via GitHub Actions

1. Go to **Actions** tab in your GitHub repository
2. Select **Deploy** workflow
3. Click **Run workflow**
4. Configure options:
   - **Version**: Leave empty to use package.json version, or specify custom version
   - **Publish to Open VSX**: Check to publish to Open VSX
   - **Publish to VS Code Marketplace**: Check to publish to VS Code Marketplace
   - **Create GitHub Release**: Check to create a GitHub release
5. Click **Run workflow**

### Method 3: Local Manual Publishing

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

- **VS Code Marketplace**: https://marketplace.visualstudio.com/items?publisher=LorapokLabs
- **Open VSX**: https://open-vsx.org/extension/lorapok-labs/cursor-curse-monitor-by-lorapok

## Troubleshooting

### Publisher Name Already Exists
If the publisher name is already taken on either marketplace:
- **VS Code Marketplace**: Use `LorapokLabs` (already registered)
- **Open VSX**: Use `lorapok-labs` (already registered)
- Update the environment variables in `.github/workflows/deploy.yml` if different names are needed

### Token Not Working
- Ensure the token has the correct permissions
- Regenerate the token if it's expired
- Verify the secret name matches exactly in GitHub Secrets

### Version Already Published
The workflow handles this gracefully and will continue without error. If you need to republish:
1. Bump the version in `package.json`
2. Create a new tag
3. Push the tag

### Welcome Message Testing
To test the welcome message after publishing:
1. Uninstall the extension
2. Clear VS Code workspace state (optional)
3. Reinstall the extension
4. The welcome notification should appear after 1.5 seconds

The welcome message uses `context.globalState` which persists across sessions, so it will only appear on the first installation. To see it again, you would need to:
- Uninstall and reinstall the extension, OR
- Clear VS Code's global storage (not recommended for normal users)

## Current Configuration

- **VS Code Marketplace Publisher**: `LorapokLabs`
- **Open VSX Publisher**: `lorapok-labs`
- **Extension ID**: `cursor-curse-monitor-by-lorapok`
- **Version**: `0.3.0`
- **CI/CD**: Automated via GitHub Actions on tag push

## Next Steps

1. Register publisher names on both marketplaces
2. Generate access tokens
3. Add tokens as GitHub Secrets
4. Test with a manual workflow run
5. Publish first version using tag-based deployment
