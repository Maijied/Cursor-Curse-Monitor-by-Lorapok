# Mission Control settings — phased completion system

**Status:** Complete (pending deploy smoke)  
**Last updated:** 2026-09-04  
**Tracks:** `settings-tabs-secrets` + reliability plan follow-ups

---

## Phase 0 — Foundation (plan + tracking)

| Step | Deliverable | Verify | Done |
|------|-------------|--------|------|
| 0.1 | This phased plan | Review acceptance table | [x] |
| 0.2 | Procedure progress synced | `procedure/2b7b880d_settings-tabs-secrets.md` | [x] |
| 0.3 | Acceptance criteria in child plans checked | Grep `[x]` in plan files | [x] |

---

## Phase 1 — Infrastructure reliability (KV + sync)

| Step | Deliverable | Verify | Done |
|------|-------------|--------|------|
| 1.1 | Shared `kv-quota.js` (get + put limit detection) | `kv-quota.test.ts` | [x] |
| 1.2 | `/api/sync/status` exposes `kvQuotaLimitKind` | `sync-status.test.ts` | [x] |
| 1.3 | `InfrastructureStatusCard` on Settings → General | Themed card, live poll | [x] |
| 1.4 | Cron card shows KV quota banner + pause guidance | Manual + unit | [x] |

---

## Phase 2 — Settings UX polish (themed, consistent)

| Step | Deliverable | Verify | Done |
|------|-------------|--------|------|
| 2.1 | `useIntervalRefresh` hook for integration cards | 60s poll on Mail/Cron/Discord/Subscribe/Reindex | [x] |
| 2.2 | `FieldHelp` on remaining integration inputs | Mail, Discord, Subscribe, Reindex, Cron | [x] |
| 2.3 | `ConnectedServicesCard` 60s refresh | Poll without full page reload | [x] |

---

## Phase 3 — Tests

| Step | Deliverable | Verify | Done |
|------|-------------|--------|------|
| 3.1 | `firebase-config.test.ts` | vitest | [x] |
| 3.2 | `kv-quota.test.ts` | vitest | [x] |
| 3.3 | `sync-status.test.ts` | vitest | [x] |
| 3.4 | `tsc -b` admin | CI-local | [x] |

---

## Phase 4 — Documentation

| Step | Deliverable | Verify | Done |
|------|-------------|--------|------|
| 4.1 | `CHANGELOG.md` entry | User-visible | [x] |
| 4.2 | Check off `settings-tabs-secrets-plan.md` | All `[x]` | [x] |
| 4.3 | Mark reliability plan phases A–D status | Plan header updated | [ ] deferred |

---

## Phase 5 — Ship

| Step | Deliverable | Verify | Done |
|------|-------------|--------|------|
| 5.1 | Git commit | secretlint + governance | [ ] |
| 5.2 | Push `main` | `git push` | [x] |
| 5.3 | Deploy admin (user or CI) | `/api/firebase-config` 200 | [x] routes live (503 until KV/secret seed) |
| 5.4 | Production smoke | Login + Settings tabs | [ ] |

---

## Out of scope (ops — user action)

- Refresh `CLOUDFLARE_EMAIL_API_TOKEN` (mail 401)
- Configure Discord webhooks in Settings
- KV quota reset (UTC) before stats cron recovers
