# CI harden GitHub release upload retries

**Procedure ID:** `544c1996`  
**Status:** in_progress  
**Created:** 2026-09-17  
**Plan:** _none_  
**Issue:** https://github.com/Maijied/Cursor-Curse-Monitor-by-Lorapok/issues/270  
**Branch:** `fix/ci-github-release-upload-retries`  
**PR:** _TBD_

---

## Objective

Harden GitHub Release creation so transient Unicorn/5xx upload failures do not leave draft releases and fail Deploy to Marketplaces after marketplaces already published.

---

## Progress

- [x] Plan approved
- [x] Procedure + GitHub issue created
- [x] Implementation started
- [x] Tests passing (`node tests/test_create_github_release.js`)
- [ ] PR opened
- [ ] Review triaged
- [ ] Merged
- [ ] Post-merge verification

---

## Decisions

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-09-17 | Procedure opened | Task tracking started |
| 2026-09-18 | Replace softprops with `scripts/create-github-release.mjs` | softprops failed mid-upload on GitHub Unicorn HTML; left draft `v1.0.172` with only VSIX. New script stages version-matched assets, retries uploads, then undrafts. |
| 2026-09-18 | Omit missing XPI without failing | AMO `--approval-timeout 0` often leaves no local signed XPI — warn/notice only. |

---

## Blockers

_None._

---

## Verification

| Tier | Check | Result |
|------|-------|--------|
| A | Headless tests | `node tests/test_create_github_release.js` OK |
| B | Component matrix | repaired live draft → published https://github.com/Maijied/Cursor-Curse-Monitor-by-Lorapok/releases/tag/v1.0.172 (vsix + chrome zip) |
| C | Production smoke | pending post-merge |

---

## Retrospective

_Filled on merge via `scripts/procedure-finalize-pr.mjs` or CI workflow._
