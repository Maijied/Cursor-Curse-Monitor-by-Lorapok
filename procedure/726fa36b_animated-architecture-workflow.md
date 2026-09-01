# Usage Discord Footer Arch

**Procedure ID:** `726fa36b`  
**Status:** in_progress  
**Created:** 2026-09-01  
**Plan:** `.cursor/plans/usage_discord_footer_release_bf578c22.plan.md` (read-only)  
**Issue:** https://github.com/Maijied/Cursor-Curse-Monitor-by-Lorapok/issues/109  
**Branch:** `feat/usage-discord-footer-arch`  
**PR:** _TBD_

---

## Objective

Deliver hybrid animated architecture, accurate Cursor usage/bonus/cap UI, Discord community integration (invite + admin webhooks via vault), unified Lorapok footer/social links, asset cache-busting, and restored dynamic README/site stats.

---

## Progress

- [x] Plan approved
- [x] Procedure + GitHub issue created (#109)
- [x] Implementation started
- [x] Tests passing (root `npm test`, `browser-ext:test`, `site:seo:validate`, badge/arch sync)
- [ ] PR opened
- [ ] Review triaged
- [ ] Merged
- [ ] Post-merge verification

---

## Decisions

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-09-01 | Procedure opened | Task tracking started |
| 2026-09-01 | Subgraph labels excluded from Mermaid coverage | `subgraph foo["Label"]` is a cluster header, not a flow node |
| 2026-09-01 | Discord webhooks vault-only | `scripts/sync-discord-cred-vault.mjs` → ADMIN_KV; never commit URLs |
| 2026-09-01 | Footer from `social.json` | `social-footer.js` renders full/minimal nav on index, privacy, terms |

---

## Blockers

_None._

---

## Verification

| Tier | Check | Result |
|------|-------|--------|
| A | `npm test` + arch/badge sync scripts | pass |
| A | `npm run browser-ext:test` | pass |
| A | `npm run site:data` + `site:seo:validate` | pass |
| B | Admin `npm test` (116 tests) | pass |
| C | Browser MCP hero + footer QA | deferred |

---

## Retrospective

_Filled on merge via `scripts/procedure-finalize-pr.mjs` or CI workflow._
