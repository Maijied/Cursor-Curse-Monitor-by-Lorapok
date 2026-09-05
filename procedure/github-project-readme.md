# Lorapok Labs — Cursor Curse Monitor

**Public planning board** for [Cursor Curse Monitor by Lorapok](https://github.com/Maijied/Cursor-Curse-Monitor-by-Lorapok).

## Purpose

Track Mission Control admin work, infrastructure, mail, extensions, and website tasks from the canonical registry in-repo (`plan/mission-control-master-tasks.md`).

## How we work

| Artifact | Location |
|----------|----------|
| Master registry | [`plan/mission-control-master-tasks.md`](https://github.com/Maijied/Cursor-Curse-Monitor-by-Lorapok/blob/main/plan/mission-control-master-tasks.md) |
| Process guide | [`TASK-TRACKING.md`](https://github.com/Maijied/Cursor-Curse-Monitor-by-Lorapok/blob/main/TASK-TRACKING.md) |
| Issue ↔ task map | [`procedure/mission-control-issues.json`](https://github.com/Maijied/Cursor-Curse-Monitor-by-Lorapok/blob/main/procedure/mission-control-issues.json) |
| Top epic | [#126 Mission Control open backlog](https://github.com/Maijied/Cursor-Curse-Monitor-by-Lorapok/issues/126) |

## Project fields

| Field | Use |
|-------|-----|
| **Status** | `Todo` → `In progress` → `Done` |
| **Priority** | `P0` (next up) · `P1` (queue) · `P2` (backlog) |
| **Size** | T-shirt estimate (XS–XL) |
| **Milestone** | Release theme (Auth, Mail, Infra, …) |
| **Iteration** | 2-week sprint bucket |
| **Sub-issues progress** | Auto from parent/child links |

## Labels

- `type:epic` / `type:task` — hierarchy
- `area:*` — component (auth, mail, infra, extension, …)
- `priority:p0` / `p1` / `p2` — mirrors Priority field
- `mission-control` — all items synced from master registry

## Commands (maintainers)

```bash
npm run sync:labels          # sync label taxonomy
npm run sync:tasks           # sync open tasks → issues + this board
npm run setup:github-project # description, milestones, field values
```

## Current focus

**P0:** [AUTH-13 ACL audit UI](https://github.com/Maijied/Cursor-Curse-Monitor-by-Lorapok/issues/132)

Say **next** in Cursor to pick up the top queue item.

## Links

- [Mission Control (production)](https://cursor-dev.lorapok.tech)
- [GitHub Issues docs](https://docs.github.com/en/issues)
- [Projects docs](https://docs.github.com/en/issues/planning-and-tracking-with-projects)
