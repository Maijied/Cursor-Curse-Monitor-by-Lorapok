# MAIL-16 live deliverability probes

**Procedure ID:** `81e88aa6`  
**Status:** in_progress  
**Created:** 2026-09-11  
**Plan:** _none_  
**Issue:** __ISSUE_PENDING__  
**Branch:** `feat/mail-16-live-probes`  
**PR:** _TBD_

---

## Objective

Finish MAIL-16: live testmail send probes for product/support + Discord alert on audit failure.

---

## Progress

- [x] Procedure created
- [x] `mail-deliverability-live-probe.js` + audit integration
- [x] Unit tests passing
- [x] `npm run mail:probe-deliverability` CLI
- [ ] PR opened
- [ ] Production smoke after deploy

---

## Decisions

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-09-11 | Probe product + support only (max 2) | Worker timeout + Resend quota |
| 2026-09-11 | Skip live probe when testmail unset | Static audit still runs |

---

## Verification

| Tier | Check | Result |
|------|-------|--------|
| A | `mail-deliverability-live-probe.test.mjs` | pass |
| B | Admin lint / CI | pending |
| C | `mail:probe-deliverability` production | pending deploy |
