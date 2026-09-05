# Mission Control — master task registry

**Purpose:** Single checklist for “Update?” / “next” status. Say **Update?** for a snapshot; say **next** to work the highest-priority open item.

**Last updated:** 2026-09-05 (roadmap expansion)  
**Branch:** `main`  
**CI:** green

---

## Epic status

| Epic | Issue | Status | Plan | Procedure |
|------|-------|--------|------|-----------|
| Email identities + password auth + admin ACL | [#120](https://github.com/Maijied/Cursor-Curse-Monitor-by-Lorapok/issues/120) | **closed** | `plan/b8e4f2a1_email-identities-auth-acl-plan.md` | `procedure/0bef4984_…` (**done**) |
| Mission Control product polish + observability | _TBD_ | **planned** | _(this file — sections below)_ | _(create on first implementation PR)_ |

---

## Epic in progress

_None — pick from **Recommended next queue** below._

---

## How to use

| You say | Agent does |
|---------|------------|
| **Update?** | Refresh this file’s status row + CI/deploy + blockers; reply with done / next / blocked |
| **next** | Pick top `next` task below, implement + test + update this file |

---

## Service index (quick scan)

| Service | Done | Open | Blocked |
|---------|------|------|---------|
| Cloudflare KV | 8 | 3 | 1 |
| Cloudflare D1 | 0 | 4 | 0 |
| Cloudflare R2 | 1 | 2 | 1 |
| Cloudflare Pages / Workers | 5 | 2 | 0 |
| Firebase | 6 | 5 | 0 |
| GitHub | 5 | 2 | 0 |
| Microsoft Azure | 2 | 3 | 0 |
| Google Cloud (GCP) | 2 | 3 | 0 |
| Mail (Resend + CF Email) | 3 | 8 | 1 |
| Discord | 3 | 5 | 0 |
| Stats / Cron | 6 | 2 | 1 |
| IDE extension | 4 | 4 | 0 |
| Browser extension | 4 | 4 | 0 |
| Marketing website | 2 | 2 | 0 |
| Admin UX / observability | 2 | 12 | 0 |

---

## Cloudflare KV

| ID | Task | Status | Notes / verify |
|----|------|--------|----------------|
| KV-01 | Shared `kv-quota.js` (read + write limit detection) | **done** | `kv-quota.test.ts` |
| KV-02 | `kv-put.js` uses quota formatter | **done** | vitest |
| KV-03 | `/api/sync/status` exposes `kvQuotaLimitKind` | **done** | `sync-status.test.ts` |
| KV-04 | Infrastructure card + Cron KV banner | **done** | Settings → General / Automation |
| KV-05 | Reduce stats refresh writes (skip unchanged badge/log) | **done** | PR #119 |
| KV-06 | `writesPausedUntil` guard in stats refresh | **done** | auto-pause until UTC reset on KV quota error |
| KV-07 | KV quota meter copy + CF limits link in UI | **done** | write budget estimate, last run outcome, pause shortcut |
| KV-08 | Architecture.md § stats storage (KV vs R2 vs D1) | **done** | `docs/wiki/Architecture.md` |
| KV-09 | Wait for daily quota reset (UTC) | **done** | Stats refresh ran 2026-09-05T02:30Z; monitor if 502 returns |

---

## Cloudflare D1

| ID | Task | Status | Notes / verify |
|----|------|--------|----------------|
| D1-01 | Design: move scatter logs / subscriber index off KV | **deferred** | Reliability plan Phase 2 |
| D1-02 | Add D1 binding in `wrangler.toml` | **done** | `ccm-admin-d1` + `d1/schema.sql` |
| D1-03 | Migration script KV → D1 for `system:log:*` | **done** | `migrate-system-logs-to-d1.mjs` + runtime D1 writes |
| D1-04 | Admin queries / health for D1 connectivity | **done** | `/api/health`, `/api/sync/status`, Infrastructure card |

---

## Cloudflare R2

| ID | Task | Status | Notes / verify |
|----|------|--------|----------------|
| R2-01 | Design: `stats:readme-svg` + badge blobs to R2 | **deferred** | Reliability plan B3 option B |
| R2-02 | R2 bucket + binding | **blocked** | **You:** Cloudflare Dashboard → R2 → Enable (account `f049faaf2f67549f5c58837479596a4a`). **Then:** `node website/admin/scripts/create-r2-stats-bucket.mjs` → uncomment `[[r2_buckets]]` in `wrangler.toml` → `npm run admin:deploy:fast` |
| R2-03 | Read path in stats refresh + shields API | **done** | `r2-stats.js` + stats-refresh/badge/readme.svg R2-first |

---

## Cloudflare Pages / Workers

| ID | Task | Status | Notes / verify |
|----|------|--------|----------------|
| CF-01 | Tabbed Settings + integration APIs | **done** | `settings-tabs-secrets-plan` all [x] |
| CF-02 | Public `GET /api/firebase-config` | **done** | smoke 200 production |
| CF-03 | `ccm-mail-relay` worker deploy | **next** | `repair-mail.mjs` |
| CF-04 | `deploy-infra` workflow_dispatch for full mail | **next** | docs/guides |
| CF-05 | Production deploy after settings phases | **done** | fast deploy 2026-09-05; D1 + KV UX live at cursor-dev.lorapok.tech |
| CF-06 | Fix `firebase-config.ts` import paths (Pages bundle) | **done** | `pages-functions-imports.test.mjs` |

---

## Firebase

| ID | Task | Status | Notes / verify |
|----|------|--------|----------------|
| FB-01 | Remove hardcoded keys; runtime bootstrap | **done** | `firebase.ts` + API |
| FB-02 | KV `integrations:firebase` + seed script | **done** | `seed-firebase-kv.mjs` |
| FB-03 | GH `admin-production` `VITE_FIREBASE_*` sync on save | **done** | Settings → Firebase tab |
| FB-04 | CI build from GH secrets | **done** | `ci-cd.yml` |
| FB-05 | Vitest `firebase-config.test.ts` | **done** | 8/8 phase tests |
| FB-06 | Connected Services Firebase row health | **done** | bootstrap + session in Connected Services |
| FB-07 | Pages `VITE_FIREBASE_*` runtime secrets (KV read fallback) | **done** | `sync-firebase-pages-secrets.mjs` |
| FB-08 | KV `integrations:firebase` re-seeded production | **done** | `seed-firebase-kv.mjs` 2026-09-05 |
| AUTH-01 | RBAC + email-identities architecture sign-off | **done** | `plan/AUTH-01-rbac-matrix.md`; `rbac.js` + `GET /api/auth/me` |
| AUTH-02 | Enable Firebase Email/Password + invite-only gate | **done** | Console enabled 2026-09-05; `invite-check` + Login Password tab; Identity Toolkit probe OK |
| AUTH-03 | Login UI: email/password fields + validation (zxcvbn) | **done** | `Login.tsx` + `password-policy.ts` (min 12 + strength score) |
| AUTH-04 | Password reset + lockout messaging for allowlisted admins | **done** | `sendPasswordResetEmail` + too-many-requests copy |
| AUTH-05 | `GET /api/auth/me` — role + permissions for SPA | **done** | `AuthProvider` + `auth-guard` via `fetchAuthMe` |
| AUTH-06 | KV `admin-rbac` store + role assignment API | **done** | `GET/PUT /api/auth/rbac`; `/admins` syncs roles |
| AUTH-07 | `requirePermission()` on all mutating API routes | **done** | deploy, settings, mail, integrations, notices, team |
| AUTH-08 | Team page: assign roles (master/admin/operator/viewer) | **done** | `Team.tsx` role dropdown + invite role |
| AUTH-09 | ACL audit log (role/email changes) | **done** | `acl-audit.js` → system log; Logs → ACL filter |
| AUTH-10 | ACL vitest matrix + production smoke (non-master paths) | **done** | `rbac-matrix.test.mjs` + `src/__tests__/rbac-matrix.test.ts` |
| AUTH-11 | Profile tab + quick-unlock PIN (Settings) | **done** | `ProfileSettingsCard`, `pin-unlock.ts`, KV verifier backup |
| AUTH-12 | **Feature ACL v2** — per-card / per-action permissions beyond nav (deploy buttons, mail send, notice publish, cred vault, team invite) | **next** | extend `requirePermission` + UI `hasPermission` on every mutating control; matrix doc |
| AUTH-13 | **ACL audit UI** — filterable timeline of role/email changes with export | **next** | Logs ACL tab + `acl-audit.js` query API |

---

## GitHub

| ID | Task | Status | Notes / verify |
|----|------|--------|----------------|
| GH-01 | Integration tab + non-secret metadata | **done** | Settings → GitHub |
| GH-02 | Env secret encryption (`github-secrets.js`) | **done** | master PUT |
| GH-03 | `/api/sync/status` GitHub zen check | **done** | sync chip |
| GH-04 | Mail sync GHA workflow polling (like deploy) | **done** | `useWorkflowPoll` + `MailSyncProgressBanner` |
| MAIL-07 | Mail sync workflow polling in UI | **done** | Mail + Setup checklist |
| GH-05 | Procedure on-merge finalize for settings PR | **next** | optional |

---

## Microsoft Azure

| ID | Task | Status | Notes / verify |
|----|------|--------|----------------|
| AZ-01 | `cloudDevEnvironments` Azure Dev Box entry | **done** | shared package |
| AZ-02 | `CloudEnvironmentsCard` (themed) | **done** | Settings → Cloud dev |
| AZ-03 | Per-env online/degraded pill from sync status | **next** | Reliability D2 |
| AZ-04 | Field guide: Azure consoles + env vars | **next** | Collapsible in card |
| AZ-05 | Optional Cosmos/Table export cron (backup only) | **deferred** | Not runtime primary |

---

## Google Cloud (GCP / GCS)

| ID | Task | Status | Notes / verify |
|----|------|--------|----------------|
| GCP-01 | Workstations + Cloud Shell in catalog | **done** | `cloudDevEnvironments.ts` |
| GCP-02 | Cloud dev card links (docs, console, install) | **done** | themed UI |
| GCP-03 | Per-env status pill | **next** | Reliability D2 |
| GCP-04 | Operator field guide (gcloud, Workstations) | **next** | FieldHelp pattern |
| GCP-05 | GCS/Firestore backup export (optional) | **deferred** | Reliability B3 option E |

---

## Mail (Resend + Cloudflare Email)

| ID | Task | Status | Notes / verify |
|----|------|--------|----------------|
| MAIL-01 | Mail transport card + Settings tab | **done** | themed |
| MAIL-02 | 60s polling on mail card | **done** | `useIntervalRefresh` |
| MAIL-03 | FieldHelp on sending domain | **done** | Phase 2 |
| MAIL-04 | Refresh Cloudflare deploy + email credentials | **done** | Global API Key deploy via `CLOUDFLARE_API_KEY`+`CLOUDFLARE_EMAIL`; CI decrypts gpg vault (`CRED_STORE_GPG_BASE64`+pin); Settings → Cloudflare rotates GH secrets |
| MAIL-05 | Resend secret via `setup-resend-secret.mjs` | **done** | Pages + GH `RESEND_API_KEY` synced |
| MAIL-06 | Resend quota + transport fallback + broadcast capacity | **done** | `service-usage.js`, cron `service-usage-sync`, Settings Resend limits |
| MAIL-07 | Resend domain `mail.lorapok.tech` DNS + verify | **done** | `npm run mail:verify-resend-domain`; KV `resendDomainVerified=true` synced |
| MAIL-09 | Design: Email identities Settings API + KV schema | **done** | `email-identities-config.js`, GET/PUT config |
| MAIL-10 | Settings **Email identities** tab — list/create `@lorapok.tech` | **done** | `EmailIdentitiesCard`; provision via CF Email Routing |
| MAIL-11 | Forward rules + display names sync (`setup-email-addresses` parity) | **done** | `POST /integrations/email-identities/sync`, `email-identities-sync.js`, CLI refactor |
| MAIL-12 | Identity provision tests + FieldHelp + api-catalog | **partial** | tests + catalog; FieldHelp deferred |
| QUOTA-01 | Service used/limit in `/api/sync/status` | **done** | Resend, Cloudflare Email, mail relay |
| QUOTA-02 | `service-usage-sync` cron (ccm-stats-cron) | **done** | probes + KV snapshot every 15m tick |
| MAIL-06 | `repair-mail.mjs` + verify scripts green | **next** | ops |
| MAIL-08 | `mailLastVerifiedAt` on health API | **next** | small API |
| MAIL-13 | **Professional mail templates** — branded HTML/text for transactional + marketing (Resend + CF relay); align with `messageCatalog` | **next** | `mail.js` templates + Settings preview |
| MAIL-14 | **Dynamic subscriber emails** — merge tags (name, platform, stats, unsubscribe); welcome + digest variants from `CHANGELOG` / site-data | **next** | subscribe API + template engine in KV |

---

## Discord

| ID | Task | Status | Notes / verify |
|----|------|--------|----------------|
| DC-01 | Discord tab + integrations card | **done** | Settings |
| DC-02 | Webhook FieldHelp + 60s poll | **done** | Phase 2 |
| DC-03 | Configure production webhooks in KV | **done** | All three webhooks in `integrations:discord` (2026-09-03 Settings); health confirms `discordConfigured` + feedback + community (2026-09-05) |
| DC-04 | Community + Feedback cards polling | **next** | optional parity |
| DC-05 | Subscribe fallback Discord URL in prod | **next** | Settings → General |
| DC-06 | **Product-designed Discord cards** — branded embed layouts for deploy, digest, community, feedback (Lorapok aesthetic) | **next** | `discord-config.js` payloads + shared template partials; preview in Settings |
| DC-07 | Discord card gallery / test-send matrix in Settings | **next** | one-click preview per webhook type |

---

## Stats / Cron

| ID | Task | Status | Notes / verify |
|----|------|--------|----------------|
| STAT-01 | `GET /api/sync/status` | **done** | PR #119 |
| STAT-02 | SyncStatusChip + Connected Services stats row | **done** | sidebar |
| STAT-03 | Cron card KV banner + FieldHelp | **done** | Phase 1 |
| STAT-04 | `useSiteData` interval refresh | **done** | PR #119 |
| STAT-05 | Overview staleness badges (>2× interval) | **next** | Reliability C |
| STAT-06 | Pause stats refresh until KV reset | **done** | Auto-pause cleared after UTC reset; `statsRefreshLastRunAt` fresh in `/api/health` |
| STAT-07 | Live stats recover after quota reset | **next** | verify post-reset |

---

## IDE extension

| ID | Task | Status | Notes / verify |
|----|------|--------|----------------|
| IDE-01 | Login refresh without poll wait | **done** | PR #119 |
| IDE-02 | Analytics chart fixes | **done** | PR #118/#119 |
| IDE-03 | Cloud IDE link list in settings modal | **next** | Reliability D5 |
| IDE-04 | `state.vscdb` watcher | **deferred** | out of scope |
| IDE-05 | **Platform logos + download links** in status bar / about (EXT-01) | **next** | shared footer component |

---

## Browser extension

| ID | Task | Status | Notes / verify |
|----|------|--------|----------------|
| BR-01 | Token activation on first connect | **done** | PR #119 |
| BR-02 | 60s connect poll + probeAuth | **done** | PR #119 |
| BR-03 | Options cloud environments section | **next** | Reliability D5 |
| BR-04 | Align Options connect with popup | **next** | Reliability A |
| BR-05 | **Platform logos + AMO/Chrome links** in popup/options footer (EXT-01) | **next** | Lorapok + Cursor attribution + marketplace row |

---

## Marketing website

| ID | Task | Status | Notes / verify |
|----|------|--------|----------------|
| WEB-01 | `site-data.json` / shields API fallback | **done** | existing |
| WEB-02 | Subscribe prompt respects admin KV | **done** | existing |
| WEB-03 | Regenerate committed site-data (local drift) | **next** | unstaged files — don’t commit noise |
| WEB-04 | Hero / stats polish plan | **deferred** | `a8f3c2d1_website-final-polish-plan.md` |

---

## Settings UX (cross-cutting)

| ID | Task | Status | Notes / verify |
|----|------|--------|----------------|
| SET-01 | Tabbed Settings (14 tabs) | **done** | General, Profile, Mail, Resend, Testmail, Discord, Firebase, GitHub, Cloudflare, Cred vault, Marketplace, Automation, Cloud dev, Services |
| SET-02 | Phased completion `settings-phases-complete.md` | **done** | Phases 0–4 |
| SET-03 | FieldHelp on all integration inputs | **done** | Mail, Discord, Cron, Subscribe, Reindex, Resend, Testmail |
| SET-04 | 60s polling all integration cards | **done** | hook + cards |
| SET-05 | Production smoke (login + tabs) | **partial** | `auth:tier-d` covers login/RBAC/PIN headless; optional live tab walkthrough |
| SET-06 | Open PR or track on main-only flow | **done** | Direct push to `main` with branch-protection bypass (documented) |
| SET-07 | Per-service Settings tabs (Resend, testmail, cred vault, marketplace) | **done** | `ResendConfigCard`, `TestmailConfigCard`, `CredVaultConfigCard`, `MarketplaceConfigCard` |
| SET-08 | Settings tab: **Email identities** (`@lorapok.tech` provision) | **done** | `EmailIdentitiesCard`; MAIL-09–10 |
| SET-09 | Settings + nav gated by RBAC permissions | **done** | `nav-permissions.ts`, PermissionRoute, card write gates |
| SET-10 | Production smoke: password login + role-restricted UI | **done** | `npm run auth:tier-d` (vitest + `auth:probe-production`) |
| CRED-01 | Cred vault CI + Settings maintenance | **done** | `load-cred-vault-env-ci.mjs`, `sync-cred-vault-github.mjs`, Settings Cloudflare card (global key + cred vault CI badge) |
| LOGIN-01 | **Login page infra notes** — after deploy, show read-only panel: auth methods (Google, magic link, password), invite-only policy, Firebase project, links to docs/wiki | **next** | `Login.tsx` info card; data from `/api/health` + `/api/firebase-config` (no secrets) |
| NOTICE-01 | **Changelog → Notice automation** — on release/deploy, parse `CHANGELOG.md` / release tag → draft Mission Control notice (full detail) for master review + one-click publish | **next** | `scripts/changelog-to-notice.mjs` + Notices API; optional CI hook |
| ANALYTICS-01 | **Service analytics hub** — aggregate operator-facing metrics: Cloudflare (KV/R2/Pages), Google (Analytics/Firebase if configured), GitHub, Resend, marketplace downloads | **next** | new Overview / Reports cards; `/api/analytics/services` facade |
| LOGS-01 | **Unified logs explorer** — structured JSON logs, severity, source, ACL filter, full-text search, time range, export; D1 + KV scatter | **next** | Logs page v2; normalize `logSystemEvent` schema |
| EXT-01 | **Platform availability strip** — VS Code, Open VSX, Firefox AMO, Chrome zip, GitHub Releases logos + live links in admin, website, IDE popup, browser options | **next** | shared `@lorapok/cursor-monitor-shared` component; footer on all surfaces |

---

## Recommended **next** queue (priority order)

1. **R2-02** — **Blocked on you:** [Cloudflare R2](https://dash.cloudflare.com/?to=/:account/r2/overview) → **Enable R2** for account `f049faaf2f67549f5c58837479596a4a` → then `node website/admin/scripts/create-r2-stats-bucket.mjs` → uncomment `wrangler.toml` → deploy
2. **LOGIN-01** — Login page infra/auth info panel (post-deploy transparency)
3. **AUTH-12** — Feature-level ACL on admin panel actions (extends existing RBAC)
4. **NOTICE-01** — Auto-draft notices from `CHANGELOG` on release
5. **MAIL-13 / MAIL-14** — Professional templates + dynamic subscriber emails
6. **DC-06 / DC-07** — Product-designed Discord cards + Settings preview
7. **ANALYTICS-01** — Multi-service analytics hub (Cloudflare, Google, GitHub, …)
8. **LOGS-01** — Formatted, filterable unified logs
9. **EXT-01** — Platform logos + links across admin, website, IDE, browser extensions

---

## Blockers (need you)

| Blocker | Unblocks |
|---------|----------|
| R2 not enabled on account (`code 10042`) | R2-02 — enable in [Cloudflare Dashboard → R2](https://dash.cloudflare.com/?to=/:account/r2/overview), then re-run `create-r2-stats-bucket.mjs` |

---

## Related plans

- `plan/settings-phases-complete.md` — settings phases 0–5 (code complete; deploy smoke open)
- `plan/settings-tabs-secrets-plan.md` — acceptance [x] all
- `plan/f2a8c3e1_reliability-sync-kv-settings-plan.md` — reliability Phases A–E (partial)
- `procedure/2b7b880d_settings-tabs-secrets.md`
- `plan/b8e4f2a1_email-identities-auth-acl-plan.md` — email identities Settings panel, password auth, RBAC/ACL
- `procedure/0bef4984_email-identities-panel-password-auth-admin-acl.md` — epic procedure ([#120](https://github.com/Maijied/Cursor-Curse-Monitor-by-Lorapok/issues/120))
