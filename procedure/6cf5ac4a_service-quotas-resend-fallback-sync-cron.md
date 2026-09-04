# service quotas resend fallback sync cron

**Procedure ID:** `6cf5ac4a`  
**Status:** done  
**Branch:** main  
**PR:** direct push

---

## Objective

Track Resend (and mail transport) quotas with used/limit in Settings and sync status; fall back to Cloudflare relay when Resend is down or over quota; subscriber broadcast respects capacity; cron sync probes services.

---

## Progress

- [x] Plan approved
- [x] Procedure created
- [x] Implementation started
- [x] CI fix (MarketplaceConfigCard TS)
- [x] Tests passing
- [x] Pushed to main
- [ ] Post-merge deploy verification

---

## Decisions

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-09-05 | Resend quota in KV | Monthly/daily counters; cron probe via `ccm-stats-cron` |
| 2026-09-05 | `mail.lorapok.tech` Resend DNS | MAIL-07; Cloudflare DNS added; cred `resend_from` + `resend_sending_domain` |
| 2026-09-05 | Inbound MX `mail.lorapok.tech` | Cloudflare DNS; AUTH-01 RBAC matrix + Profile/PIN tab |

---

## Blockers

_None._

---

## Verification

| Tier | Check | Result |
|------|-------|--------|
| A | Headless tests | pending |
| B | Component matrix | pending |
| C | Production smoke | pending |

---

## Retrospective

_Filled on merge via `scripts/procedure-finalize-pr.mjs` or CI workflow._
