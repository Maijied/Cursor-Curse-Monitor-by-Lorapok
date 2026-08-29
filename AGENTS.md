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

### Browser extension — build / test / publish

```bash
npm run version:sync
npm run build -w @lorapok/cursor-monitor-shared
npm run browser-ext:test
npm run browser-ext:build
npm run build:chrome -w browser-extension   # zip artifact
node browser-extension/scripts/publish-amo.mjs   # AMO sign (needs AMO_JWT_* env)
```

- Popup/options UI must include footer: Lorapok Labs (`https://lorapok.tech`) +
  Cursor (`https://cursor.com`) on every page.
- Shared API logic lives in `packages/shared/` (`@lorapok/cursor-monitor-shared`).
- AMO pipeline: `generate-amo-metadata.mjs` → `validate-amo-metadata.mjs` → `web-ext sign` → `verify-amo-status.mjs` (all orchestrated by `publish-amo.mjs`).

### Local dev smoke (before commit/push)

One command builds, tests, and opens IDE + Firefox + Chrome dev targets:

```bash
npm run dev:smoke          # full test suite + launch
npm run dev:smoke:quick    # scoped tests + launch
node scripts/dev-smoke.mjs --dry-run
```

- **Not** in CI or husky — opt-in only (`CI=true` skips unless `CCM_DEV_SMOKE=1`).
- Env: `CCM_DEV_CHROME=maizied` (signed-in Chrome for cursor.com), `CHROME_BIN`, `FIREFOX_BIN`, `EDITOR_BIN`.
- VS Code task: **Tasks: Run Task → dev-smoke**; F5 uses `preLaunchTask: compile`.

### VS Code-only sandbox (Personal_Projects)

Isolated copy for **fresh install + test + VS Code Extension Host** (never Cursor):

```bash
npm run dev:vscode:all       # provision worktree, npm ci, build, test, open VS Code
npm run sync:vscode-dev      # after editing here in Cursor, push files to sandbox
npm run dev:vscode           # build + test + open VS Code in existing sandbox
```

Default path: `/mnt/NewVolume/Personal_Projects/cursor-usage-monitor-vscode-dev`  
Override: `CCM_VSCODE_DEV_ROOT`. Guide in sandbox: `.vscode-dev/SANDBOX.md`.

### Parallel editors (no conflicts)

| Workspace | IDE | Build output | Browser dev profile |
|-----------|-----|--------------|------------------------|
| `~/cursor-usage-monitor` (this repo) | **Cursor** (`CCM_DEV_IDE=cursor` in launch.json) | `dist/`, `.dev-smoke/` | Isolated per smoke run |
| `…/cursor-usage-monitor-vscode-dev` | **VS Code only** | Own `node_modules` + `dist/` | `.vscode-dev/` |
| Production browser add-on | Any browser | — | Store keys (no `ccm_dev_` prefix) |
| Unpacked dev extension | Chrome/Firefox | — | `ccm_dev_*` storage keys (won’t clash with store build) |

Rules:

- Do **not** run `npm run compile` / `watch` in both workspaces at once (build lock: `.vscode-dev/locks/compile.lock`).
- After editing here in Cursor → `npm run sync:vscode-dev` before testing in VS Code sandbox.
- DB writes (reindex, fallback model) require the **editor to be fully quit** — same product folder only.
- Unknown forks (AGY, etc.): set `CCM_PRODUCT_DATA_FOLDER` to the config dir name under `~/.config`.
- Check: `npm run check:isolation`

### Global agent skills

Lorapok skills are installed globally (`~/.cursor/skills`, `~/.agents/skills`, `~/.claude/skills`):

- `loragent-amo-publish` — Firefox AMO CI and local publish
- `loragent-dynamic-versioning` — root-base version sync
- `loragent-cloudflare-mail-master` — branded mail templates
- `secure-cred-vault` — credential vault operations

Re-sync: `~/.local/bin/sync-global-agent-stack` (from repo: `node scripts/sync-global-agent-stack.mjs`)

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
- After `npm ci` / reinstall, run `npm run validate:reinstall` to verify all
  `package.json` files parse and the extension compiles.
- If Cursor shows **“Npm task detection: failed to parse package.json”** while
  terminal scripts work, that is usually an IDE race (not invalid JSON). Reload
  the window; scripts still run via `npm run …`.

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
- **Fast deploy (local testing, ~1–3 min):** skips live marketplace fetches and
  mail setup. One-time: `cd website/admin && npx wrangler login`. Then from repo
  root: `npm run admin:deploy:fast` (production) or
  `npm run deploy:fast:preview --prefix website/admin` (preview branch).
  Full repair with mail: `node website/admin/scripts/repair-mail.mjs`.
- **Mail CI:** push to `main` skips `enable-mail` and stats-cron deploy; use
  workflow_dispatch **deploy-infra** for full Cloudflare mail repair. Guide:
  `docs/guides/CLOUDFLARE_EMAIL_AND_ROUTING.md`.

### Notes

- Node 22 is expected (CI uses Node 22). A few admin devDeps (`jsdom`, `undici`)
  print `EBADENGINE` warnings on Node 22.14 but install and run fine.
- The deprecated standalone worker in `website/admin-api/` is not used — the
  admin API lives in `website/admin/functions/api/` (Pages Functions).
