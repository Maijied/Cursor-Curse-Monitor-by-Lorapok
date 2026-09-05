# Mission Control — master task registry

**Purpose:** Single checklist for “Update?” / “next” status. Say **Update?** for a snapshot; say **next** to work the highest-priority open item.

**Last updated:** 2026-09-05 (social/SEO, Discord CI cards, admin footer, cred sync)  
**Branch:** `feat/github-task-tracking-system`  
**CI:** green  
**Agent onboarding:** [`MISSION-CONTROL-WALKTHROUGH.md`](../MISSION-CONTROL-WALKTHROUGH.md) · root symlink [`mission-control-master-tasks.md`](../mission-control-master-tasks.md) · **GitHub issues:** [`TASK-TRACKING.md`](../TASK-TRACKING.md) · [Project #4](https://github.com/users/Maijied/projects/4)

---

## Epic status

| Epic | Issue | Status | Plan | Procedure |
|------|-------|--------|------|-----------|
| Email identities + password auth + admin ACL | [#120](https://github.com/Maijied/Cursor-Curse-Monitor-by-Lorapok/issues/120) | **closed** | `plan/b8e4f2a1_email-identities-auth-acl-plan.md` | `procedure/0bef4984_…` (**done**) |
| Mission Control product polish + observability | [#126](https://github.com/Maijied/Cursor-Curse-Monitor-by-Lorapok/issues/126) | **in progress** | _(this file — sections below)_ | [`procedure/mission-control-issues.json`](../procedure/mission-control-issues.json) |

---

## Epic in progress

_None — pick from **Recommended next queue** below._

---

## How to use

| You say | Agent does |
|---------|------------|
| **Update?** | Refresh this file’s status row + CI/deploy + blockers; reply with done / next / blocked |
| **next** | Pick top `next` task below, implement + test + update this file |
| **sync issues** / **sync tasks** | `npm run sync:labels` → `npm run sync:tasks` → `npm run setup:github-project` |

**Canonical AI vocabulary:** [`.cursor/rules/ai-agent-commands.mdc`](../.cursor/rules/ai-agent-commands.mdc) · wiki [AI Agent Commands](../docs/wiki/AI-Agent-Commands.md)

**GitHub:** Run `node scripts/sync-mission-control-issues.mjs --add-to-project` to sync open tasks to [Project #4](https://github.com/users/Maijied/projects/4). See [`TASK-TRACKING.md`](../TASK-TRACKING.md).

---

## Service index (quick scan)

| Service | Done | Open | Blocked |
|---------|------|------|---------|
| Cloudflare KV | 8 | 3 | 1 |
| Cloudflare D1 | 0 | 4 | 0 |
| Cloudflare R2 | 2 | 1 | 0 |
| Cloudflare Pages / Workers | 5 | 2 | 0 |
| Firebase | 6 | 5 | 0 |
| GitHub | 5 | 4 | 0 |
| Release & deploy | 0 | 3 | 0 |
| Microsoft Azure | 2 | 3 | 0 |
| Google Cloud (GCP) | 2 | 3 | 0 |
| Mail (Resend + CF Email) | 3 | 8 | 1 |
| Discord | 3 | 11 | 0 |
| SEO & growth | 0 | 3 | 0 |
| Social & media | 0 | 4 | 0 |
| Stats / Cron | 6 | 2 | 1 |
| IDE extension | 4 | 4 | 0 |
| Browser extension | 4 | 4 | 0 |
| Marketing website | 4 | 8 | 0 |
| Legal & privacy | 0 | 2 | 0 |
| Ecosystem expansion | 3 | 18 | 0 |
| Admin UX / observability | 3 | 16 | 0 |

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
| R2-02 | R2 bucket + binding | **done** | Bucket `ccm-admin-stats` created 2026-09-05; `[[r2_buckets]] STATS_R2` in `wrangler.toml` — redeploy to bind |
| R2-04 | R2 free-tier guardrails + KV fallback surfacing | **done** | `STATS_R2_FREE_TIER`, health/sync `statsR2`, Infrastructure card + login panel; stats-refresh KV fallback |
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
| OPS-01 | Bump `wrangler` to latest 4.x | **done** | `website/admin` devDep `^4.129.0` (was 4.123.0) |
| OPS-02 | CI Node 24 (replace deprecated Node 22 pin) | **done** | `.nvmrc` + all `.github/workflows/*` `node-version: 24`; engines `>=24.0.0` |
| OPS-03 | Periodic wrangler + Node LTS audit | **next** | Quarterly check against Cloudflare Workers + GitHub Actions images |

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
| AUTH-12 | **Feature ACL v2** — per-card / per-action permissions beyond nav (deploy buttons, mail send, notice publish, cred vault, team invite) | **done** | `feature-permissions.ts`, `api-permissions.ts`, `ReadOnlyAclBanner`; gates on Notices, Subscribers, Mailbox, Team, CredVault, ApiExplorer, Deployments |
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
| GH-06 | **GitHub webhooks** — repo push, release, workflow_run → Mission Control ingest + fan-out to Discord/social | **next** | Settings → GitHub tab; configurable events; HMAC verify |

---

## Release & deploy

| ID | Task | Status | Notes / verify |
|----|------|--------|----------------|
| REL-01 | **Beta release pipeline fix** — `-beta` tag/channel, `release-prep`, marketplace skips (Firefox), Mission Control deploy dispatch out of sync with CI | **done** | `buildBetaVersionPlan`, `ci-cd.yml` deploy gate, `Deployments.tsx` channel-aware version plan |
| DEPLOY-01 | **Global deploy runtime UX** — after dispatch, operator navigates any admin page; floating deploy button + pipeline panel stay live; every UI step maps 1:1 to `ci-cd.yml` jobs (resolve-version → compile → package → marketplaces → Pages → Discord) | **next** | `DeployRuntimeContext`, `DeployRuntimePanel`, `DeployLeaveWarningModal`; parity with `workflow-run-match.ts` |
| DEPLOY-02 | **Remove duplicate webhook UI** from Deployments page — canonical config in Settings → Discord / Social | **done** | `Deployments.tsx` links to Settings → Discord; webhook card removed |
| DEPLOY-03 | **Deploy → social gallery trigger** — on CI success, queue SOCIAL-02 image generation from changelog caption | **next** | hooks `release-prep` + Mission Control deploy complete |

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
| MAIL-16 | **Live email deliverability audit** — verify every project address works in production (`cursor.monitor@`, `cursor.curse.help@`, identities, noreply) | **next** | `mail-probe` cron + Settings matrix; alert on failure |

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
| DC-08 | **CI/CD success cards** — Discord embed on workflow success: jobs, duration, markets, changelog excerpt, release link | **next** | `discord-deployment-notify.mjs` + `ci-cd.yml`; pairs DC-06 templates |
| DC-09 | **CI/CD failure cards** — Discord embed on failure: failed job, step, logs URL, partial changelog, rollback hint | **next** | same pipeline; distinct Lorapok error aesthetic |

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
| WEB-03 | Regenerate committed site-data (local drift) | **done** | `githubCommunity` block + features explorer |
| WEB-04 | Hero / stats polish plan | **deferred** | `a8f3c2d1_website-final-polish-plan.md` |
| WEB-05 | **Interactive features explorer** — post-hero cards + GitHub community stats panel | **done** | `features-explorer.js`, `site-data.json` |
| WEB-06 | **Chrysalis (floating AI)** — live product Q&A from `site-data.json` | **partial** | `ccm-floating-assistant.js`; rename → Chrysalis (CHRYS-01) |
| WEB-07 | **Expanded system topology** — beautiful animated diagrams with **every** CI/CD step, cron, KV/R2, marketplaces, Discord (match `ci-cd.yml` + Architecture wiki) | **next** | `architecture.mjs`, `index.html` #architecture; add deploy job-level nodes |
| WEB-08 | **Behind the scenes** — engineering section: monorepo layout, Mission Control, procedure/agents, cred vault, release integrity | **next** | new `#engineering` section; link to wiki + GitHub |
| WEB-09 | **Public multi-page site** — `/wiki`, `/releases`, `/community`, `/docs` rendered from `docs/wiki` + admin notices + `site-data.json` | **next** | static pages or lightweight router; Mission Control as CMS source |
| WEB-10 | **Open-source contributor welcome** — CONTRIBUTING CTA on website, extension footers, hero/subscribe; link Project #4 + good-first issues | **next** | all surfaces; pairs with ECO-11 |
| WEB-11 | **Engineering history timeline** — long behind-the-scenes page: sectioned milestones, procedure arc, deploy history, team credits | **next** | extends WEB-08; `/engineering/history` |

---

## SEO & growth

| ID | Task | Status | Notes / verify |
|----|------|--------|----------------|
| SEO-01 | **World-class SEO core** — JSON-LD, canonical URLs, Lorapok Labs + all product links in meta/alt/semantic HTML; `seo.json` pipeline | **next** | `npm run site:seo`; repeat ecosystem keywords naturally |
| SEO-02 | **SEO admin hub** — Google Search Console, Cloudflare, Azure Webmaster, Bing; sitemap, robots, Core Web Vitals — all configurable in Settings | **next** | new Settings tab or Services card; cred vault for tokens |
| SEO-03 | **SEO policy & compliance** — privacy-aligned indexing rules, noindex admin, structured `Organization` + `SoftwareApplication` schema | **next** | `LEGAL-01` alignment; Lorapok cross-links in hidden/aria where appropriate |

---

## Social & media

| ID | Task | Status | Notes / verify |
|----|------|--------|----------------|
| SOCIAL-01 | **Multi-platform webhooks** — Discord + X/LinkedIn/Mastodon/Bluesky/Telegram (where API allows); Lorapok card templates like DC-06 | **next** | Settings → Social; KV `integrations:social`; test-send matrix |
| SOCIAL-02 | **Deploy social gallery** — AI-generated Lorapok-themed image per release; changelog caption; R2/KV; gallery in admin | **next** | `DEPLOY-03` trigger; feature-tagged assets |
| SOCIAL-03 | **One-click multi-channel publish** — share to all configured channels: captions, hashtags, platform dimensions, stories; optional video | **next** | admin Social Studio; size presets per network |
| SOCIAL-04 | **AI image provider registry** — free providers default + optional paid; admin adds many, **activate one** at a time | **next** | Settings; cred vault keys; Chrysalis/SOCIAL-02 consumer |
| SOCIAL-05 | **Video generator** — short deploy/feature clips for Reels/Stories/Shorts; template + changelog voiceover optional | **next** | configurable; falls back to static carousel |

---

## Legal & privacy

| ID | Task | Status | Notes / verify |
|----|------|--------|----------------|
| LEGAL-01 | **Terms, privacy & process consent** — unified ToS/Privacy for subscribe, extensions, analytics, Chrysalis BYOK; explicit consent before data collection | **next** | update `terms.html` / `privacy.html`; consent banner + KV audit trail |
| ANALYTICS-02 | **Visitor & user event log** — new signup/visit events (IP hash, user-agent, referrer, page); admin analytics view; retention policy | **next** | D1/Firestore; no raw secrets; GDPR-style export/delete hooks |

---

## Ecosystem expansion

| ID | Task | Status | Notes / verify |
|----|------|--------|----------------|
| ECO-01 | **All browsers** — Safari, Edge, Opera, Brave MV3 builds + CI publish matrix | **next** | shared `@lorapok/cursor-monitor-shared`; AMO/Chrome patterns |
| ECO-02 | **GitHub community stats** — traffic + CI snapshot on README, website, Mission Control | **done** | `procedure/github-community-stats.json`, `GitHubCommunityCard`, `npm run site:data` |
| ECO-03 | **Chrysalis (website)** — animated floating assistant; reads latest `site-data.json` | **partial** | `ccm-floating-assistant.js` → Chrysalis brand (CHRYS-01) |
| ECO-04 | **OS tray app** — Win/macOS/Linux system tray for limits, notices, quick actions | **next** | Electron or Tauri; shared product context |
| ECO-05 | **Cursor native plugin** — first-party Cursor extension / plugin slot (not just VS Code host) | **next** | Cursor plugin API research + packaging |
| ECO-06 | **Chrysalis everywhere** — admin SPA, IDE popup, browser options, tray shell | **next** | share Chrysalis module; CHRYS-01–05 |
| ECO-07 | **Push notifications** — Web Push + native OS alerts for limits, Mission Control notices | **next** | permission UX + KV notice hooks |
| ECO-08 | **Action validator** — confirm before deploy, delete, broadcast, cred vault write | **partial** | `packages/shared/src/confirmAction.ts`; wire admin + extensions |
| ECO-09 | **Global loading animation** — Larvae shimmer on long operations (admin, site, extensions) | **next** | extend `ShimmerSkeleton` + shared loader |
| ECO-10 | **AI conversation hygiene** — no secrets/junk in agent chat; procedure-only tracking | **next** | `.cursor/rules/ai-agent-commands.mdc` + agent docs |
| ECO-11 | **Wiki + taskboard assets** — professional wiki pages; optional generated diagrams for Project #4 | **partial** | `docs/wiki/Ecosystem-Roadmap.md`, `GitHub-Project.md`, `AI-Agent-Commands.md` |
| ECO-12 | **Repo hygiene** — gitignore local Wrangler/miniflare state; keep agent-accessible paths documented | **done** | `.gitignore` → `website/admin/.wrangler/` |
| CHRYS-01 | **Chrysalis brand + animation** — official name for floating AI; Larvae mascot animation on all surfaces | **next** | rename UI copy; shared `@lorapok/cursor-monitor-shared` Chrysalis shell |
| CHRYS-02 | **Chrysalis AI provider** — Antigravity + pluggable models; operator API key from cred vault (admin only) | **next** | user supplies Antigravity/other key; never commit; server-side proxy for admin |
| CHRYS-03 | **Chrysalis privacy tiers** — admin learns full system under RBAC; website/extensions never see admin KV, secrets, or PII | **next** | separate context bundles; fail closed on ACL |
| CHRYS-04 | **Chrysalis BYOK (user ecosystem)** — web + extensions use **user's** API key passively from options/vault; Lorapok does not ship keys to clients | **next** | encrypted local storage; opt-in; no telemetry of key material |
| CHRYS-05 | **Chrysalis system learning** — ingest wiki, site-data, usage state; suggest actions and warn (limits, budget, deploy) with surface-appropriate restrictions | **next** | RAG + rules; pairs with ECO-10 hygiene |

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
| CRED-02 | **Cred sync reliability** — idempotent save→GH/Pages/CF sync; miss detection + retry; health badge "sync never miss" | **next** | audit on every Settings master save; alert if drift |
| INT-01 | **Unified integrations hub** — one Settings surface for Discord, social, GitHub webhooks, image AI, mail, cred sync status | **next** | reduce duplicate cards; everything configurable from admin |
| LOGIN-01 | **Login page infra notes** — read-only panel: auth methods, invite-only, Firebase project, live service chips, docs links | **done** | `LoginInfraPanel.tsx` + `/api/health`; vitest `LoginInfraPanel.test.tsx` |
| NOTICE-01 | **Changelog → Notice automation** — on release/deploy, parse `CHANGELOG.md` / release tag → draft Mission Control notice (full detail) for master review + one-click publish | **done** | `changelog-to-notice.mjs`, `GET /api/notices?changelogDraft=1`, Notices UI import |
| ANALYTICS-01 | **Service analytics hub** — aggregate operator-facing metrics: Cloudflare (KV/R2/Pages), Google (Analytics/Firebase if configured), GitHub, Resend, marketplace downloads | **next** | new Overview / Reports cards; `/api/analytics/services` facade |
| LOGS-01 | **Unified logs explorer** — structured JSON logs, severity, source, ACL filter, full-text search, time range, export; D1 + KV scatter | **next** | Logs page v2; normalize `logSystemEvent` schema |
| EXT-01 | **Platform availability strip** — VS Code, Open VSX, Firefox AMO, Chrome zip, GitHub Releases logos + live links in admin, website, IDE popup, browser options | **next** | shared `@lorapok/cursor-monitor-shared` component; footer on all surfaces |
| ADMIN-01 | **Mission Control global search** — command palette (⌘K) across nav, settings tabs, API catalog, docs, and tasks | **next** | ACL-aware; fuzzy match; keyboard-first |
| ADMIN-02 | **Admin UX polish** — friendlier layouts, empty states, mobile sidebar, contextual help on dense pages | **next** | user-friendly pass; pairs with ADMIN-01 |
| ADMIN-03 | **Cross-section refer buttons** — when copy mentions another area, show minimal "Go to →" link (Settings, Deployments, Mail, …) | **next** | shared `SectionReferLink` component |
| ADMIN-04 | **Minimal global footer** — services online, system version, sync status, Lorapok Labs link; sticky bottom bar | **next** | `/api/health` + `site-data`; no duplicate Overview chips |
| ADMIN-05 | **Dedupe dashboard data** — remove redundant KPIs between Overview, Connected Services, Infrastructure | **next** | single source per metric; ADMIN-04 footer owns status strip |

---

## Recommended **next** queue (priority order)

1. **DEPLOY-01 / DEPLOY-02** — Global deploy UX + remove duplicate webhook UI
2. **DC-08 / DC-09** — Discord CI/CD success + failure cards with changelog
3. **AUTH-13** — ACL audit UI · [#132](https://github.com/Maijied/Cursor-Curse-Monitor-by-Lorapok/issues/132)
4. **ADMIN-03 / ADMIN-04 / ADMIN-05** — Refer buttons, minimal footer, dedupe Overview
5. **SOCIAL-01–03 / DEPLOY-03** — Multi-platform webhooks + deploy social gallery + one-click share
6. **SEO-01–03** — World-class SEO + admin hub + policies
7. **CRED-02 / INT-01 / GH-06 / MAIL-16** — Cred never-miss, unified integrations, GitHub webhook, live emails
8. **WEB-11** — Engineering history timeline page
9. **SOCIAL-04 / SOCIAL-05** — AI image providers + video generator
10. **CHRYS-01**, **WEB-07–10**, **LEGAL-01**, remaining queue

---

## Blockers (need you)

_None — R2 enabled 2026-09-05. Redeploy after `wrangler.toml` STATS_R2 binding if not yet live._

---

## Related plans

- `plan/settings-phases-complete.md` — settings phases 0–5 (code complete; deploy smoke open)
- `plan/settings-tabs-secrets-plan.md` — acceptance [x] all
- `plan/f2a8c3e1_reliability-sync-kv-settings-plan.md` — reliability Phases A–E (partial)
- `procedure/2b7b880d_settings-tabs-secrets.md`
- `plan/b8e4f2a1_email-identities-auth-acl-plan.md` — email identities Settings panel, password auth, RBAC/ACL
- `MISSION-CONTROL-WALKTHROUGH.md` — agent onboarding for **Update?** / **next**
- `docs/wiki/Ecosystem-Roadmap.md` — tray, browsers, Cursor plugin, Chrysalis AI, notifications
- `docs/wiki/Chrysalis.md` — floating AI assistant, privacy tiers, BYOK
- `docs/wiki/Public-Website.md` — multi-page site, topology, behind-the-scenes, contributors
- `docs/wiki/Social-and-SEO.md` — webhooks, gallery, SEO hub, multi-channel publish
- `docs/wiki/GitHub-Project.md` — Project #4, labels, milestones, community stats
- `procedure/0bef4984_email-identities-panel-password-auth-admin-acl.md` — epic procedure ([#120](https://github.com/Maijied/Cursor-Curse-Monitor-by-Lorapok/issues/120))
