# Deployment

CCM releases are automated via GitHub Actions and dispatched from **Mission Control** (master admin only).

## Golden rule (DEPLOY-04)

**Marketplace publish (VS Code Marketplace / Open VSX / Firefox AMO) only happens from Mission Control → Deployments → Deploy** (or Rollback), with the IDE extension checkbox on. Push to `main`, `full-release`, `deploy-infra`, schedule, and PRs never publish marketplaces.

## Prepare tag (automatic)

Push to `main` runs CI and may **prepare the next git tag** (max live marketplace version + patch) and redeploy Mission Control. That does **not** publish to marketplaces.

## Forward deploy (publish existing tag)

Use Mission Control **Deployments → Deploy** or dispatch `ci-cd.yml` with `action_type` = `publish-tag` and `deploy_extension` = `true`:

| Input | Description |
|-------|-------------|
| `target_tag` | Existing git tag (e.g. `v1.0.1`) |
| `publish_market` | `Both`, `Open VSX`, `VS Code Marketplace`, `Firefox AMO`, or `Open VSX + Firefox AMO` |
| `release_channel` | `Production` or `Beta (Pre-release)` |
| `deploy_extension` | Must be `true` to publish marketplaces (default `false`) |

This publishes the tagged extension without rewriting `main`.

## Full release (tag + Mission Control only)

`full-release` bumps/tags and can update Mission Control. It does **not** publish marketplaces — follow with **Deploy** on the new tag when ready.

## Rollback

Use **Deployments → Rollback** to dispatch `ci-cd.yml` with `action_type` = `rollback` and `deploy_extension` = `true`. This restores a prior tag on `main` and publishes a bumped patch release. Verify the tag before triggering.

## Master admin lockdown

Deploy, release, and rollback API routes require the **master admin** email (`ADMIN_MASTER_EMAIL`). Non-master admins see a disabled form with an explanatory banner in Mission Control.

## Runtime preview

After dispatch, Mission Control shows a **Runtime preview** panel that polls GitHub Actions job status and streams workflow logs.

## CI/CD workflows

| Workflow | Trigger |
|----------|---------|
| `ci-cd.yml` | PR to `main`, push to `main` (CI + optional tag prep + MC), `workflow_dispatch` (publish-tag / rollback / full-release / deploy-infra / seo-refresh) |
| `publish-firefox.yml` | Emergency AMO only — requires `allow_standalone_amo=true`; prefer Mission Control Deploy |
| `admin-ci` / `admin-deploy` | Admin SPA build; deploy is `workflow_dispatch`-only |

## Dynamic versioning

Root and workspace versions stay at `0.0.0` in git. CI resolves the live semver via `npm run version:sync` before package/publish.
