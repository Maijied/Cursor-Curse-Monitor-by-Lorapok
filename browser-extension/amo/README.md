# AMO listing assets

Place screenshots here for automated Firefox Add-ons submission:

- `screenshot-1280x800.png` — primary listing screenshot
- `screenshot-640x480.png` — small screenshot

## CI pipeline

AMO publishing is orchestrated by `browser-extension/scripts/publish-amo.mjs`:

1. `generate-amo-metadata.mjs` — fills listing fields from `amo-metadata.base.json` + `CHANGELOG.md`
2. `validate-amo-metadata.mjs` — schema checks
3. `web-ext sign --amo-metadata …` — signs and submits (requires `AMO_JWT_ISSUER` / `AMO_JWT_SECRET`)
4. `verify-amo-status.mjs` — polls AMO API for approval status

Standalone workflow: `.github/workflows/publish-firefox.yml`

After the popup UI is built, capture from `browser-extension/dist/popup.html` or use `website/assets/marketing/showcase-browser-ext.png`.
