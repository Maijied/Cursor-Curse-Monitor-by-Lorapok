# Architecture

## Monorepo layout

```
cursor-usage-monitor/
├── src/                 # VS Code / Cursor extension (TypeScript)
├── packages/shared/     # Shared API types + budget math
├── browser-extension/   # Firefox AMO + Chrome zip WebExtension
├── website/             # Marketing static site (GitHub Pages)
│   └── admin/           # Mission Control SPA + Cloudflare Pages Functions
├── media/               # Extension & repo assets
└── docs/wiki/           # GitHub Wiki source (sync to wiki repo)
```

## Data flow

```mermaid
flowchart LR
  IDE[Cursor / VS Code] -->|auth token + local metadata| EXT[IDE Extension]
  EXT -->|usage-summary + profile| API[api2.cursor.sh]
  EXT -->|scan files / clipboard| SCAN[packages/shared scanSecrets]
  Browser[Firefox / Chrome] -->|token from cursor.com or manual| BEXT[Browser Extension]
  BEXT -->|usage-summary + profile| API
  BEXT -->|paste validation| SCAN
  SCAN -->|redacted findings| ALERT[Security Alert UI]
  GitHook[pre-commit secretlint] --> SCAN
  Visitor[Website visitor] --> SITE[GitHub Pages]
  Admin[Admin operator] --> MC[Mission Control]
  MC -->|Pages Functions| KV[(ADMIN_KV)]
  MC -->|dispatch| GHA[GitHub Actions]
  MC -->|send| MAIL[Cloudflare Email]
  GHA --> OVSX[Open VSX]
  GHA --> VSM[VS Code Marketplace]
  GHA --> AMO[Firefox AMO]
  GHA --> CHROME[Chrome zip]
```

## Schedules & Discord

Weekly GitHub Actions jobs regenerate marketing data; Cloudflare `ccm-stats-cron` calls Mission Control every minute and respects the **Settings → Live stats refresh** interval in `ADMIN_KV`. Discord cards fire on deploy events, CI website/admin deploy, and feedback tests.

```mermaid
flowchart TB
  subgraph settings["Mission Control Settings"]
    CronCfg["Cron schedules · stats refresh + Discord digest"]
    DiscordCfg["Discord webhooks · deployment + feedback"]
  end

  subgraph gh["GitHub Actions — fixed schedule"]
    SEO["seo-pipeline · Mon 06:00 UTC"]
    DepSec["dependency-security · Mon 07:30 UTC"]
    SEO --> Artifacts["site-data.json · SEO · badges · sitemap"]
  end

  subgraph cf["Cloudflare"]
    Worker["ccm-stats-cron worker · every minute"]
    CronStats["POST /api/cron/stats-refresh"]
    CronDigest["POST /api/cron/discord-digest"]
    KV[("ADMIN_KV")]
    Pages["Pages Functions /api/*"]
  end

  subgraph stats["Live download stats"]
    Refresh["runStatsRefresh"]
    Cache["stats:live-cache"]
    Public["GET /api/site-data · badge.json"]
  end

  subgraph discord["Discord notifications"]
    Digest["runDiscordDigest · download breakdown"]
    DeployEvt["Deploy started / completed watch"]
    CINotify["CI discord-deployment-notify.mjs"]
    Feedback["Feedback webhook test"]
    Webhook[("deploymentWebhookUrl")]
    FeedbackHook[("feedbackWebhookUrl")]
  end

  CronCfg -.->|interval gate| CronStats
  CronCfg -.->|interval gate| CronDigest
  DiscordCfg --> Webhook
  DiscordCfg --> FeedbackHook
  Worker -->|X-Cron-Secret| CronStats
  Worker -->|X-Cron-Secret| CronDigest
  CronStats -->|when due| Refresh
  CronDigest -->|when due| Digest
  Refresh --> KV
  Refresh --> Cache
  Cache --> Public
  Digest --> Webhook
  Pages --> KV

  DeployEvt --> Webhook
  CINotify --> Webhook
  Feedback --> FeedbackHook

  MC["Operator"] --> settings
  MC -->|manual refresh| Refresh
  MC -->|send digest now| Digest
```

## Stats storage (KV, R2, D1)

Live download stats and Mission Control config today live in **Cloudflare KV** (`ADMIN_KV`). There is no in-app KV usage percentage — Cloudflare enforces **daily read/write quotas** on the Workers plan (Free tier: ~100k reads / ~1k writes per day). When writes are exhausted, `runStatsRefresh` fails or auto-pauses until UTC reset (`writesPausedUntil` in `integrations:stats-refresh`).

### Current KV keys (stats path)

| Key | Content | Writes per refresh |
|-----|---------|-------------------|
| `stats:live-cache` | JSON totals + channel breakdown | 1 when data changes |
| `stats:badges-bundle` | Shields.io JSON payloads | 1 when `displayTotal` changes |
| `stats:readme-svg` | README chart SVG string | 1 when `displayTotal` changes |
| `integrations:stats-refresh` | Cron metadata (`lastRunAt`, `lastError`, pause guard) | 1 always |
| `system:log:*` | Scatter event log | skipped when stats unchanged |

**Optimizations shipped (Phase B1):** badge/readme writes only when verified totals change; scatter log skipped on unchanged refresh; KV quota errors set `writesPausedUntil` and skip automatic cron until UTC reset. Settings → **General → Infrastructure** shows estimated write budget, last run outcome, and a master-only pause shortcut.

**System logs (D1-03):** when `ADMIN_D1` is bound, new `logSystemEvent` writes go to `system_logs` (no KV scatter `put`). Reads merge D1 + remaining KV scatter/legacy during transition. One-time backfill: `node website/admin/scripts/migrate-system-logs-to-d1.mjs`.

### Storage roadmap

| Store | Best for | Status |
|-------|----------|--------|
| **KV** | Small JSON config blobs, hot stats cache | **Production** — current path |
| **R2** | Large blobs (`stats:readme-svg`, badge assets) | **Phase 2** — removes 2+ KV puts per refresh when totals change |
| **D1** | Append-heavy data (`system:log:*`, subscriber index) | **Phase 2** — `ADMIN_D1` binding (`ccm-admin-d1`) provisioned; KV migration pending |
| **GitHub `site-data.json`** | Marketing fallback when APIs unreachable | **Production** — weekly GHA + manual regen; not real-time |
| **GCP / Azure** | Optional off-site backup of stats snapshots | **Deferred** — export via GHA cron, not runtime dual-write |

**Recommendation:** keep optimizing KV first (done); migrate bulky SVG/JSON to **R2** next; move logs/subscribers to **D1** when bindings exist. See `plan/mission-control-master-tasks.md` (KV-08, R2-*, D1-*).

## IDE extension

- Quota and billing come from Cursor’s remote usage API after reading the local auth token in `state.vscdb`
- Local insights (read-only) include daily line-accept stats, active models, and composer session titles — not chat transcripts
- Status bar + sidebar dashboard; native workbench toasts overlay the open editor
- Optional Composer 2.5 fallback when limits exceeded (quit-then-write)
- **Security monitor** (`securityMonitor.ts`): pattern-based credential scan via shared `scanSecrets`; Manage Processes–style alert panel; commands for workspace and clipboard scan. Does not read live Composer chat.

## Browser extension

- Hybrid auth: content script on `cursor.com` captures Bearer token from `api2.cursor.sh` requests, or manual paste in Options
- Animated Budget Tracker popup; mandatory Lorapok Labs + Cursor footer
- **Security scanner** on Options paste — warns when extra secrets appear alongside an intentional Cursor token
- Firefox: auto-published to AMO via `publish-amo.mjs` (`web-ext sign` + generated metadata)
- Chrome: direct-download zip (not Chrome Web Store)

## Versioning

- Root `package.json` holds the production base semver
- Workspace packages use `0.0.0` in git; `npm run version:sync` resolves versions at build time
- CI and Mission Control releases run `version:sync` before packaging

## Security scanner (shared)

- Core engine: `packages/shared/src/scanSecrets.ts` — Bearer/JWT, API keys, private keys, password assignments, `.env` patterns
- Redaction: findings store `abcd…wxyz` snippets only; full matches are never logged or uploaded
- Repo: `.secretlintrc.json` + Husky pre-commit + CI `security:scan`
- **Limitation:** Composer chat secrets that never hit disk are not detectable

## Marketing site

- Static HTML + `site-data.json` / `seo.json` (generated by root scripts)
- OG image: `website/assets/marketing/og-social-card.png` (1200×630)
- GitHub social preview: `media/github-social-preview.png` (1280×640)

## Admin API

Authenticated `/api/*` routes on Cloudflare Pages Functions. Secrets in Pages environment / GitHub Actions.

[← Home](Home)
