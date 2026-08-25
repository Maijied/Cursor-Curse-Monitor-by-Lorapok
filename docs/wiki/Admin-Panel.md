# Admin Panel (Mission Control)

Mission Control is the Lorapok Labs operations dashboard at **https://cursor-dev.lorapok.tech**.

## Authentication

- Google sign-in or email magic link (Firebase Auth)
- Only allowlisted admin emails can access `/dashboard/*`
- Master admin is configured via `ADMIN_MASTER_EMAIL`

## Master admin privileges

Only the **master admin** can trigger:

- **Release** — bump version, tag, publish to marketplaces
- **Deploy** — re-publish an existing git tag
- **Rollback** — restore a prior tag as a new patch release

Non-master admins can view deployment history and runtime logs but cannot submit dispatch forms.

## Modules

| Module | Purpose |
|--------|---------|
| **Overview** | Health, marketplace sync, KPIs, download breakdown |
| **Deployments** | Trigger publish or rollback workflows with live runtime log preview |
| **Notices** | Enable/disable development notices on the marketing site |
| **Mailbox** | Outbound mail log, branded HTML templates, compose & test |
| **Logs** | API activity, mail events, system events |
| **Team** | Admin allowlist management |
| **Docs** | In-app architecture reference |

## Publish markets

When dispatching a release or deploy, choose the target marketplace:

| Market | Destination |
|--------|-------------|
| `Both` | Open VSX + VS Code Marketplace |
| `Open VSX` | Canonical `lorapok-labs` listing |
| `VS Code Marketplace` | `LorapokLabs` publisher |
| `Firefox AMO` | Browser extension via `web-ext sign` |

## Local development

```bash
cd website/admin
cp .env.example .env
npm run dev
```

Dev server: http://localhost:5173 — API routes are served by `vite-dev-api.mjs`.

## PWA

Mission Control is installable as a PWA. After manifest updates, reinstall or clear site data to refresh the shell cache.

[← Home](Home) · [Deployment](Deployment) · [Mailbox and Email](Mailbox-and-Email)
