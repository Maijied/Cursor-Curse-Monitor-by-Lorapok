# AI agent commands

Canonical vocabulary for **any** AI agent (Cursor, Codex, Claude, Copilot, Windsurf, …).

**Init (read first):** [`AGENT_INIT.md`](https://github.com/Maijied/Cursor-Curse-Monitor-by-Lorapok/blob/main/AGENT_INIT.md)

**Rule file:** [`.cursor/rules/ai-agent-commands.mdc`](https://github.com/Maijied/Cursor-Curse-Monitor-by-Lorapok/blob/main/.cursor/rules/ai-agent-commands.mdc)

---

## Commands

| You say | Agent does |
|---------|------------|
| **Update?** | Snapshot only — refresh master tasks + CI; **no coding** |
| **next** | Implement top P0/P1 open task from registry + GitHub issue |
| **sync issues** / **sync tasks** | `npm run sync:issues` (labels + tasks + project board) |
| **autopilot** | Triage PR checks + review threads until merge-ready |

---

## Onboarding files

1. [`AGENT_INIT.md`](https://github.com/Maijied/Cursor-Curse-Monitor-by-Lorapok/blob/main/AGENT_INIT.md) — **all AI tools, read first**
2. [`MISSION-CONTROL-WALKTHROUGH.md`](https://github.com/Maijied/Cursor-Curse-Monitor-by-Lorapok/blob/main/MISSION-CONTROL-WALKTHROUGH.md)
3. [`TASK-TRACKING.md`](https://github.com/Maijied/Cursor-Curse-Monitor-by-Lorapok/blob/main/TASK-TRACKING.md)
4. [`plan/mission-control-master-tasks.md`](https://github.com/Maijied/Cursor-Curse-Monitor-by-Lorapok/blob/main/plan/mission-control-master-tasks.md)

---

## Data hygiene

- Never commit or paste secrets
- Use cred vault for tokens
- Confirm before destructive actions (`confirmAction` shared helper)
- Procedure files track progress — not full chat transcripts

See [Ecosystem Roadmap](Ecosystem-Roadmap) for floating AI and notification plans.
