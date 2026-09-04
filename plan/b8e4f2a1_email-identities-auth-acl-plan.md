# Email identities panel + password auth + admin ACL

**Status:** planned  
**Procedure:** `procedure/0bef4984_email-identities-panel-password-auth-admin-acl.md`  
**Issue:** [#120](https://github.com/Maijied/Cursor-Curse-Monitor-by-Lorapok/issues/120)  
**Component:** `website/admin/` (Mission Control)

---

## Goals

1. **Email identities** — Settings UI to create and manage `@lorapok.tech` addresses (Cloudflare Email Routing + Sending identities) without running wrangler scripts manually.
2. **Password login** — Email/password sign-in alongside Google/magic link, with strong validation and secure storage (Firebase Auth Email/Password or equivalent).
3. **Admin ACL** — Industry-grade role-based access: least privilege, server-enforced permissions on every API, auditable changes.

---

## Current state (baseline)

| Area | Today |
|------|--------|
| Auth | Firebase ID token (Google + email link); `verifyAdminRequest` checks allowlist |
| Admins | Master email + `ADMIN_EMAILS` env + KV `admin-emails`; Team page writes Firestore + `/api/admins` |
| ACL | Binary: master vs non-master (`isMasterAdmin` / `requireMasterAdmin`); no roles |
| Mail identities | `setup-email-addresses.mjs` CLI; hardcoded addresses in `mail-addresses.js` |
| Settings | 13 tabs; Mail/Resend for transport, not identity provisioning |

---

## Architecture (target)

### A. Email identities (`MAIL-09`–`MAIL-12`)

```
Settings → Email identities tab
    → GET/PUT /api/integrations/email-identities/config  (KV metadata)
    → POST /api/integrations/email-identities/provision   (master: create CF routing rule)
    → Cloudflare API: Email Routing rules + Sending enable for lorapok.tech
```

- **Configurable fields:** local part (`cursor.monitor`), display name, forward-to (ops inbox), category (product / support / ops).
- **Guardrails:** validate `@lorapok.tech` suffix; block reserved names; master-only provision; dry-run in dev.
- **Reuse:** `setup-email-addresses.mjs`, `mail-addresses.js`, cred vault CF tokens.

### B. Password auth (`AUTH-01`–`AUTH-05`)

**Recommended:** Firebase Authentication **Email/Password** (already integrated) — enable in Firebase console, add Login UI fields, enforce password policy via Firebase + client validators.

| Requirement | Implementation |
|-------------|----------------|
| Sign up / sign in with password | `Login.tsx` + Firebase `createUserWithEmailAndPassword` / `signInWithEmailAndPassword` |
| Password strength | min 12 chars, upper/lower/digit/symbol; zxcvbn or similar score |
| Rate limiting | Firebase built-in + optional CF WAF / KV counter on failed attempts |
| Session | Existing Firebase ID token → `verifyAdminRequest` |
| Invite-only | No public signup — only emails on admin allowlist can complete first login |
| Reset password | Firebase `sendPasswordResetEmail` for allowlisted admins |

**Alternative (defer):** Custom D1 user table + argon2 — only if Firebase password is rejected; higher ops burden.

### C. Admin ACL (`AUTH-06`–`AUTH-10`)

**Roles (v1)**

| Role | Scope |
|------|--------|
| `master` | Full access; sole role for team/deploy/secrets/email provision |
| `admin` | Settings read; mailbox compose; integrations read; no deploy/team/secrets |
| `operator` | Mailbox, notices, subscribers; read-only settings |
| `viewer` | Read-only dashboards, logs, health |

**Permission model**

- KV: `admin-rbac:v1` — `{ email, role, permissions[], updatedAt, updatedBy }`
- Server: `requirePermission(env, auth, 'mail.send')` on every mutating route
- UI: hide/disable actions based on `GET /api/auth/me` permissions
- Audit: append to D1 `system:log` or KV scatter on role/email changes

**Migration:** Map current allowlist → `admin` role; master unchanged; Firestore `admins` collection aligned with KV RBAC.

---

## Phases

| Phase | Deliverable | Task IDs |
|-------|-------------|----------|
| **0 — Design** | This plan + API contract draft | AUTH-01 |
| **1 — Email identities UI** | Settings tab + list/create/disable `@lorapok.tech` | MAIL-09, MAIL-10, SET-08 |
| **2 — Password login** | Login form + validation + invite-only gate | AUTH-02, AUTH-03, AUTH-04 |
| **3 — RBAC core** | Roles in KV + `requirePermission` middleware | AUTH-05, AUTH-06, AUTH-07 |
| **4 — UI ACL** | Team page roles; hide master actions | AUTH-08, SET-09 |
| **5 — Hardening** | Audit log, tests, docs, production smoke | AUTH-09, AUTH-10, SET-10 |

---

## Acceptance criteria

### Email identities

- [ ] Master can create `name@lorapok.tech` from Settings with forward target and display name
- [ ] List shows existing identities (KV + CF sync status)
- [ ] Invalid local parts rejected with clear errors
- [ ] Provision uses Cloudflare Email Routing API (not manual DNS)

### Password auth

- [ ] Allowlisted admin can sign in with email + password
- [ ] Non-allowlisted email cannot register or sign in
- [ ] Password policy enforced client + server (Firebase rules or API gate)
- [ ] Password reset flow for allowlisted emails

### ACL

- [ ] Every mutating API checks permission (not only master flag)
- [ ] Master-only: deploy, rollback, team, cred vault, email provision, integration secrets
- [ ] Role changes audited with actor + timestamp
- [ ] Vitest coverage for permission matrix on critical routes

---

## Out of scope (v1)

- Public self-service signup
- SAML/SSO enterprise IdP
- Per-route custom policies UI (use fixed role matrix first)
- Hosting full mail server — Cloudflare Email only

---

## Docs to update (on implementation)

- `docs/wiki/Admin-Panel.md` — Email identities + ACL
- `docs/wiki/Mailbox-and-Email.md` — provisioning flow
- `AGENTS.md` — auth + new Settings tab
- `CHANGELOG.md` — user-visible features

---

## Related

- `website/admin/scripts/setup-email-addresses.mjs`
- `website/admin/functions/api/_shared/admins.js`
- `website/admin/functions/api/_shared/auth.js`
- `website/admin/src/components/Team.tsx`
- `plan/mission-control-master-tasks.md` — MAIL-09+, AUTH-01+, SET-08+
