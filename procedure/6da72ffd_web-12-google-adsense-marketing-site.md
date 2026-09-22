# WEB-12 Google AdSense marketing site

**Procedure ID:** `6da72ffd`  
**Status:** done  
**Created:** 2026-09-22  
**Plan:** _none_  
**Issue:** _GitHub issue pending (offline during init)_  
**Branch:** _local session_  
**PR:** _TBD_

---

## Objective

Add Google AdSense Auto ads to the public marketing site (`cursor.lorapok.tech`) with consent-gated loading and Google Consent Mode v2 defaults.

---

## Progress

- [x] Plan approved (user-requested top priority)
- [x] Procedure created (`procedure-init`)
- [x] Implementation — `website/adsense.js`, consent copy, page generator + homepage wiring
- [x] Privacy/terms disclosure updated
- [x] Registry updated (`WEB-12` in `plan/mission-control-master-tasks.md`)
- [ ] PR opened
- [ ] Post-deploy: verify AdSense site approval for `cursor.lorapok.tech` in Google AdSense console

---

## Decisions

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-09-22 | Consent-gated dynamic loader | LEGAL-01 fail-closed; AdSense loads only after analytics opt-in |
| 2026-09-22 | No ads on privacy/terms/admin | Legal pages stay ad-free; disclosure only |
| 2026-09-22 | Publisher ID in `adsense.js` | Public AdSense client id (not a secret) |

---

## Blockers

- **AdSense domain approval:** `cursor.lorapok.tech` must be added as a site in the AdSense account separately from `lorapok.tech`.

---

## Verification

| Tier | Check | Result |
|------|-------|--------|
| A | `npm run site:pages` regenerates shells with `adsense.js` | pending |
| B | Consent decline → no `adsbygoogle.js` request | manual |
| C | After opt-in → script loads on production | pending deploy + AdSense site approval |

---

## Retrospective

_Filled on merge._
