# Contributing

Thank you for your interest in **Cursor Curse Monitor by Lorapok**.

## Getting started

```bash
git clone https://github.com/Maijied/Cursor-Curse-Monitor-by-Lorapok.git
cd Cursor-Curse-Monitor-by-Lorapok
npm install
npm run compile
```

Press **F5** in Cursor to launch the Extension Development Host.

## Pull requests

1. Fork the repository
2. Create a feature branch: `git checkout -b feat/your-feature`
3. Make focused changes with clear commit messages
4. Run `npm run compile` before submitting
5. Open a PR against `main` with a description of what changed and why
6. Review the [Code of Conduct](CODE_OF_CONDUCT.md) and this guide before opening the PR

Merged contributors are credited in [README.md](README.md#contributors) and [AUTHORS.md](AUTHORS.md).

## Secrets and integrations

Never commit credentials. Operational secrets live in the encrypted cred vault and are synced to GitHub / Cloudflare with the repo scripts:

| Script | Purpose |
|--------|---------|
| `npm run amo:secrets` | Firefox AMO JWT → GitHub |
| `npm run discord:secrets` | Discord webhook + `DEPLOY_NOTIFY_SECRET` (vault `565087`) → GitHub, Pages, KV |

Requires `CRED_PASSPHRASE` and the `cred` CLI or GPG vault file on your machine.

## Reporting issues

Use [GitHub Issues](https://github.com/Maijied/Cursor-Curse-Monitor-by-Lorapok/issues) and include:

- Cursor version (`Help → About`)
- Extension version
- OS and platform
- Steps to reproduce
- Expected vs actual behavior

## Code style

- TypeScript strict mode
- Match existing naming and file structure
- Keep changes minimal and scoped

## Contact

**Mohammad Maizied Hasan Majumder** — [mdshuvo40@gmail.com](mailto:mdshuvo40@gmail.com)

[Lorapok Labs](https://lorapok.tech)
