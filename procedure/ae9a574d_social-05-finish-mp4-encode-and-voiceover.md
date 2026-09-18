# SOCIAL-05 finish MP4 encode and voiceover

**Procedure ID:** `ae9a574d`  
**Status:** in_progress  
**Created:** 2026-09-18  
**Plan:** `plan/mission-control-master-tasks.md`  
**Issue:** https://github.com/Maijied/Cursor-Curse-Monitor-by-Lorapok/issues/217  
**Branch:** `feat/social-05-mp4-voiceover`  
**PR:** https://github.com/Maijied/Cursor-Curse-Monitor-by-Lorapok/pull/284

---

## Objective

Finish SOCIAL-05: MP4 encode + changelog voiceover when an encoder binding/URL is available; keep static carousel fallback.

---

## Progress

- [x] Plan approved
- [x] Procedure + GitHub issue linked (#217)
- [x] Implementation started
- [x] Tests passing (`social-video-encoder.test.mjs`, social-ai generate/config, vitest social-ai-api)
- [x] PR opened ([#284](https://github.com/Maijied/Cursor-Curse-Monitor-by-Lorapok/pull/284))
- [ ] Review triaged
- [ ] Merged
- [ ] Post-merge verification

---

## Decisions

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-09-18 | No ffmpeg in Pages Functions | Use optional Worker binding `VIDEO_ENCODER` or HTTPS encoder URL |
| 2026-09-18 | Voiceover = script payload to encoder | TTS lives in encoder service; Mission Control builds changelog script |
| 2026-09-18 | Strip `videoBytes` before KV persist | Avoid oversized KV values; MP4 goes to STATS_R2 |

---

## Blockers

_None operational._ Optional: deploy a real `ccm-video-encoder` Worker later for production MP4.

---

## Verification

| Tier | Check | Result |
|------|-------|--------|
| A | Headless tests | pass |
| B | Component matrix | pending (Settings encoder fields) |
| C | Production smoke | pending (needs encoder endpoint) |

---

## Retrospective

_Filled on merge via `scripts/procedure-finalize-pr.mjs` or CI workflow._
