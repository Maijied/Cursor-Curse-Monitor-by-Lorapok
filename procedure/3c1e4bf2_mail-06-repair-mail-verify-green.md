# MAIL-06 repair-mail verify green

**Procedure ID:** `3c1e4bf2`  
**Status:** in_progress  
**Created:** 2026-09-17  
**Plan:** plan/mission-control-master-tasks.md  
**Issue:** [#143](https://github.com/Maijied/Cursor-Curse-Monitor-by-Lorapok/issues/143)  
**Branch:** `feat/mail-06-repair-verify-green`  
**PR:** [#269](https://github.com/Maijied/Cursor-Curse-Monitor-by-Lorapok/pull/269)

---

## Objective

Make `repair-mail.mjs` and the outbound/inbound verify scripts reliably green for operators (MAIL-06).

---

## Progress

- [x] Procedure + branch
- [x] Diagnosed: prod health already OK (relay + Resend); `verify-resend-domain` false-failed on CF DNS 403
- [x] Soft-skip CF DNS audit when Resend domain verified; `mail:verify-all` suite; repair-mail steps 6–7
- [x] Local `npm run mail:verify-all` → MAIL-06 OK
- [x] PR opened (#269)
- [ ] Merged / close #143

---

## Decisions

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-09-17 | Resend verified ⇒ CF DNS 403 is advisory | Zone-read token often lacks DNS list; Resend status is source of truth for sending |
| 2026-09-17 | Domains probe HTTP 404 is informational | Workers Free / account tokens; transport gate uses relay/Resend |
| 2026-09-17 | Rename quota MAIL-06 row → MAIL-15 | Remove duplicate task ID; #143 keeps MAIL-06 |

---

## Verification

| Check | Result |
|-------|--------|
| `node scripts/lib/resend-domain-verify.test.mjs` | pass |
| `npm run mail:verify-all` | MAIL-06 OK |
| Production `/api/health` mail fields | relay bound, Resend configured, deliverability OK |

---

## Retrospective

_Filled on merge._
