# Email identities panel + password auth + admin ACL

**Procedure ID:** `0bef4984`  
**Status:** done  
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
- [x] PR merged ([#121](https://github.com/Maijied/Cursor-Curse-Monitor-by-Lorapok/pull/121), [#122](https://github.com/Maijied/Cursor-Curse-Monitor-by-Lorapok/pull/122) import fix)
- [x] Post-merge: cred vault CI + `ADMIN_MASTER_EMAIL` Pages secret (`76c82800`)
- [x] Tier C — `auth:probe-production` **14 passed** (2026-09-05)
- [x] Tier D — RBAC + PIN smoke (`npm run auth:tier-d`: vitest Tier D suite + production probe, 2026-09-05)

---



## Decisions


| Date       | Decision                       | Rationale                                            |
| ---------- | ------------------------------ | ---------------------------------------------------- |
| 2026-09-05 | Procedure opened               | User requested epic tracking                         |
| 2026-09-05 | Firebase Email/Password for v1 | Already integrated; lower risk than custom D1 auth   |
| 2026-09-05 | Fixed role matrix v1           | master/admin/operator/viewer before custom policy UI |
| 2026-09-05 | Fix vault `admin_master_email` typo (`@gmail.comm` → `@gmail.com`) | Production Access Denied for mdshuvo40@gmail.com until Pages secret redeployed |
| 2026-09-05 | Invite-check API before login | `GET /api/auth/invite-check` — no allowlist leak |
| 2026-09-05 | Password policy without zxcvbn dep | min 12 + complexity + strength label in `password-policy.ts` |
| 2026-09-05 | Tier D automated where browser blocked | `auth:tier-d` = `tier-d-rbac-nav` + `pin-unlock` + `PinUnlockOverlay` vitest + `auth:probe-production` |

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
| Firebase Email/Password not enabled in console | AUTH-02 (ops — Firebase Console) |
| Optional live operator browser spot-check      | Sign in as `s.songket@gmail.com` or `sawirmajumder@gmail.com` |


---



## Verification

| Tier | Check | Command / steps | Result |
| ---- | ----- | --------------- | ------ |
| A | Headless RBAC matrix | `cd website/admin && npm test && npm run test:scripts` | pass (local) |
| B | Nav + settings tab gating | `vitest run src/__tests__/nav-permissions.test.ts` | pass (local) |
| C | Production API smoke | `npm run auth:probe-production` | **pass** (14/14 unauth, 2026-09-05) |
| C+ | Authenticated probe | `ADMIN_PROBE_EMAIL=… ADMIN_ID_TOKEN=… npm run auth:probe-production` | **pass** (18/18, master, 2026-09-05) |
| D | Password + RBAC + PIN smoke | `npm run auth:tier-d` | **pass** (16 vitest + 18 probe, 2026-09-05) |

### Tier C — automated

```bash
cd website/admin
npm run auth:probe-production
# Full SET-10 (Tier C + D headless):
npm run auth:tier-d
# Optional authenticated Tier C+:
# ADMIN_PROBE_EMAIL=you@lorapok.tech ADMIN_ID_TOKEN=<firebase-id-token> npm run auth:probe-production
```

`auth-api-deployed` requires `ADMIN_MASTER_EMAIL` on Cloudflare Pages (synced in deploy as of `76c82800`).

### Tier D — checklist (manual UI + automated)

**Automated** (`npm run auth:tier-d`):

- `tier-d-rbac-nav.test.ts` — viewer/operator/master nav + cred-vault tab (items 3–5)
- `pin-unlock.test.ts` + `PinUnlockOverlay.test.tsx` — PIN set/verify/unlock (item 6)

**Manual spot-checks** (already done or optional):

1. Password tab on `/login` — **pass** (2026-09-05)
2. Invite gate for unknown email — **pass**
3. Viewer nav — **pass** (automated; no production viewer account)
4. Operator nav — **pass** (automated; optional live sign-in as operator)
5. Master Team Access + settings — **pass** (probe `role=master`, RBAC 3 members)
6. PIN overlay — **pass** (component + crypto tests; optional live browser reload check)


---



## Retrospective

*Filled on merge via* `scripts/procedure-finalize-pr.mjs` *or CI workflow.*