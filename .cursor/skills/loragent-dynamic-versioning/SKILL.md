---
name: loragent-dynamic-versioning
description: Dynamic versioning for Cursor Curse Monitor — single release base in root package.json, workspace packages synced at build via scripts/compute-version.mjs and scripts/sync-workspace-versions.mjs.
---

# Loragent Dynamic Versioning (CCM)

Use this skill when bumping releases, wiring CI, or debugging version drift across the monorepo.

## Golden rule

**Only bump root `package.json` on production release.** Never manually edit `browser-extension/package.json`, `manifest.json`, or `packages/shared/package.json` versions in git.

Committed workspace versions stay **`0.0.0`**. CI and local builds run `npm run version:sync` to propagate the computed version into all artifacts.

## Version matrix

| Channel | Format | Example |
|---------|--------|---------|
| Production (git tag / root bump) | `MAJOR.MINOR.PATCH` | `1.0.1` |
| Beta | `{base}-beta.{shortSha}` | `1.0.1-beta.a1b2c3d` |
| Dev / main CI push | `{base}-dev.{commitCount}` | `1.0.1-dev.842` |
| Pull request CI | `{base}-pr.{prNumber}` | `1.0.1-pr.42` |

Production **base** lives in root `package.json` only (e.g. `1.0.1`).

## Scripts

```bash
npm run version:compute   # print computed version for current context
npm run version:sync      # write computed version to all workspace targets (build)
npm run version:check     # fail if workspace package.json files are not 0.0.0 in git
```

| Script | Role |
|--------|------|
| `scripts/compute-version.mjs` | Single semver calculator (env: `GITHUB_EVENT_NAME`, `RELEASE_BASE`, etc.) |
| `scripts/sync-workspace-versions.mjs` | Propagates computed version to root + browser-extension + shared |

## CI integration

`.github/workflows/ci-cd.yml`:

1. `npm run version:check` — guard against manual workspace bumps
2. On push to `main`: `npm run version:sync` — inject `-dev.*` / `-beta.*` for build artifacts only (not committed)

Release prep (`release-prep` job) bumps **root** `package.json` only via `npm version`, then tags.

## Mission Control release

1. Master admin → Deployments → **Release** → custom `1.0.1` (or patch/minor/major)
2. Dispatches `ci-cd.yml` `full-release` with `deploy_admin` / `deploy_website`
3. Tag push triggers marketplace deploy; workspace sync runs in deploy job before `npm run package`

## Anti-patterns

- Bumping `browser-extension/package.json` or `packages/shared/package.json` on every release
- Committing `-dev.*` or `-beta.*` to root `package.json` on `main`
- Dispatching removed workflows (`publish-tag.yml`, `deployment.yml`)

## Related files

- `scripts/compute-version.mjs`
- `scripts/sync-workspace-versions.mjs`
- `scripts/validate-release.mjs` (enforces workspace `0.0.0` placeholders)
- `browser-extension/vite.config.ts` (reads root version when local is `0.0.0`)

Global copy: `~/.cursor/skills/loragent-dynamic-versioning/SKILL.md`
