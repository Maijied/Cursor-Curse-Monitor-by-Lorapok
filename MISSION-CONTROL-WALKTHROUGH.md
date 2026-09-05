# Mission Control — AI walkthrough

**Audience:** Cursor / Codex / Claude agents working on this monorepo.  
**Last updated:** 2026-09-05

This file is the **onboarding map** for Mission Control (admin SPA). Pair it with the live task registry and `AGENTS.md`.

---

## Quick commands

| Intent | Command |
|--------|---------|
| Node version | `.nvmrc` → **24** (CI + local) |
| Wrangler (admin) | `cd website/admin && npx wrangler --version` — target **4.129+** |
| Master task snapshot | User says **Update?** → refresh `plan/mission-control-master-tasks.md` |
| Pick next task | User says **next** → top open item in **Recommended next queue** |
| Sync GitHub board | User says **sync issues** or **sync tasks** → `npm run sync:labels && npm run sync:tasks && npm run setup:github-project` |
| Admin dev server | `cd website/admin && npm run dev` |
| Admin tests | `cd website/admin && npm test` |
| Auth smoke (SET-10) | `cd website/admin && npm run auth:tier-d` |
| Fast deploy | `npm run admin:deploy:fast` (from repo root) |
| R2 bucket (after dashboard enable) | `node website/admin/scripts/create-r2-stats-bucket.mjs` |
| Procedure for non-trivial work | `node scripts/procedure-init.mjs --title "…" --component admin` |

---

## Canonical files (read these first)

| File | Role |
|------|------|
| [`mission-control-master-tasks.md`](mission-control-master-tasks.md) | **Root symlink** → [`plan/mission-control-master-tasks.md`](plan/mission-control-master-tasks.md) — single checklist for **Update?** / **next** |
| [`AGENTS.md`](AGENTS.md) | Build/test/deploy commands for all four components |
| [`docs/wiki/Admin-Panel.md`](docs/wiki/Admin-Panel.md) | Human-facing admin docs (mirror to GitHub Wiki) |
| [`docs/wiki/Architecture.md`](docs/wiki/Architecture.md) | KV / D1 / R2 / Pages data flow |
| [`docs/wiki/Ecosystem-Roadmap.md`](docs/wiki/Ecosystem-Roadmap.md) | Tray, browsers, Cursor plugin, floating AI, notifications |
| [`docs/wiki/AI-Agent-Commands.md`](docs/wiki/AI-Agent-Commands.md) | Canonical **Update?** / **next** / **sync issues** vocabulary |
| [`.cursor/rules/ai-agent-commands.mdc`](.cursor/rules/ai-agent-commands.mdc) | Same commands — always-applied Cursor rule |
| [`.cursor/rules/cred-vault.mdc`](.cursor/rules/cred-vault.mdc) | **Never** commit secrets; use `cred get cursor <key>` |
| [`.cursor/rules/procedure-github-project.mdc`](.cursor/rules/procedure-github-project.mdc) | `procedure/` + GitHub issue tracking |

---

## What Mission Control is

- **URL (prod):** https://cursor-dev.lorapok.tech  
- **Stack:** Vite React SPA + Cloudflare Pages Functions (`website/admin/functions/api/`)  
- **Account:** Lorapok Facility `f049faaf2f67549f5c58837479596a4a`  
- **Bindings:** `ADMIN_KV`, `ADMIN_D1`, `MAIL_RELAY` (service), `STATS_R2` (pending R2 enable)

---

## Authentication system (LOGIN-01+)

| Layer | Implementation |
|-------|----------------|
| Identity | Firebase Auth (Google, email magic link, email/password) |
| Invite gate | `GET /api/auth/invite-check` — email must be on admin allowlist |
| Session | Firebase ID token → `GET /api/auth/me` → role + permissions |
| RBAC | `functions/api/_shared/rbac.js` — roles: `master`, `operator`, `viewer` |
| Nav gating | `src/lib/nav-permissions.ts`, `PermissionRoute` |
| PIN unlock | Optional local PIN after Firebase sign-in (`PinUnlockOverlay`) |
| Master bypass | `ADMIN_MASTER_EMAIL` Pages secret (from cred vault) |

**Login UI:** `website/admin/src/components/Login.tsx` + `LoginInfraPanel.tsx` (read-only infra card from `/api/health`).

**Verify auth:** `npm run auth:tier-d` (vitest + production probe). Set fresh `ADMIN_ID_TOKEN` for full Tier B coverage.

---

## “Update?” workflow

1. Read [`plan/mission-control-master-tasks.md`](plan/mission-control-master-tasks.md) (or root symlink).
2. Run narrow checks: `npm test` in touched package, `auth:tier-d` if auth touched, `gh pr checks` if on a PR.
3. Update task **Status** rows and **Recommended next queue**.
4. Update **Blockers** if operator action needed.
5. Reply with: done since last update / current blocker / suggested **next** task ID.

Do **not** implement unrelated roadmap items when user only said **Update?**.

---

## “next” workflow

1. Open **Recommended next queue** in master tasks.
2. Skip **blocked** items unless blocker cleared.
3. Create procedure file if multi-file: `node scripts/procedure-init.mjs --title "<ID> …" --component admin`.
4. Implement smallest correct diff; match existing patterns.
5. Run relevant tests; update master tasks + wiki/AGENTS if behavior changed.
6. Commit only when user asks.

Current queue (2026-09-05):

1. **REL-01** — fix beta release pipeline
2. **DEPLOY-01** — global floating deploy + CI/CD step parity (all admin pages)
3. **AUTH-13** — ACL audit UI ([#132](https://github.com/Maijied/Cursor-Curse-Monitor-by-Lorapok/issues/132))
4. **WEB-07 / WEB-08** — expanded topology + behind-the-scenes engineering
5. **WEB-09 / WEB-10** — public wiki/releases/community/docs + contributor welcome
6. **LEGAL-01 / ANALYTICS-02** — terms/consent + visitor/user analytics
7. **ADMIN-01**, **CHRYS-01–05**, **MAIL-13/14**, …

Ecosystem + Chrysalis: [Ecosystem Roadmap](docs/wiki/Ecosystem-Roadmap.md) · [Chrysalis](docs/wiki/Chrysalis.md).

---

## Cloudflare R2 (R2-02 done)

Bucket `ccm-admin-stats` on Lorapok Facility. Binding in `website/admin/wrangler.toml`:

```toml
[[r2_buckets]]
binding = "STATS_R2"
bucket_name = "ccm-admin-stats"
```

**Free tier (monthly):** 10 GB storage · 1M Class A ops · 10M Class B ops ([pricing](https://developers.cloudflare.com/r2/pricing/)).

**KV fallback:** If `STATS_R2` is missing or a put fails, `stats-refresh.js` writes badge SVG + JSON to `ADMIN_KV` (same keys as pre-R2). `readme.svg.ts` reads R2 first, then KV.

**Health:** `GET /api/health` and `GET /api/sync/status` expose `statsR2` (configured, ok, freeTier, artifactsFallback).

**Enable (one-time):** Dashboard only — API error `10042` until R2 subscription accepted.

---

## Cred vault (mandatory)

- Store: `/mnt/NewVolume/Personal_Projects/cred/credentials.json.gpg`
- CLI: `cred get cursor <key>`
- Deploy scripts: `website/admin/scripts/lib/cred-vault-sync.mjs`
- Never log secret values; mask previews only.

Common keys: `cloudflare_api_token`, `admin_master_email`, `resend_api_key`, `cron_secret`, `github_token`.

---

## Key API routes (admin)

| Route | Auth | Purpose |
|-------|------|---------|
| `GET /api/health` | public | Service indicators (no secrets) |
| `GET /api/firebase-config` | public | Firebase web client bootstrap |
| `GET /api/auth/invite-check?email=` | public | Invite allowlist gate |
| `GET /api/auth/me` | admin | Role + permissions |
| `GET /api/sync/status` | admin | KV quota, cron, integrations |

Catalog: `website/admin/src/lib/api-catalog.ts`.

---

## Storage architecture (summary)

| Store | Binding | Use |
|-------|---------|-----|
| KV `ADMIN_KV` | hot config, integrations, stats cache | quota-sensitive writes |
| D1 `ADMIN_D1` | system logs, subscriber index | `d1/schema.sql` |
| R2 `STATS_R2` | badge SVG, readme blobs | pending R2-02 |
| Pages Functions | `/api/*` | all server logic |

See `docs/wiki/Architecture.md` § stats storage.

---

## Roadmap epic (planned)

**Mission Control product polish + observability** — tasks in master registry:

- **AUTH-13** — ACL audit UI  
- **NOTICE-01** — auto notices from `CHANGELOG` (**done**)  
- **MAIL-13/14** — professional + dynamic subscriber mail  
- **DC-06/07** — Discord product cards  
- **ANALYTICS-01** — multi-service metrics hub  
- **LOGS-01** — unified filterable logs  
- **EXT-01** — platform logos/links on all surfaces  

**Ecosystem expansion** (ECO-*, CHRYS-*): all browsers, OS tray, Cursor plugin, **Chrysalis** floating AI, push notifications, global loaders, action validators — [Ecosystem Roadmap](docs/wiki/Ecosystem-Roadmap.md) · [Chrysalis](docs/wiki/Chrysalis.md).

**Release:** **REL-01** — beta channel pipeline fix. **DEPLOY-01** — deploy floating UX across all admin routes, CI step parity.

**Public website:** [Public Website roadmap](docs/wiki/Public-Website.md) — WEB-07–10, LEGAL-01, ANALYTICS-02.

---

## Related procedures

| Procedure | Topic |
|-----------|--------|
| `procedure/0bef4984_email-identities-panel-password-auth-admin-acl.md` | Epic #120 (closed) |
| `procedure/c442c0fe_r2-bucket-login-infra-notes-ai-walkthrough-sync.md` | R2 + LOGIN-01 + this walkthrough |
| `procedure/c6c42bab_reliability-sync-kv-settings.md` | KV reliability (done) |

---

## Anti-patterns for agents

- Implementing every CodeRabbit comment — triage per `.cursor/rules/coderabbit-review.mdc`
- Hardcoding secrets in `wrangler.toml`, `.env` commits, or docs
- Using throwaway Chrome for Cloudflare login — use Maizied profile / Browser MCP
- Saying **merge-ready** without green checks and triaged review threads
- Treating **next** as “do entire roadmap” — one task ID per **next** unless user expands scope
