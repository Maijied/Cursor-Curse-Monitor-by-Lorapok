# Deployment

CCM releases are automated via GitHub Actions and dispatched from **Mission Control** (master admin only).

## Release (new version)

Use Mission Control **Deployments → Release** or dispatch `ci-cd.yml` with `action_type` = `release`:

| Input | Description |
|-------|-------------|
| `version_bump` | `patch`, `minor`, `major`, `prepatch`, `preminor`, `prerelease`, or `custom` |
| `custom_version` | Explicit semver when `version_bump` = `custom` |
| `publish_market` | `Both`, `Open VSX`, `VS Code Marketplace`, or `Firefox AMO` |
| `release_channel` | `Production` or `Beta (Pre-release)` |

The workflow bumps root `package.json`, runs `version:sync`, builds, tags, publishes to selected marketplaces, signs the Firefox add-on (when AMO secrets are set), and creates a GitHub Release.

## Forward deploy (publish existing tag)

Use Mission Control **Deployments → Deploy** or dispatch `ci-cd.yml` with `action_type` = `publish-tag`:

| Input | Description |
|-------|-------------|
| `target_tag` | Existing git tag (e.g. `v1.0.1`) |
| `publish_market` | `Both`, `Open VSX`, `VS Code Marketplace`, or `Firefox AMO` |
| `release_channel` | `Production` or `Beta (Pre-release)` |

This publishes the tagged extension without rewriting `main`.

## Rollback

Use **Deployments → Rollback** to dispatch `ci-cd.yml` with `action_type` = `rollback`. This restores a prior tag on `main` and publishes a bumped patch release. Verify the tag before triggering.

## Master admin lockdown

Deploy, release, and rollback API routes require the **master admin** email (`ADMIN_MASTER_EMAIL`). Non-master admins see a disabled form with an explanatory banner in Mission Control.

## Runtime preview

After dispatch, Mission Control shows a **Runtime preview** panel that polls GitHub Actions job status and streams workflow logs.

## CI/CD workflows

| Workflow | Trigger |
|----------|---------|
| `ci-cd.yml` | PR to `main`, push to `main` (CI only), `workflow_dispatch` (release, deploy, rollback, seo-refresh) |
| `publish-firefox.yml` | Manual — standalone AMO sign & submit |
| `admin-ci` / `admin-deploy` | Admin SPA build; deploy is `workflow_dispatch`-only |

## Dynamic versioning

- Root `package.json` = production base version (e.g. `1.0.1`)
- `browser-extension/package.json` and `packages/shared/package.json` stay at `0.0.0` in git
- `npm run version:sync` writes resolved versions before build/package

## Firefox AMO secrets

| GitHub secret | Vault key |
|---------------|-----------|
| `AMO_JWT_ISSUER` | `firefox/jwt_issuer` |
| `AMO_JWT_SECRET` | `firefox/jwt_secret` |

Sync from vault: `CRED_PASSPHRASE=… npm run amo:secrets`

## Minimum publish tag

Marketplace publish requires **v0.5.5** or newer.

[← Home](Home) · [Admin Panel](Admin-Panel)
