---
name: pr-fix
description: >-
  Fix code locally from active Azure DevOps PR reviewer comments only. Use when
  the user says /pr-fix or wants to apply PR feedback without posting.
disable-model-invocation: true
---
# /pr-fix — Apply reviewer feedback (local)

Fix **only** what active PR reviewers asked. No posting.

## Input

```
/pr-fix Pull Request 16775: `Namespace` Addition Into All `Exception`, `Provider` & `Trait` Files
```

## Fast path

1. `scripts/pr-setup.sh "<input>"`
2. `pr-{id}.active-comments.md` → checklist in `pr-{id}.comment-fixes.md`
3. Checkout PR branch
4. Edit **only** what comments require (Laravel 4.1)
5. `scripts/remote-diff.sh` — verify vs `origin/<branch>`
6. Report table: comment → fix. No commit/push unless asked.

## Do NOT

Post to ADO, fix unmentioned code, use L5+ APIs.

## After

User commits/pushes, or runs `/pr-annotate` to post "Done" on threads if needed.
