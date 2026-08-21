# Deprecated: Admin API Worker

This standalone Cloudflare Worker package has been superseded by Cloudflare Pages Functions located in `website/admin/functions/api/`.

### Migration Details:
- The Admin Panel SPA in `website/admin/` communicates directly with its co-located Pages Functions at `/api/*`.
- Pages Functions provide identical API endpoints with unified origin, KV storage binding, and Firebase token verification without requiring a standalone Worker deployment.
- Do not deploy or maintain this package.
