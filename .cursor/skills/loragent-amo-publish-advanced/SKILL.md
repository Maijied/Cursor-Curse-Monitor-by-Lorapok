---
name: loragent-amo-publish-advanced
description: Advanced Firefox AMO publishing — metadata schema, production failure patterns, CI fail-fast, Mission Control, and multi-extension Lorapok catalog.
---

# Loragent AMO Publish (Advanced)

Extends `loragent-amo-publish` with production-hardened detail from Cursor Curse Monitor v1.0.1–1.0.3 AMO rollout.

## Full documentation

**External kit (authoritative):** `~/Documents/Lorapok-AMO-Developer-Kit/01-AMO-DEPLOYMENT-FLOW.md`

## Metadata schema (strict)

```json
{
  "categories": { "firefox": ["web-development"] },
  "tags": ["security", "privacy"],
  "summary": { "en-US": "≤250 chars" },
  "description": { "en-US": "<p>HTML</p>" },
  "support_email": { "en-US": "help@lorapok.tech" },
  "support_url": { "en-US": "https://github.com/..." },
  "homepage": { "en-US": "https://..." },
  "version": {
    "license": "MPL-2.0",
    "privacy_policy": "https://.../privacy.html",
    "release_notes": { "en-US": "from CHANGELOG" },
    "approval_notes": "plain text for Mozilla reviewers"
  }
}
```

### Rejected patterns (real failures)

| Field | ❌ Wrong | ✅ Right |
|-------|----------|----------|
| categories | `["web-development"]` | `{ "firefox": ["web-development"] }` |
| support_email | `"a@b.com"` | `{ "en-US": "a@b.com" }` |
| tags | `["cursor", "billing"]` | `["security", "privacy"]` only |

## Pipeline (immutable order)

```
version:sync → browser-ext:build → generate-amo-metadata → validate-amo-metadata
  → web-ext sign --channel listed → verify-amo-status
```

Entry script: `browser-extension/scripts/publish-amo.mjs`

## CI fail-fast graph

```
browser-extension-ci + admin-ci + root-ci
  → release-prep (needs all success)
  → deploy (AMO when do_amo=true)
  → website / admin-deploy (needs deploy success or skip)
```

Do not mark downstream jobs `if: always()` — upstream failure must block AMO.

## Tag vs main trap

`publish-tag` input checks out **the git tag**. Fixes on `main` after tagging are invisible to CI until you:

1. Bump version in `package.json`
2. Commit + tag `vX.Y.Z`
3. Dispatch with new tag

## Manifest Firefox compat

- `data_collection_permissions` required (MV3)
- Background: `service_worker` + `scripts` fallback in `compat.js`
- Icons 16/32/48/128 in `dist/icons/` (committed sources, not CI ImageMagick)

## Credential aliases

`publish-amo.mjs` accepts:

| Primary | Alias |
|---------|-------|
| `AMO_JWT_ISSUER` | `AMO_API_KEY` |
| `AMO_JWT_SECRET` | `AMO_API_SECRET` |

Issuer must start with `user:`.

## Mission Control markets

```javascript
// mapPublishMarket must include:
"Firefox AMO" → publish_market: "Firefox AMO"
"Both" → VSCE + Open VSX + AMO
```

## Site-data integrity gate

CI compares `website/site-data.json` version to `package.json`. Sync before deploy:

```bash
# After version bump
npm run site-data:sync  # or manual edit
git commit -m "chore: sync site-data to vX.Y.Z"
```

## Lorapok Labs branding

- Developer display name: **Lorapok Labs**
- Product homepage: **https://cursor.lorapok.tech/**
- Privacy: **https://cursor.lorapok.tech/privacy.html**
- Profile kit: `~/Documents/Lorapok-AMO-Developer-Kit/02-LORAPOK-LABS-DEVELOPER-PROFILE.md`
- Domain map: `~/Documents/Lorapok-AMO-Developer-Kit/05-LORAPOK-TECH-DOMAINS.md`
- Live sync: `browser-extension/scripts/sync-amo-listing.mjs`

## Multi-extension catalog

| Extension | Gecko ID pattern |
|-----------|------------------|
| CCM | `cursor-curse-monitor@lorapok.tech` |
| Atlas | `@lorapok.tech` suffix |
| New ext | Register ID in AMO before first sign |

## When to use MCP skill

For live CI dispatch, browser profile updates, or log analysis → switch to `loragent-amo-mcp`.
