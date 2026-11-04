# Licensing — Cursor Curse Monitor by Lorapok

This repository ships **multiple products** from one tree. Each store listing uses the license that matches that product. There is **no single license for the whole repo** beyond what Lorapok Labs explicitly documents here.

## Store labels (keep these aligned)

| Product | Path / artifact | Store or channel | License label |
|---------|-----------------|------------------|---------------|
| **IDE extension** | `src/`, root `package.json`, `.vsix` | Open VSX, VS Code Marketplace, GitHub Releases (VSIX) | **GPL-3.0-or-later** |
| **Firefox add-on** | `browser-extension/`, signed `.xpi` | Firefox Add-ons (AMO) | **MPL-2.0** |
| **Chrome browser build** | `browser-extension/dist/` zip | GitHub Releases (unlisted zip) | **MPL-2.0** (same component as Firefox) |
| **Marketing site** | `website/` | Cloudflare Pages | Content + site code; extension **GPL** applies to product copy referencing the IDE |
| **Mission Control admin** | `website/admin/` | Cloudflare Pages | Proprietary Lorapok product (see `website/admin/README.md`) |

Root `LICENSE` is the **full GPL-3.0 text** for the **IDE extension** and for clone/checkout of the repo as a whole. It does **not** re-license the Firefox component: that component is under **MPL-2.0** as described below.

## Component boundaries

```
cursor-usage-monitor/
├── LICENSE                 ← GPL-3.0-or-later (IDE + repo default)
├── LICENSING.md            ← this file
├── src/                    ← IDE extension → GPL-3.0-or-later
├── packages/shared/        ← shared library (dual-licensed by copyright holder — see below)
├── browser-extension/
│   ├── LICENSE.mpl-2.0.txt ← full MPL 2.0 text (Firefox/Chrome packages)
│   ├── NOTICE.md           ← third-party notices in shipped browser builds
│   └── SOURCE_CODE_NOTICE.txt ← MPL source offer (version substituted at build)
└── website/admin/          ← proprietary (not GPL/MPL product surface)
```

**IDE only:** VS Code/Cursor extension code lives under `src/` and is built to root `dist/` for marketplace `.vsix` packages. Those packages include root `LICENSE` (GPL).

**Browser only:** WebExtension source lives under `browser-extension/src/`. Built output is `browser-extension/dist/`, signed for AMO or zipped for Chrome. Those packages include **MPL** `LICENSE`, `NOTICE.md`, and `SOURCE_CODE_NOTICE.txt` (see `browser-extension/scripts/postbuild.mjs`).

## Shared code (`packages/shared/`)

`@lorapok/cursor-monitor-shared` is compiled into **both** the IDE extension and the browser add-on.

**Authorized dual licensing (copyright holder):** Lorapok Labs licenses its original work in `packages/shared/` as follows:

- When distributed as part of the **IDE extension** (Open VSX / VS Code / VSIX), that distribution is under **GPL-3.0-or-later** together with `src/`.
- When distributed as part of the **Firefox or Chrome browser add-on**, that distribution is under **MPL-2.0** together with `browser-extension/`.

Contributors: see [CONTRIBUTING.md](CONTRIBUTING.md) — contributions may be distributed under both licenses in the applicable product surfaces. External dependencies in browser builds retain their own licenses (listed in `browser-extension/NOTICE.md`).

## Third-party dependencies

- **Browser add-on runtime deps:** React and React DOM (MIT), `webextension-polyfill` (MPL-2.0). Bundled notices are in `browser-extension/NOTICE.md` and copied into `browser-extension/dist/` on build.
- **IDE extension:** Node/runtime deps are dev-time only for packaging; marketplace `.vsix` contains compiled extension output plus GPL `LICENSE`.
- Do **not** change dependency licenses in metadata without verifying upstream terms and updating `NOTICE.md`.

## Source code offer (Firefox / MPL)

Each release’s browser build embeds `SOURCE_CODE_NOTICE.txt` with a tag URL for the matching version. Corresponding source is the public GitHub repository at the tagged commit for that release.

## Verification before release

```bash
npm run validate:licenses          # repo layout + IDE GPL + browser MPL sources
npm run browser-ext:build
node browser-extension/scripts/validate-package-licenses.mjs
npm run package                    # IDE .vsix — validate:licenses inspects .vsix when present
```

Publishing scripts run browser license validation before AMO sign (`browser-extension/scripts/publish-amo.mjs`).

## No blanket relicense

Do not replace MPL with GPL on AMO or GPL with MPL on marketplaces without legal review. This project intentionally uses **split licensing by product surface**, not one license for everything.
