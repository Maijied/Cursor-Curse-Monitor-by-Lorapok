# Email identities panel + password auth + admin ACL

**Procedure ID:** `0bef4984`  
**Status:** in_progress  
**Created:** 2026-09-05  
**Plan:** [plan/b8e4f2a1_email-identities-auth-acl-plan.md](../plan/b8e4f2a1_email-identities-auth-acl-plan.md)  
**Issue:** [#120](https://github.com/Maijied/Cursor-Curse-Monitor-by-Lorapok/issues/120)  
**Branch:** `feat/admin-rbac-email-identities-acl`  
**PR:** [#121](https://github.com/Maijied/Cursor-Curse-Monitor-by-Lorapok/pull/121)

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
- [x] MAIL-07 inbound MX added Cloudflare
- [x] AUTH-01 RBAC matrix + `/api/auth/me`
- [x] AUTH-11 Profile tab + PIN quick-unlock
- [x] AUTH-02–05 Password login + invite gate + AuthContext
- [x] MAIL-09 API + KV (`integrations:email-identities`, config/provision routes)
- [x] MAIL-10 Email identities Settings tab (`EmailIdentitiesCard`)
- [x] MAIL-12 partial — `email-identities-config.test.mjs`, api-catalog, rbac-routes
- [x] MAIL-11 bulk sync — `POST /integrations/email-identities/sync`, `email-identities-sync.js`, `setup-email-addresses.mjs` refactor, Settings **Sync all identities**
- [x] SET-09 RBAC nav + Settings tab gating (`nav-permissions.ts`, `PermissionRoute`, card permissions)
- [x] SET-10 production smoke — `npm run auth:probe-production` (API); manual UI checklist below
- [x] MAIL-07 Resend `mail.lorapok.tech` verified + KV `resendDomainVerified=true` (`mail:verify-resend-domain --sync-kv`)
- [x] AUTH-06 RBAC assignment API + admin-emails sync
- [x] AUTH-08 Team page role assignment UI
- [x] AUTH-07 requirePermission on mutating + key read routes
- [x] AUTH-09 ACL audit log (`acl-audit.js`, Logs ACL filter)
- [x] AUTH-10 RBAC matrix + non-master `requirePermission` smoke tests
- [x] PR opened ([#121](https://github.com/Maijied/Cursor-Curse-Monitor-by-Lorapok/pull/121))
- [ ] Merged
- [ ] Post-merge verification

---



## Decisions


| Date       | Decision                       | Rationale                                            |
| ---------- | ------------------------------ | ---------------------------------------------------- |
| 2026-09-05 | Procedure opened               | User requested epic tracking                         |
| 2026-09-05 | Firebase Email/Password for v1 | Already integrated; lower risk than custom D1 auth   |
| 2026-09-05 | Fixed role matrix v1           | master/admin/operator/viewer before custom policy UI |
| 2026-09-05 | Invite-only signup             | No public registration; allowlist + Team page        |
| 2026-09-05 | Invite-check API before login | `GET /api/auth/invite-check` — no allowlist leak |
| 2026-09-05 | Password policy without zxcvbn dep | min 12 + complexity + strength label in `password-policy.ts` |
| 2026-09-05 | Email identities v1 API + UI | KV metadata + CF routing provision; master `mail.provision` |

---



## AUTH-02 — Firebase Console (manual)

1. [Firebase Console](https://console.firebase.google.com/) → project **cursor-curse-by-lorapok**
2. **Authentication** → **Sign-in method** → enable **Email/Password** (not Email link only)
3. **Authentication** → **Settings** → **Authorized domains** — ensure `cursor-dev.lorapok.tech` and `localhost` are listed
4. No public registration — invite list enforced by `/api/auth/invite-check` + `verifyAdminRequest`

---



## Blockers


| Blocker                                        | Unblocks                                                   |
| ---------------------------------------------- | ---------------------------------------------------------- |
| MAIL-07 Resend verify pending                  | ~~End-to-end external mail test~~ — domain verified 2026-09-05 |
| Firebase Email/Password not enabled in console | AUTH-02                                                    |


---



## Verification

| Tier | Check | Command / steps | Result |
| ---- | ----- | --------------- | ------ |
| A | Headless RBAC matrix | `cd website/admin && npm test && npm run test:scripts` | pass (local) |
| B | Nav + settings tab gating | `vitest run src/__tests__/nav-permissions.test.ts` | pass (local) |
| C | Production API smoke | `npm run auth:probe-production` (after PR #121 deploy) | run post-merge |
| D | Password login UI (manual) | See checklist below | pending |

### Tier C — automated

```bash
cd website/admin
npm run auth:probe-production
# Optional Tier B (authenticated):
# ADMIN_PROBE_EMAIL=you@lorapok.tech ADMIN_ID_TOKEN=<firebase-id-token> npm run auth:probe-production
```

`auth-api-deployed` fails with SPA HTML fallback until auth/RBAC Functions from PR #121 are live on the target URL.

### Tier D — manual UI checklist (password + RBAC)

1. Open `https://cursor-dev.lorapok.tech/login` → switch to **Password** tab.
2. Enter a non-invited email → invite gate blocks before Firebase sign-in.
3. Sign in as **viewer** (or assign via Team) → Settings visible, Cred vault tab hidden, Deployments nav hidden.
4. Sign in as **operator** → Mailbox + Notices visible; Settings nav hidden.
5. Sign in as **master** → Team Access visible; Settings write actions enabled.
6. Profile → set PIN → reload dashboard → PIN overlay appears → unlock works.


---



## Retrospective

*Filled on merge via* `scripts/procedure-finalize-pr.mjs` *or CI workflow.*