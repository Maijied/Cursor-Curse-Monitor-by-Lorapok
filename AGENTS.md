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

### Global agent skills

Lorapok skills are installed globally (`~/.cursor/skills`, `~/.agents/skills`, `~/.claude/skills`):

- `loragent-amo-publish` — Firefox AMO CI and local publish
- `loragent-dynamic-versioning` — root-base version sync
- `loragent-cloudflare-mail-master` — branded mail templates
- `secure-cred-vault` — credential vault operations

Re-sync: `~/.local/bin/sync-global-agent-stack`

### Project design skills (version-controlled, not gitignored)

Installed under `.cursor/skills/` (mirrored in `.agents/skills/`). **Committed to git** — see the note at the bottom of `.gitignore`. Reload Cursor after pull to load skills.

#### [Snyk UI/UX engineers](https://snyk.io/articles/top-claude-skills-ui-ux-engineers/)

| Skill | Use when |
|-------|----------|
| `frontend-design` | Distinctive UI (bans generic AI templates) |
| `web-design-guidelines` | Audit UI for 100+ web interface rules |
| `react-best-practices` | React/Next.js performance (waterfalls, bundle size) |
| `composition-patterns` | Compound components, fewer boolean props |
| `ui-ux-pro-max` (+ `design`, `design-system`, `ui-styling`, `brand`, …) | Design intelligence DB + local `scripts/search.py` |
| `bencium-innovative-ux-designer` / `bencium-controlled-ux-designer` | Creative vs systematic UX reference |
| `react-native-skills` | React Native / Expo mobile UI patterns |
| `accessibility-*` | AccessLint WCAG workflow (needs `accesslint` MCP) |

#### [Composio top design skills](https://composio.dev/content/top-design-skills)

| Skill | Use when |
|-------|----------|
| `impeccable` | Brand vs product modes; anti-pattern detection |
| `figma-implement-design` | Figma → code with design-system fidelity |
| `playwright`, `playwright-interactive`, `screenshot`, `webapp-testing` | Browser visual verification |
| `theme-factory` | Reusable theme tokens / palettes |
| `julian-*` (8 skills) | Spec-first design workflow (`julian-design-flow`, …) |
| Owl-Listener (63 skills) | Research, handoff, design ops (`handoff-spec`, …) |
| `excalidraw-diagram` | Shareable `.excalidraw` diagrams |
| `composio-automation` | GitHub, Slack, Notion, Figma via Composio CLI |

**MCP:** `accesslint` in `.cursor/mcp.json` — enable in Cursor Settings → MCP.

**Examples:** “Review `website/admin` with web-design-guidelines”, “run impeccable detect”, “julian-design-flow for admin redesign”, “accessibility-scan on marketing site”.

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

### Notes

- Node 22 is expected (CI uses Node 22). A few admin devDeps (`jsdom`, `undici`)
  print `EBADENGINE` warnings on Node 22.14 but install and run fine.
- The deprecated standalone worker in `website/admin-api/` is not used — the
  admin API lives in `website/admin/functions/api/` (Pages Functions).
