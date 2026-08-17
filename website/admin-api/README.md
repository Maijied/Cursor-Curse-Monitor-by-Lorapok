# Deprecated — Standalone Admin API Worker

> **Status: deprecated — do not deploy or extend.**

This directory held an early **standalone Cloudflare Worker** for admin APIs. Production has moved to **Cloudflare Pages Functions** co-located with the Mission Control SPA.

## Current production path

| Concern | Location |
|---------|----------|
| Admin SPA + PWA | `website/admin/src/` |
| Pages Functions (`/api/*`) | `website/admin/functions/api/` |
| Live deployment | https://cursor-dev.lorapok.tech |
| Cloudflare project | `cursor-monitor-admin` |

All admin routes — notices, analytics, deployments, marketplace sync, discussions — are served from the same origin as the React dashboard with Firebase JWT verification and `ADMIN_KV` bindings.

## Migration summary

| Legacy | Current |
|--------|---------|
| Separate Worker project | Cloudflare Pages `cursor-monitor-admin` |
| `website/admin-api/` source | `website/admin/functions/api/` |
| Orphan Workers Builds app | Removed — deploy via GitHub Actions + `wrangler pages deploy` |

## What to read instead

- [website/admin/README.md](../admin/README.md) — Mission Control architecture, API routes, PWA, auth
- [DEPLOYMENT.md](../../DEPLOYMENT.md) — secrets, KV bindings, DNS, release checklist
- [README.md](../../README.md) — monorepo overview and system diagram

If you find references to this folder in old docs or scripts, update them to point at `website/admin/functions/api/`.
