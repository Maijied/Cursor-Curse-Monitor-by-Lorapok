# LEGAL-01 Terms privacy and process consent

**Procedure ID:** `34f50edd`  
**Status:** in_progress  
**Created:** 2026-09-18  
**Plan:** plan/mission-control-master-tasks.md  
**Issue:** https://github.com/Maijied/Cursor-Curse-Monitor-by-Lorapok/issues/199  
**Branch:** `feat/legal-01-consent`  
**PR:** _TBD_

---

## Objective

Unified Terms/Privacy for subscribe, extensions, analytics, Chrysalis BYOK; explicit process consent before analytics; KV audit trail of aggregate consent choices.

---

## Progress

- [x] Plan approved
- [x] Procedure + GitHub issue created (#199; closed duplicate #291)
- [x] Implementation started
- [x] Tests passing
- [ ] PR opened
- [ ] Review triaged
- [ ] Merged
- [ ] Post-merge verification

---

## Decisions

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-09-18 | Track #199 (not #291) | procedure-init duplicate closed |
| 2026-09-18 | Fail-closed analytics | Beacons wait for `ccm:consent-analytics` |
| 2026-09-18 | Aggregate KV audit only | No IP/email in `consent:audit` |
| 2026-09-18 | Consent version `2026-09-18` | Align subscribe + process consent |

---

## Blockers

_None._

---

## Verification

| Tier | Check | Result |
|------|-------|--------|
| A | Headless tests | pass — `test_legal_01_consent.mjs` + consent-audit + mail template |
| B | Component matrix | pending |
| C | Production smoke | pending |

---

## Retrospective

_Filled on merge via `scripts/procedure-finalize-pr.mjs` or CI workflow._
