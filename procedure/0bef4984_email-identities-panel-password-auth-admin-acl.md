# Email identities panel + password auth + admin ACL

**Procedure ID:** `0bef4984`  
**Status:** in_progress  
**Created:** 2026-09-05  
**Plan:** [plan/b8e4f2a1_email-identities-auth-acl-plan.md](../plan/b8e4f2a1_email-identities-auth-acl-plan.md)  
**Issue:** [#120](https://github.com/Maijied/Cursor-Curse-Monitor-by-Lorapok/issues/120)  
**Branch:** _TBD_  
**PR:** _TBD_

---

## Objective

1. **Settings → Email identities** — configurable panel to create and manage `@lorapok.tech` addresses (Cloudflare Email Routing + forwards).
2. **Password login** — email/password sign-in with validation (invite-only; Firebase Email/Password recommended).
3. **Admin ACL** — industry-grade RBAC: roles (master/admin/operator/viewer), server-enforced permissions, audit trail.

---

## Progress

- [x] Plan drafted (`b8e4f2a1`)
- [x] Tasks added to `mission-control-master-tasks.md` (MAIL-09–12, AUTH-01–10, SET-08–10)
- [x] GitHub issue [#120](https://github.com/Maijied/Cursor-Curse-Monitor-by-Lorapok/issues/120)
- [ ] Plan approved
- [ ] MAIL-09 API design
- [ ] MAIL-10 Email identities Settings tab
- [ ] AUTH-02–04 Password login
- [ ] AUTH-05–08 RBAC core + Team UI
- [ ] AUTH-09–10 Audit + tests
- [ ] PR opened
- [ ] Merged
- [ ] Post-merge verification

---

## Decisions

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-09-05 | Procedure opened | User requested epic tracking |
| 2026-09-05 | Firebase Email/Password for v1 | Already integrated; lower risk than custom D1 auth |
| 2026-09-05 | Fixed role matrix v1 | master/admin/operator/viewer before custom policy UI |
| 2026-09-05 | Invite-only signup | No public registration; allowlist + Team page |

---

## Blockers

| Blocker | Unblocks |
|---------|----------|
| MAIL-07 Resend verify pending | End-to-end external mail test before identity From changes |
| Firebase Email/Password not enabled in console | AUTH-02 |

---

## Verification

| Tier | Check | Result |
|------|-------|--------|
| A | Headless tests | pending |
| B | Component matrix | pending |
| C | Production smoke (password + RBAC) | pending |

---

## Retrospective

_Filled on merge via `scripts/procedure-finalize-pr.mjs` or CI workflow._
