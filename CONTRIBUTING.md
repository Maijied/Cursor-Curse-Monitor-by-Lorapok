# Contributing

Thank you for your interest in **Cursor Curse Monitor by Lorapok**.

## Repository layout

This monorepo has three main areas — see the [architecture section in README.md](README.md#architecture) before opening a PR:

- `src/` — VS Code / Cursor extension
- `website/` — static marketing site (GitHub Pages)
- `website/admin/` — Mission Control admin SPA + Cloudflare Pages Functions

## Getting started (extension)

```bash
git clone https://github.com/Maijied/Cursor-Curse-Monitor-by-Lorapok.git
cd Cursor-Curse-Monitor-by-Lorapok
npm install
npm run compile
npm test
```

Press **F5** in Cursor to launch the Extension Development Host.

## Getting started (admin)

```bash
cd website/admin
npm install
npm run dev
```

See [website/admin/README.md](website/admin/README.md).

## License

This repository and product are **proprietary** to Lorapok Labs. By contributing, you agree that Lorapok Labs may use your contribution under the [LICENSE](LICENSE) and that you will not redistribute modified copies without written permission.

## Pull requests

1. Fork the repository
2. Create a focused branch: `git checkout -b feat/your-feature`
3. Run tests for the area you changed (`npm test` at repo root and/or in `website/admin/`)
4. Open a PR against `main` with a clear description of what changed and why

## Reporting issues

Use [**New issue → choose a template**](https://github.com/Maijied/Cursor-Curse-Monitor-by-Lorapok/issues/new/choose):

| Template | Use for |
|----------|---------|
| **Extension bug report** | Cursor / VS Code extension behavior |
| **Website issue** | Marketing site or Mission Control admin panel |
| **Blank issue** | Anything else |
| **Report a security vulnerability** | See [SECURITY.md](.github/SECURITY.md) — do not file public issues for security bugs |

For extension bugs, include Cursor or VS Code version (`Help → About`), extension version, OS, steps to reproduce, and expected vs actual behavior.

## Code style

- TypeScript strict mode in extension and admin
- Match existing naming and file structure
- Keep changes minimal and scoped to the task

## Contact

**Mohammad Maizied Hasan Majumder** — [mdshuvo40@gmail.com](mailto:mdshuvo40@gmail.com)

[Lorapok Labs](https://lorapok.tech)
