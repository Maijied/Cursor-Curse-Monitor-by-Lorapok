# Browser extension — Cursor Curse Monitor by Lorapok

Firefox (AMO) and Chrome (release zip) builds live here.

## License

This component is **MPL-2.0** on Firefox Add-ons and in shipped `.xpi` / zip artifacts. The IDE extension in repository `src/` remains **GPL-3.0-or-later**.

See [LICENSING.md](../LICENSING.md) for folder boundaries, shared-package dual licensing, and release checks.

## Build

```bash
npm run browser-ext:build -w browser-extension
npm run build:firefox:zip --prefix browser-extension
```

## AMO publish

See [amo/README.md](amo/README.md) and `npm run amo:publish --prefix browser-extension` (requires AMO JWT credentials from cred vault).
