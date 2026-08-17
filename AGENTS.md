# AGENTS.md

## Cursor Cloud specific instructions

This repo contains four related components. The update script already runs
`npm ci` in the repo root and in `website/admin/`, so dependencies are installed
before you start.

### Components

- **IDE extension (repo root)** — VS Code / Cursor extension in TypeScript (`src/`).
  Compiled with `tsc` to `dist/`, packaged with `vsce`.
- **Browser extension (`browser-extension/`)** — Manifest V3 WebExtension (Firefox +
  Chrome). Vite build → `browser-extension/dist/`. Firefox publishes to AMO via
  `web-ext sign` in CI; Chrome is a direct-download zip only.
- **Marketing website (`website/`)** — static site deployed to GitHub Pages.
- **Admin SPA (`website/admin/`)** — Mission Control on Cloudflare Pages.

### Browser extension — build / test

```bash
npm run build -w @lorapok/cursor-monitor-shared
npm run browser-ext:test
npm run browser-ext:build
npm run build:chrome -w browser-extension   # zip artifact
node browser-extension/scripts/generate-amo-metadata.mjs
```

- Popup/options UI must include footer: Lorapok Labs (`https://lorapok.tech`) +
  Cursor (`https://cursor.com`) on every page.
- Shared API logic lives in `packages/shared/` (`@lorapok/cursor-monitor-shared`).

### IDE extension (root) — build / test / package

Standard scripts are in `package.json` (`compile`, `test`, `validate:assets`,
`package`). Notes:

- `npm test` runs plain Node scripts (`tests/test_*.js`) that use the
  experimental `node:sqlite` module; they self-skip if it is unavailable, so run
  on Node 22+ (CI uses Node 22).
- `npm run package` (vsce) runs a `prepackage` step (`validate:assets` +
  `sync:icons`) and produces a `.vsix` in the repo root.
- **Running the extension itself requires the VS Code Extension Development Host
  (F5 / `launch.json`), which needs a GUI VS Code and is not runnable headlessly.**
  Use `npm test` + `npm run package` as the headless proof of correctness.

### Marketing website (`website/`) — run / regenerate

- Regenerate live data with the root scripts `npm run site:data` and
  `npm run site:seo` (validate with `npm run site:seo:validate`). These fetch
  live data from the Open VSX / VS Code Marketplace / GitHub APIs, so numbers
  depend on network egress; they fall back to zeros/defaults when unreachable.
- It is a static site — preview by serving the `website/` directory with any
  static server (e.g. `python3 -m http.server`) and opening `index.html`.

### Admin SPA (`website/admin/`) — run / test / build / lint

- Dev server: `npm run dev` (Vite, http://localhost:5173, routes to `/login`).
  A dev middleware (`vite-dev-api.mjs`) serves `/api/*`, `/site-data.json`, and
  `/seo.json` locally, so no separate backend is needed for local dev.
- Tests: `npm test` (vitest). Build: `npm run build` (`tsc -b && vite build`;
  its `prebuild` regenerates `site-data.json`/`seo.json` via the root scripts,
  so the repo root must be intact).
- **Lint gotcha:** the `lint` npm script is `eslint .`, but ESLint is NOT a
  dependency — the actual linter is **oxlint** (config in `.oxlintrc.json`).
  Run the linter with `npx oxlint` from `website/admin/`; `npm run lint` fails
  with `eslint: not found`.
- **Auth gotcha:** the admin dashboard is gated behind Firebase auth (Google
  sign-in / email magic link), which needs real external credentials. Headless
  agents can render/interact with the `/login` page but cannot reach the
  authenticated dashboard without a real Google account. `website/admin/.env`
  ships with public Firebase config for local dev.

### Notes

- Node 22 is expected (CI uses Node 22). A few admin devDeps (`jsdom`, `undici`)
  print `EBADENGINE` warnings on Node 22.14 but install and run fine.
- The deprecated standalone worker in `website/admin-api/` is not used — the
  admin API lives in `website/admin/functions/api/` (Pages Functions).
