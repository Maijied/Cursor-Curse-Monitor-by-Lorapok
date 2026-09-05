# Agent init — all AI tools (Cursor, Codex, Claude, Copilot, Windsurf, …)

**Read this file first** on any new session before coding. Tool-specific rules (e.g. `.cursor/rules/`) extend this; they do not replace it.

---

## 1. Commands (exact intents)

| You say | Agent does |
|---------|------------|
| **Update?** | Status snapshot only — refresh `plan/mission-control-master-tasks.md`, narrow CI; **no features** |
| **next** | Top priority open task → GitHub issue → `procedure-init` if multi-file → implement → test |
| **sync issues** / **sync tasks** | `npm run sync:issues` (labels + tasks + project board) |
| **procedure** | `node scripts/procedure-init.mjs --title "…"` |
| **autopilot** | Merge-ready PR triage (checks + review threads) |

Direct main push (hotfix): `npm run push:main -- --title "…" --component website --deploy-website`

---

## 2. Procedure (non-trivial work)

1. `node scripts/procedure-init.mjs --title "<short title>" [--plan plan/foo.md] [--component admin|extension|browser|website]`
2. Update **Progress** in `procedure/{id}_{slug}.md` at milestones
3. Link GitHub issue; use Project [#4](https://github.com/users/Maijied/projects/4) when configured
4. On merge: `node scripts/procedure-finalize-pr.mjs --pr <N>` (or CI auto)

Details: [`procedure/README.md`](procedure/README.md) · rule: [`.cursor/rules/procedure-github-project.mdc`](.cursor/rules/procedure-github-project.mdc)

---

## 3. Read order (onboarding)

| Order | File |
|-------|------|
| 1 | This file (`AGENT_INIT.md`) |
| 2 | [`AGENTS.md`](AGENTS.md) — build, test, deploy per component |
| 3 | [`MISSION-CONTROL-WALKTHROUGH.md`](MISSION-CONTROL-WALKTHROUGH.md) — admin / ops |
| 4 | [`plan/mission-control-master-tasks.md`](plan/mission-control-master-tasks.md) — task queue |
| 5 | [`TASK-TRACKING.md`](TASK-TRACKING.md) — GitHub Issues + Project |

Wiki mirror: [`docs/wiki/AI-Agent-Commands.md`](docs/wiki/AI-Agent-Commands.md)

---

## 4. Safety

- **Secrets:** cred vault only — [`cred-vault`](.cursor/rules/cred-vault.mdc)
- **No secrets** in chat, procedure files, or commits
- **Destructive ops:** use `confirmAction` / ask user before deploy, delete, mass issue close
- **CodeRabbit:** hints only — [`.cursor/rules/coderabbit-review.mdc`](.cursor/rules/coderabbit-review.mdc)

---

## 5. Components

| Path | What |
|------|------|
| `/` | IDE extension (VS Code / Cursor) |
| `browser-extension/` | Firefox + Chrome MV3 |
| `website/` | Marketing site (GitHub Pages) |
| `website/admin/` | Mission Control (Cloudflare Pages) |

---

*Lorapok Labs — Cursor Curse Monitor. Keep this file in sync when agent workflow changes.*
