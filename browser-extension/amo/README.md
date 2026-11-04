# AMO listing assets

<div align="center">
  <img src="../../media/logo-animated.svg" alt="Cursor Curse Monitor — animated Lorapok Larvae mascot" width="96" height="96" />
</div>

Place screenshots here for automated Firefox Add-ons submission:

- `screenshot-1280x800.png` — primary listing screenshot
- `screenshot-640x480.png` — small screenshot

## CI pipeline

AMO publishing is orchestrated by `browser-extension/scripts/publish-amo.mjs`:

1. `generate-amo-metadata.mjs` — fills listing fields from `amo-metadata.base.json` + `CHANGELOG.md` (`version.license`: **MPL-2.0**)
2. `validate-amo-metadata.mjs` — schema + MPL license checks
3. `validate-package-licenses.mjs` — ensures `dist/` includes MPL `LICENSE`, `NOTICE.md`, source offer
4. `web-ext sign --amo-metadata …` — signs and submits (requires `AMO_JWT_ISSUER` / `AMO_JWT_SECRET`)
5. `verify-amo-status.mjs` — polls AMO API for approval status

Standalone workflow: `.github/workflows/publish-firefox.yml`

After the popup UI is built, capture from `browser-extension/dist/popup.html` or use `website/assets/marketing/showcase-browser-ext.png`.
