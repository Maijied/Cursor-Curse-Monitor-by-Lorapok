---
name: "loragent-lorapok-website-build"
description: "Maintain marketing site (website/) and Mission Control admin UI — hero, stats, subscribe, notices."
---

# Lorapok Website Build

Use the project skill: **`.agents/skills/lorapok-website-build/SKILL.md`**

## Quick reference

- Marketing site: `website/` (not `apps/website/`)
- Admin SPA: `website/admin/`
- Hero layout rule: `.cursor/rules/website-marketing.mdc`
- Preview: `cd website && python3 -m http.server 8765`
- Regenerate stats: `npm run site:data` from repo root
