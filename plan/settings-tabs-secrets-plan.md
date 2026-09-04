# Settings tabs + secrets plan

## Goal

Refactor Mission Control **Settings** into service tabs (Discord-style cards per provider). Remove hardcoded Firebase client config from source; persist in ADMIN_KV and sync `VITE_FIREBASE_*` / `FIREBASE_PROJECT_ID` to GitHub `admin-production` secrets on master save.

## Acceptance criteria

- [x] Settings page uses horizontal tabs: General, Mail, Discord, Firebase, GitHub, Cloudflare, Automation, Cloud dev, Services
- [x] `firebase.ts` has no embedded project keys; bootstraps via `GET /api/firebase-config` (or `VITE_FIREBASE_*` in local `.env`)
- [x] Master admin can GET/PUT `/api/integrations/firebase/config`; save writes KV + GitHub env secrets
- [x] GitHub and Cloudflare integration tabs expose non-secret metadata + optional secret rotation with GH sync
- [x] `vite-dev-api.mjs` mirrors new routes; api-catalog updated
- [x] CI admin build receives `VITE_FIREBASE_*` from `admin-production` secrets
- [x] Vitest covers firebase-config shared module + public config route

## Out of scope

- Cloudflare Pages secret PUT from Workers (GH secrets only for CI; runtime uses Pages env / KV)
- Removing `website/firebase-public.json` entirely (demote to empty template)
