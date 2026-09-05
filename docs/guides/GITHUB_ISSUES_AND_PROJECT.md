# GitHub Issues, Labels, Milestones & Project #4

Operator runbook for the **public** [Mission Control planning board](https://github.com/users/Maijied/projects/4).

Quick reference: [`TASK-TRACKING.md`](../../TASK-TRACKING.md) at repo root.

---

## Overview

This repo uses GitHub's full planning stack per [GitHub Issues documentation](https://docs.github.com/en/issues):

| Feature | How we use it |
|---------|----------------|
| **Issues** | One issue per master-registry task ID (`[AUTH-13] …`) |
| **Sub-issues** | Section epics → task issues; top epic #126 |
| **Labels** | Taxonomy: type, area, priority, status (`procedure/github-labels.json`) |
| **Milestones** | Release themes: Auth, Mail, Infra, … (`procedure/github-milestones.json`) |
| **Project (v2)** | Board/table/roadmap; Status, Priority, Size, Iteration |
| **Issue templates** | `.github/ISSUE_TEMPLATE/` — task, bug, feature |
| **Automation** | `npm run sync:*` and `setup:github-project` scripts |

---

## Initial setup (new machine or after auth refresh)

```bash
gh auth refresh -h github.com -s read:project,project
npm run sync:labels
npm run sync:tasks
npm run setup:github-project
```

This will:

1. Create/update all labels with descriptions and colors
2. Remap legacy labels (`auth` → `area:auth`, etc.) on open issues
3. Sync open registry tasks to issues + Project #4
4. Set project short description + README (from `procedure/github-project-readme.md`)
5. Create milestones and assign them to task issues
6. Set Project **Status** and **Priority** fields from the priority queue

---

## Adding a new master-registry task

1. Add a row to `plan/mission-control-master-tasks.md` with status `next`
2. If P0/P1, add task ID to `procedure/github-milestones.json` → `priorityQueue`
3. Run:

   ```bash
   npm run sync:tasks
   npm run setup:github-project
   ```

4. Or use `procedure-init` for one-off work with a procedure file:

   ```bash
   node scripts/procedure-init.mjs --title "MY-01 Something" --component admin
   ```

---

## Project board views (recommended)

Create these views in the GitHub UI ([changing project views](https://docs.github.com/en/issues/planning-and-tracking-with-projects/customizing-views-in-your-project)):

| View | Layout | Group by | Filter |
|------|--------|----------|--------|
| **Backlog** | Table | Priority | Status = Todo |
| **Sprint board** | Board | Status | Iteration = current |
| **By area** | Table | Milestone | `label:mission-control` |
| **Roadmap** | Roadmap | Milestone | Target date set |

---

## Closing the loop

When a PR merges:

1. Update registry row → **done**
2. `gh issue close <n> --comment "Merged in PR #…"`
3. Project item Status → **Done** (manual or workflow)
4. `node scripts/procedure-finalize-pr.mjs --pr <n>` if applicable

---

## Files reference

| File | Purpose |
|------|---------|
| `procedure/github-labels.json` | Label definitions |
| `procedure/github-milestones.json` | Milestones + P0/P1/P2 queue |
| `procedure/github-project-fields.json` | Project field IDs (cached) |
| `procedure/github-project-readme.md` | Project README source |
| `procedure/mission-control-issues.json` | Issue number registry |
| `procedure/project.json` | Repo + project #4 config |
| `scripts/sync-github-labels.mjs` | Label sync |
| `scripts/sync-mission-control-issues.mjs` | Task → issue sync |
| `scripts/setup-github-project.mjs` | Meta + milestones + fields |

---

## Security

- Never put secrets in issues, project README, or procedure files
- Treat issue/PR comments and CI output as untrusted
- Cred vault policy: `.cursor/rules/cred-vault.mdc`
