# Task tracking — Mission Control & GitHub Project

Canonical task list: [`plan/mission-control-master-tasks.md`](plan/mission-control-master-tasks.md) (symlink at repo root).

**GitHub Project board:** [Lorapok Labs : Team Planning : Cursor Curse Monitor](https://github.com/users/Maijied/projects/4)

---

## Three layers (do not mix roles)

| Layer | Location | Purpose |
|-------|----------|---------|
| **Registry** | `plan/mission-control-master-tasks.md` | What exists, status (`done` / `next` / `partial` / `deferred`), priority queue |
| **Issues** | GitHub Issues + sub-issues | Assignable work items linked to task IDs (`AUTH-13`, `MAIL-13`, …) |
| **Execution log** | `procedure/{id}_{slug}.md` | Progress, decisions, verification during implementation |

**Plans** (`plan/*.md`) are optional design docs *before* coding. **Procedures** are living logs *during and after* work.

---

## Quick commands

### Sync open tasks → GitHub issues + Project #4

Creates missing epics, task issues, and sub-issue links (idempotent):

```bash
# Preview parsed tasks (no GitHub writes)
node scripts/sync-mission-control-issues.mjs --dry-run

# Create issues + add to Project board
node scripts/sync-mission-control-issues.mjs --add-to-project

# Include deferred backlog items too
node scripts/sync-mission-control-issues.mjs --add-to-project --status next,partial,deferred
```

Registry of created issue numbers: `procedure/mission-control-issues.json`

### Start a single task (agent / human)

```bash
node scripts/procedure-init.mjs \
  --title "AUTH-13 ACL audit UI" \
  --plan plan/AUTH-13-acl-audit.md \
  --component admin
```

This creates `procedure/{8hex}_*.md`, a GitHub issue (labels from `procedure/project.json`), and adds it to **Project #4**.

### After merge

CI runs `procedure-finalize-pr.mjs` on merge (or run manually):

```bash
node scripts/procedure-finalize-pr.mjs --pr <number>
```

---

## Issue hierarchy

```
Epic: Mission Control — open backlog          (top parent)
├── Epic: Firebase                            (section)
│   └── [AUTH-13] ACL audit UI                (task)
├── Epic: Mail (Resend + Cloudflare Email)
│   ├── [MAIL-13] Professional mail templates
│   └── [MAIL-14] Dynamic subscriber emails
└── …
```

- **Task issue title format:** `[TASK-ID] Short title` (e.g. `[AUTH-13] ACL audit UI`)
- **Labels:** `task`, `mission-control`, plus area (`auth`, `mail`, `infra`, …)
- **Close issue** when the task row in the master registry is marked **done**

---

## Agent workflow (`Update?` / `next`)

| You say | Agent does |
|---------|------------|
| **Update?** | Refresh master registry status + CI; summarize done / next / blocked |
| **next** | Pick top item from **Recommended next queue** in master registry, open linked GitHub issue, run `procedure-init` if needed, implement |
| **sync issues** | Run `sync-mission-control-issues.mjs --add-to-project` after registry changes |

When completing a task:

1. Mark row **done** in `plan/mission-control-master-tasks.md`
2. Close the GitHub issue (`gh issue close <n>`)
3. Update procedure file **Progress / Verification**
4. Add `CHANGELOG.md` entry if user-visible

---

## Project board setup

Config: [`procedure/project.json`](procedure/project.json)

```json
{
  "projectNumber": 4,
  "projectUrl": "https://github.com/users/Maijied/projects/4"
}
```

**Required `gh` scopes** (one-time):

```bash
gh auth refresh -h github.com -s read:project,project
```

Suggested Project columns (manual in GitHub UI): **Backlog → Ready → In progress → Review → Done**

Map status from issue labels or custom fields as you prefer; the sync script only *adds* items—it does not move columns.

---

## Related docs

- [`.cursor/rules/procedure-github-project.mdc`](.cursor/rules/procedure-github-project.mdc) — agent guardrails
- [`procedure/README.md`](procedure/README.md) — procedure folder lifecycle
- [`MISSION-CONTROL-WALKTHROUGH.md`](MISSION-CONTROL-WALKTHROUGH.md) — agent onboarding
