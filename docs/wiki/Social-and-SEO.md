# Social media & SEO

**Last updated:** 2026-09-05  
**Tasks:** DC-08/09, SOCIAL-01–05, SEO-01–03, DEPLOY-02/03, GH-06, INT-01

---

## Notifications (Discord + CI/CD)

| Task | What |
|------|------|
| **DC-08** | Success card when `ci-cd.yml` completes — jobs, duration, markets published, **changelog excerpt**, release URL |
| **DC-09** | Failure card — failed job/step, Actions logs link, changelog context, rollback hint |
| **DC-06/07** | Lorapok-branded embed templates + Settings preview (prerequisite) |

All webhook URLs configured in **Settings → Discord** (not Deployments — **DEPLOY-02** removes duplicate UI there).

---

## Multi-platform social (SOCIAL-01)

Same template pattern as Discord, configurable per platform:

| Platform | Config in admin |
|----------|-----------------|
| Discord | Settings → Discord (existing) |
| X (Twitter) | Settings → Social |
| LinkedIn | Settings → Social |
| Mastodon / Bluesky | Settings → Social |
| Telegram | Settings → Social (bot token) |

**INT-01** unifies integrations hub so nothing is orphaned outside Settings.

---

## Deploy social gallery (SOCIAL-02 / DEPLOY-03)

On each successful deploy:

1. Parse `CHANGELOG.md` for release section → caption
2. Generate Lorapok-themed image (SOCIAL-04 provider)
3. Store in R2/KV gallery tagged by feature/version
4. Admin **Social Studio** — preview, edit caption/hashtags, publish

**SOCIAL-03** — one-click publish to all active channels with correct dimensions (feed, story, square).

**SOCIAL-05** — optional short video (Reels/Shorts/Stories) from template + changelog.

---

## AI image providers (SOCIAL-04)

- Default: **free-tier** providers where possible
- Optional: paid APIs (admin adds key via cred vault)
- Admin registers multiple providers; **exactly one active** at a time
- Used by gallery, Chrysalis assets, and marketing hero variants

---

## SEO system (SEO-01–03)

| Layer | Implementation |
|-------|----------------|
| On-page | Title/description, canonical, Open Graph, Twitter cards |
| Structured data | `Organization` (Lorapok Labs), `SoftwareApplication`, `WebSite` |
| Ecosystem links | All Lorapok product URLs in footer, JSON-LD `sameAs`, semantic nav |
| Alt / accessibility | Product names in `alt`, `aria-label`; no keyword stuffing |
| Admin hub **SEO-02** | Google Search Console, Cloudflare Web Analytics, Azure, Bing — tokens in Settings |
| Policies **SEO-03** | robots.txt, sitemap, noindex admin, align `LEGAL-01` |

Pipeline: `npm run site:seo` + `site:seo:validate` in CI.

---

## GitHub webhook (GH-06)

Repo events (`push`, `release`, `workflow_run`) → Mission Control ingest → fan-out to Discord/social cards.

Configurable event list in Settings → GitHub.

---

## Cred sync (CRED-02)

Every Settings save that touches secrets must:

1. Write cred vault (if applicable)
2. Sync GitHub Actions secrets + Pages secrets
3. Confirm via health badge — **never silent miss**

---

## Live email audit (MAIL-16)

Verify all addresses referenced in repo/docs send and receive:

- `cursor.monitor@mail.lorapok.tech`
- `cursor.curse.help@lorapok.tech`
- Provisioned `@lorapok.tech` identities

---

## Related

- [Public Website](Public-Website)
- [Deployment](Deployment)
- [Mailbox and Email](Mailbox-and-Email)
- [Admin Panel](Admin-Panel)
