# Deprecated — Standalone Admin API Worker

This directory contained an early **standalone Cloudflare Worker** for admin APIs.

## Status: deprecated

**Do not deploy.** Production admin APIs live in:

```
website/admin/functions/api/
```

Those Pages Functions run on the same origin as the Mission Control SPA (`cursor-dev.lorapok.tech`), with Firebase JWT verification, KV-backed notices, and parity with the React dashboard.

## Migration

| Old | Current |
|-----|---------|
| Separate Worker project | Cloudflare Pages `cursor-monitor-admin` |
| `website/admin-api/` | `website/admin/functions/api/` |
| Orphan Workers Builds app | Removed — deploy via GitHub Actions + `wrangler pages deploy` only |

See [DEPLOYMENT.md](../../DEPLOYMENT.md) and [website/admin/README.md](../admin/README.md).
