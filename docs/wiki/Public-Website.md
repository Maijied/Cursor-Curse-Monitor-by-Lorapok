# Public website roadmap

**Last updated:** 2026-09-18  
**Tasks:** WEB-07–WEB-11, LEGAL-01, ANALYTICS-02, DEPLOY-01 (admin parity)

---

## Vision

The marketing site becomes a **professional public face** for the whole Lorapok CCM ecosystem: live stats, expanded engineering transparency, multi-page docs, and a clear welcome for open-source contributors — while Mission Control remains the operator CMS.

---

## Planned pages (WEB-09)

| Route | Source | Content |
|-------|--------|---------|
| `/` | `index.html` | Hero, features, Chrysalis, topology |
| `/wiki/` + `/wiki/*.html` | `docs/wiki/*.md` via `npm run site:pages` | Mirrored GitHub Wiki (canonical in repo) |
| `/releases.html` | `site-data.json` (client) | Version + download links |
| `/community.html` | `site-data.json` `githubCommunity` + Project #4 | Issues, traffic, contribute |
| `/docs/` | docs hub → wiki | Installation, architecture, agent commands |
| `/#engineering` | WEB-08 section | Behind the scenes — monorepo, CI/CD, Mission Control |
| `/engineering/history/` | `generate-public-pages.mjs` | Long-form engineering timeline (WEB-11) |

**Status:** shipped generator `scripts/generate-public-pages.mjs` + public shells. Regenerate with `npm run site:pages` (also runs before `site:seo`).

---

## System topology (WEB-07)

**Status:** done — Production Deployment tab lists every `ci-cd.yml` job (`resolve-version` → `ci-summary`, including `queue-social-gallery` + `website-discord-notify`), plus ADMIN_KV / STATS_R2 / Discord slots. Guarded by `tests/test_architecture_cicd_jobs.mjs` + Mermaid↔workflow sync.

Expand animated diagrams on `#architecture` / Mission Control → Architecture:

1. `resolve-version` / `validate-dispatch` / `admin-deploy-gate`
2. `ci` · `browser-extension-ci` · `admin-ci` · `ci-summary`
3. `prepare-tag-on-push` · `release-prep`
4. `deploy` (Open VSX, VS Code, AMO, Chrome) · `admin-deploy` · `website` · `seo-pipeline`
5. `queue-social-gallery` · `website-discord-notify`
6. Stats cron + KV/R2 cache
7. Discord deployment / github-log / community webhooks

Must match Mission Control **DEPLOY-01** deploy runtime steps for operator trust.

---

## Behind the scenes (WEB-08)

**Shipped:** marketing `#engineering` section after Architecture.

Covers:

- Four components (IDE, browser, website, Mission Control)
- Procedure + GitHub Project #4 workflow
- Cred vault and release integrity
- Agent commands (`Update?`, `next`)
- How to contribute (links WEB-10)

---

## Open-source welcome (WEB-10)

**Status: done**

- CONTRIBUTING.md + good-first issues + Project #4 on every marketing footer (`social-footer.js` + generated pages)
- Hero + subscribe contributor CTAs on the home page
- IDE dashboard + browser popup/options “Join the community” links (shared `productLinks`)
- Mission Control GlobalFooter + Chrysalis contribute blurb
- Chrysalis can point contributors at CONTRIBUTING / good-first / Project #4

---

## Platform availability strip (EXT-01)

**Status: done** (shared `getPlatformAvailabilityStrip` / `formatPlatformStripHtml`)

- Compact Open VSX · VS Code · Firefox · Chrome zip · GitHub row in marketing footers (home, privacy/terms, generated wiki/docs), Mission Control GlobalFooter, IDE dashboard, browser popup/options
- Live `site-data` href hydration via existing `data-href-*` attributes on the public site

---

## Engineering history (WEB-11)

**Status: done**

Long-form **behind-the-scenes timeline** at [`/engineering/history/`](https://cursor.lorapok.tech/engineering/history/) — sectioned milestones: IDE origin, browser add-on, Mission Control, CI/CD, procedure/agents, public site + Chrysalis, contributor welcome, Lorapok Labs credits. Extends WEB-08. Linked from `#engineering` foot and Docs hub.

## Social & SEO

See **[Social and SEO](Social-and-SEO)** — Discord CI cards, multi-platform webhooks, deploy image gallery, video generator, world-class SEO hub.

---

| Task | Purpose |
|------|---------|
| **LEGAL-01** | **done** — process consent banner, privacy/terms v2026-09-18, `/api/consent` aggregate KV audit |
| **ANALYTICS-02** | Professional visitor log (IP hash, referrer, new user events); admin dashboard |

No secrets in logs. Retention and export documented in `privacy.html`.

---

## Related

- [Architecture](Architecture)
- [Deployment](Deployment)
- [Ecosystem Roadmap](Ecosystem-Roadmap)
- [Chrysalis](Chrysalis)
