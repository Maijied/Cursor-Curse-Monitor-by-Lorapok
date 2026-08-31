---
name: lorapok-website-build
description: >-
  Maintain and preview the Cursor Curse Monitor marketing site (website/) and
  Mission Control admin UI (website/admin/). Use for hero layout, subscribe form,
  stats dashboard, notices API, and static site deploy.
---

# Lorapok Website Build (Cursor Curse Monitor)

## Scope

| Surface | Path | Deploy |
|---------|------|--------|
| Marketing site | `website/` | GitHub Pages (`npm run site:data` + push `main`) |
| Mission Control | `website/admin/` | Cloudflare Pages (`npm run admin:deploy:fast`) |

## Hero section (top of `website/index.html`)

**Layout rules (do not regress):**

- `.hero-inner` — two columns on desktop: copy left, `.hero-visual` right.
- `.hero-visual-stage` — CSS grid:
  - **&lt; 900px:** orbit row, stats row (stacked, no overlap).
  - **≥ 900px:** orbit column 1, compact stats card column 2 (side-by-side).
- Orbit icons use `position: absolute` — keep `padding-bottom` on `.hero-orbit` so floating icons are not covered by the stats card (`z-index` orbit 2, stats 1).
- Stats data: `website/stats-dashboard.js` + `site-data.json` (regenerate with `npm run site:data` from repo root).
- Styles: `website/styles.css` (layout) + `website/stats-dashboard.css` (card metrics).

**Preview locally:**

```bash
cd website && python3 -m http.server 8765
# open http://127.0.0.1:8765/
```

**Verify with Browser MCP** (Maizied Chrome profile): navigate to local or `https://cursor.lorapok.tech/`, snapshot hero — orbit must remain fully visible beside/below stats.

## Subscribe form (footer)

- Markup: `#subscribe-form` with `.subscribe-form-row` (email + button) and consent checkbox below.
- API: production posts to admin `/api/subscribe`; local static preview needs admin dev server for E2E.

## Admin notices (`/dashboard/notices`)

- API: `website/admin/functions/api/notices.ts` + `_shared/notices.js`
- Catalog KV key: `notice:catalog` — sanitize null/invalid items before merge.
- `ensureCatalogSeeded` must fail-open when KV write quota is hit (return in-memory catalog, do not 500).
- Tests: `website/admin/functions/api/_shared/notices-merge.test.mjs`, `website/admin/src/__tests__/notices-api.test.ts`

## Commands (from repo root)

```bash
npm run site:data          # regenerate website/site-data.json
npm run site:seo           # regenerate seo.json
cd website/admin && npm test -- --run src/__tests__/notices-api.test.ts
npm run admin:deploy:fast  # Cloudflare Pages (needs wrangler login)
```

## Do not

- Reference `apps/website/` (legacy path — this repo uses `website/`).
- Bump `package.json` versions in git (CI uses dynamic versioning; keep `0.0.0`).
- Add production debug instrumentation or localhost telemetry.
- Duplicate Lorapok global skills — canonical project copy is `.agents/skills/` (`.cursor/skills` is a symlink).

## Agent window checklist

When changing marketing or admin UI:

1. Read this skill + `AGENTS.md` marketing/admin sections.
2. Run scoped tests for touched area (not full monorepo unless CI requires).
3. Preview hero in browser (local server or Browser MCP).
4. Update `CHANGELOG.md` if user-visible; sync wiki only if architecture/deploy changed (see `.cursor/rules/documentation-sync.mdc`).
