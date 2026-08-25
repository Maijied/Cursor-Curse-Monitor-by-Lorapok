---
name: loragent-amo-publish
description: Firefox AMO publish pipeline for this repo — see global skill at ~/.cursor/skills/loragent-amo-publish/SKILL.md
---

# Loragent AMO Publish (CCM project)

Global skill: `~/.cursor/skills/loragent-amo-publish/SKILL.md`

## Quick commands (this repo)

```bash
npm run version:sync
npm run browser-ext:build
node browser-extension/scripts/publish-amo.mjs
```

## Key files

- `browser-extension/scripts/publish-amo.mjs`
- `browser-extension/scripts/generate-amo-metadata.mjs`
- `browser-extension/scripts/lib-version.mjs`
- `.github/workflows/ci-cd.yml` (deploy job, `do_amo`)
