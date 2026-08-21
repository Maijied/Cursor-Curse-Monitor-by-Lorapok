# Deployment

CCM releases are automated via GitHub Actions.

## Forward deploy (publish existing tag)

Use Mission Control **Deployments → Deploy** or dispatch `publish-tag.yml`:

| Input | Description |
|-------|-------------|
| `target_tag` | Existing git tag (e.g. `v0.5.9`) |
| `publish_market` | `Both`, `Open VSX`, or `VS Code Marketplace` |
| `release_channel` | `Production` or `Beta (Pre-release)` |

This publishes the tagged extension without rewriting `main`.

## Rollback

Use **Deployments → Rollback** to dispatch `deployment.yml`. This restores a prior tag on `main` and publishes a bumped patch release. Verify the tag before triggering.

## Runtime preview

After dispatch, Mission Control shows a **Runtime preview** panel that polls GitHub Actions job status and streams workflow logs.

## CI/CD workflows

| Workflow | Trigger |
|----------|---------|
| `ci-cd.yml` | Push to `main`, tags |
| `publish-tag.yml` | Manual / admin deploy |
| `deployment.yml` | Rollback only |
| `seo.yml` | Regenerate `site-data.json` / `seo.json` |
| `admin-ci` / `admin-deploy` | Admin SPA |

## Minimum publish tag

Marketplace publish requires **v0.5.5** or newer.

[← Home](Home) · [Admin Panel](Admin-Panel)
