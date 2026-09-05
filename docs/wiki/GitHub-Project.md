# GitHub Project & Issues

Public planning board for Mission Control and ecosystem work.

---

## Links

| Resource | URL |
|----------|-----|
| **Project #4** | https://github.com/users/Maijied/projects/4 |
| **Open backlog epic** | https://github.com/Maijied/Cursor-Curse-Monitor-by-Lorapok/issues/126 |
| **Issue registry JSON** | `procedure/mission-control-issues.json` |
| **Process guide (repo)** | [`TASK-TRACKING.md`](https://github.com/Maijied/Cursor-Curse-Monitor-by-Lorapok/blob/main/TASK-TRACKING.md) |

---

## Hierarchy

```
Epic #126 Mission Control open backlog
├── Section epics (Auth, Mail, Infra, …)
│   └── Task issues [AUTH-13], [MAIL-13], …
└── Ecosystem epics (ECO-*) — tray, browsers, Cursor plugin, AI, notifications
```

---

## Labels

| Label | Purpose |
|-------|---------|
| `type:epic` / `type:task` | Hierarchy |
| `area:*` | Component (auth, mail, infra, extension, …) |
| `priority:p0` / `p1` / `p2` | Queue priority |
| `mission-control` | Synced from master registry |

---

## Milestones

| Milestone | Theme |
|-----------|--------|
| MC — Auth & ACL | Firebase, RBAC, ACL audit |
| MC — Mail & Subscribers | Resend, templates, digests |
| MC — Infrastructure | Cloudflare, deploy-infra |
| MC — Discord | Webhooks, embed cards |
| MC — Extensions | IDE + browser |
| MC — Website | Marketing site |
| MC — Observability | Stats, logs, analytics hub |
| MC — Operations | GitHub, Azure/GCP cards |
| MC — Ecosystem | Tray, all browsers, Cursor plugin, AI, push |

---

## Maintainer scripts

```bash
npm run sync:labels
npm run sync:tasks
npm run setup:github-project
```

---

## Community stats

GitHub Insights snapshots live in `procedure/github-community-stats.json` and merge into `site-data.json` on `npm run site:data`. Shown on README, website, and Mission Control Overview.
