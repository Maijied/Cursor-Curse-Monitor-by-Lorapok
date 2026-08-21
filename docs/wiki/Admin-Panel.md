# Admin Panel (Mission Control)

Mission Control is the Lorapok Labs operations dashboard at **https://cursor-dev.lorapok.tech**.

## Authentication

- Google sign-in or email magic link (Firebase Auth)
- Only allowlisted admin emails can access `/dashboard/*`
- Master admin is configured via `ADMIN_MASTER_EMAIL`

## Modules

| Module | Purpose |
|--------|---------|
| **Overview** | Health, marketplace sync, KPIs |
| **Deployments** | Trigger publish or rollback workflows with live runtime log preview |
| **Notices** | Enable/disable development notices on the marketing site |
| **Mailbox** | Outbound mail log, branded HTML templates, compose & test |
| **Logs** | API activity, mail events, system events |
| **Team** | Admin allowlist management |
| **Docs** | In-app architecture reference |

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
