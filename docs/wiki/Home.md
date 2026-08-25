# Cursor Curse Monitor Wiki

Welcome to the **Cursor Curse Monitor (CCM)** knowledge base — a Lorapok Labs product for live Cursor IDE usage tracking, included quota, local insights, billing cycles, free-fallback model switching, and local credential scanning.

## Quick links

| Topic | Page |
|-------|------|
| Install the extension | [Installation](Installation) |
| Mission Control admin | [Admin Panel](Admin-Panel) |
| Release & rollback | [Deployment](Deployment) |
| Email & mailbox | [Mailbox and Email](Mailbox-and-Email) |
| Architecture | [Architecture](Architecture) |
| Support | [Support](Support) |

## Product surfaces

| Surface | URL |
|---------|-----|
| Marketing website | https://maijied.github.io/Cursor-Curse-Monitor-by-Lorapok/ |
| Mission Control (admin) | https://cursor-dev.lorapok.tech |
| GitHub repository | https://github.com/Maijied/Cursor-Curse-Monitor-by-Lorapok |
| Open VSX | https://open-vsx.org/extension/lorapok-labs/cursor-curse-monitor-by-lorapok |
| VS Code Marketplace | https://marketplace.visualstudio.com/items?itemName=LorapokLabs.cursor-curse-monitor-by-lorapok |
| Firefox Add-ons (browser) | https://addons.mozilla.org/en-US/firefox/addon/cursor-curse-monitor/ |
| Chrome zip (browser, direct) | https://github.com/Maijied/Cursor-Curse-Monitor-by-Lorapok/releases/latest |

## Current stable release

- **Version:** v1.0.1
- **Publisher:** Lorapok Labs (`LorapokLabs`)
- **Product email:** cursor.monitor@lorapok.tech
- **Help email:** cursor.curse.help@lorapok.tech

## Lorapok Labs

CCM is developed and operated by [Lorapok Labs](https://lorapok.tech). Mission Control provides marketplace sync, deployment dispatch, development notices, analytics, mailbox, and system logs.

## Agent skills (global)

Lorapok agent skills are installed globally on developer machines:

| Skill | Purpose |
|-------|---------|
| `loragent-amo-publish` | Firefox AMO signing and CI pipeline |
| `loragent-dynamic-versioning` | Root-base version sync at build time |
| `loragent-cloudflare-mail-master` | Branded outbound mail templates |
| `secure-cred-vault` | Credential vault → GitHub secrets sync |

Re-sync: `~/.local/bin/sync-global-agent-stack`
