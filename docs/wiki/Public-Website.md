# Public website roadmap

**Last updated:** 2026-09-05  
**Tasks:** WEB-07–WEB-10, LEGAL-01, ANALYTICS-02, DEPLOY-01 (admin parity)

---

## Vision

The marketing site becomes a **professional public face** for the whole Lorapok CCM ecosystem: live stats, expanded engineering transparency, multi-page docs, and a clear welcome for open-source contributors — while Mission Control remains the operator CMS.

---

## Planned pages (WEB-09)

| Route | Source | Content |
|-------|--------|---------|
| `/` | `index.html` | Hero, features, Chrysalis, topology |
| `/wiki` or `/docs/wiki/*` | `docs/wiki/*.md` | Mirrored GitHub Wiki (canonical in repo) |
| `/releases` | `site-data.json` + GitHub Releases API | Version history, download links |
| `/community` | `site-data.json` `community` + Project #4 | Issues, discussions, contributor guide |
| `/docs` | `docs/` guides + wiki index | Installation, architecture, agent commands |
| `/engineering` | WEB-08 section | Behind the scenes — monorepo, CI/CD, Mission Control |

Admin-published **notices** and changelog drafts surface on `/community` and `/releases` when approved.

---

## System topology (WEB-07)

Expand animated diagrams on `#architecture` to include **every** `ci-cd.yml` job:

1. `resolve-version` / `release-prep`
2. Extension compile, test, package
3. Browser extension build + AMO/Chrome artifacts
4. Admin CI + Pages deploy
5. Marketplace publish (Open VSX, VS Code, AMO)
6. `site:data` / SEO pipeline
7. Stats cron + KV/R2 cache
8. Discord deployment notifications

Must match Mission Control **DEPLOY-01** deploy runtime steps for operator trust.

---

## Behind the scenes (WEB-08)

New section covering:

- Four components (IDE, browser, website, Mission Control)
- Procedure + GitHub Project #4 workflow
- Cred vault and release integrity
- Agent commands (`Update?`, `next`)
- How to contribute (links WEB-10)

---

## Open-source welcome (WEB-10)

- CONTRIBUTING.md + good-first issues on every surface footer
- Hero/subscribe contributor CTA
- Extension options “Join the community” link
- Chrysalis can answer “how do I contribute?”

---

## Engineering history (WEB-11)

Long-form **behind-the-scenes timeline** at `/engineering/history` — sectioned summary of the whole build: monorepo, CI/CD evolution, Mission Control, procedure workflow, releases, contributors. Extends WEB-08.

## Social & SEO

See **[Social and SEO](Social-and-SEO)** — Discord CI cards, multi-platform webhooks, deploy image gallery, video generator, world-class SEO hub.

---

| Task | Purpose |
|------|---------|
| **LEGAL-01** | Terms + privacy + consent for subscribe, analytics, Chrysalis BYOK |
| **ANALYTICS-02** | Professional visitor log (IP hash, referrer, new user events); admin dashboard |

No secrets in logs. Retention and export documented in `privacy.html`.

---

## Related

- [Architecture](Architecture)
- [Deployment](Deployment)
- [Ecosystem Roadmap](Ecosystem-Roadmap)
- [Chrysalis](Chrysalis)
