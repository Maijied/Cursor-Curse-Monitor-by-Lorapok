# Settings tabs + secrets plan

## Goal

Refactor Mission Control **Settings** into service tabs (Discord-style cards per provider). Remove hardcoded Firebase client config from source; persist in ADMIN_KV and sync `VITE_FIREBASE_*` / `FIREBASE_PROJECT_ID` to GitHub `admin-production` secrets on master save.

## Acceptance criteria

- [ ] Settings page uses horizontal tabs: General, Mail, Discord, Firebase, GitHub, Cloudflare, Automation, Cloud dev, Services
- [ ] `firebase.ts` has no embedded project keys; bootstraps via `GET /api/firebase-config` (or `VITE_FIREBASE_*` in local `.env`)
- [ ] Master admin can GET/PUT `/api/integrations/firebase/config`; save writes KV + GitHub env secrets
- [ ] GitHub and Cloudflare integration tabs expose non-secret metadata + optional secret rotation with GH sync
- [ ] `vite-dev-api.mjs` mirrors new routes; api-catalog updated
- [ ] CI admin build receives `VITE_FIREBASE_*` from `admin-production` secrets
- [ ] Vitest covers firebase-config shared module + public config route

## Out of scope

- Cloudflare Pages secret PUT from Workers (GH secrets only for CI; runtime uses Pages env / KV)
- Removing `website/firebase-public.json` entirely (demote to empty template)
