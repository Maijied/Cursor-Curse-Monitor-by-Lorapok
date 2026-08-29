---
name: loragent-amo-publish
description: Firefox AMO publish pipeline for Cursor Curse Monitor — metadata generation, web-ext sign, CI integration, and GitHub secret sync from cred vault.
---

# Loragent AMO Publish (CCM)

Firefox browser extension publishes to AMO (listed channel) via JWT API keys and `web-ext sign`.

## Prerequisites

- `AMO_JWT_ISSUER` — must start with `user:` (JWT issuer, not legacy API key)
- `AMO_JWT_SECRET` — JWT secret from [AMO API keys](https://addons.mozilla.org/developers/addon/api/key/)
- Built extension: `browser-extension/dist/`

Load from cred vault:

```bash
export AMO_JWT_ISSUER="$(cred get firefox jwt_issuer)"
export AMO_JWT_SECRET="$(cred get firefox jwt_secret)"
```

Or sync to GitHub once:

```bash
CRED_PASSPHRASE=… node scripts/sync-amo-github-secrets.mjs
```

## Local publish

```bash
npm run version:sync
npm run build -w @lorapok/cursor-monitor-shared
npm run browser-ext:test
npm run browser-ext:build
node browser-extension/scripts/publish-amo.mjs
```

## Pipeline steps (publish-amo.mjs)

1. `generate-amo-metadata.mjs` — manifest + listing files
2. `validate-amo-metadata.mjs` — strict checks
3. `web-ext sign` — AMO upload + signing
4. `verify-amo-status.mjs` — poll review status

Orchestrated by `browser-extension/scripts/publish-amo.mjs`.

## CI integration

`.github/workflows/ci-cd.yml` deploy job runs AMO when `do_amo` is true:

- Uses GitHub secrets `AMO_JWT_ISSUER`, `AMO_JWT_SECRET`
- Version from `npm run version:sync` (never bump workspace package.json in git)

## Version rules

- Workspace `browser-extension/package.json` stays **`0.0.0`** in git
- Computed version injected at build via `scripts/compute-version.mjs`
- See `loragent-dynamic-versioning` skill

## Key files

| File | Role |
|------|------|
| `browser-extension/scripts/publish-amo.mjs` | Orchestrator |
| `browser-extension/scripts/generate-amo-metadata.mjs` | AMO listing metadata |
| `browser-extension/scripts/validate-amo-metadata.mjs` | Pre-sign validation |
| `browser-extension/scripts/verify-amo-status.mjs` | Post-sign status |
| `browser-extension/scripts/lib-version.mjs` | Version resolution |
| `scripts/sync-amo-github-secrets.mjs` | Vault → GitHub secrets |

## Anti-patterns

- Using legacy `AMO_API_KEY` format (must be JWT `user:…` issuer)
- Publishing without `browser-ext:build` / missing `dist/manifest.json`
- Manually bumping `browser-extension/package.json` version on every release

Global copy: `~/.cursor/skills/loragent-amo-publish/SKILL.md`
