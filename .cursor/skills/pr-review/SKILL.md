---
name: pr-review
description: >-
  Analyze an Azure DevOps PR for the bus Laravel 4.1 repo. Use when the user says
  /pr-review or "Pull Request 16739: Title". Findings only — no post, no fix.
disable-model-invocation: true
---
# /pr-review — Analyze PR

Review **Shohoz/ticket/bus** PRs (Laravel 4.1). Findings only.

## Input

```
/pr-review Pull Request 16739: Fix client admin company and route access for API clients.
```

URL, `16739`, or `PR 16739` also work. Parse: [parse-pr-input.md](parse-pr-input.md).

## Fast path

1. `.cursor/rules/laravel-41.mdc` + `.cursor/codebase-index.md`
2. `scripts/pr-setup.sh "<input>"` — fetch meta + checkout branch
3. Bugbot + security-review subagents (parallel), `Base Branch` = PR target
4. L4.1 pass: `lists`, constants, validation order, namespace/provider registration
5. Cache: `pr-{id}.review.md`, `pr-{id}.comments-draft.md`

## Report

Table: Severity | File:Line | Finding.

Next steps for user:
- `/pr-fix Pull Request {id}: {title}` — fix **reviewer** comments locally
- `/pr-annotate Pull Request {id}: {title}` — post line comments where remote still needs them

## Do NOT

Post comments, fix code, commit, push, or suggest L5+ APIs.
