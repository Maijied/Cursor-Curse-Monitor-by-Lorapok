---
name: fork
description: >-
  Carry forward the current conversation brain and start a new chat. Use when
  the user invokes /fork, asks to fork the conversation, hand off context to a
  new chat, or reset context while preserving decisions, state, and next steps.
disable-model-invocation: true
---

# /fork

carry forward the current converstion brain and start a new chat

## When to run

Invoke this skill when the user types `/fork` or asks to fork, hand off, or continue in a fresh chat without losing context.

**Do not** keep implementing the original task in this turn. Your only job is to produce a clean handoff and tell the user how to start the new chat.

## Workflow

1. **Freeze** — Stop any in-flight implementation. Do not open new files or run mutating commands unless needed to verify facts for the handoff.

2. **Extract brain** — From the full conversation (and recent tool results), capture:
   - **North star** — What the user is ultimately trying to accomplish
   - **Done** — Completed work, merged decisions, files already changed
   - **In progress** — What was mid-flight when fork was requested
   - **Blocked** — Errors, missing deps, approvals, failed commands (with exact messages)
   - **Decisions** — Choices made and *why* (especially rejected alternatives)
   - **Constraints** — User rules, isolation requirements, "do not touch X"
   - **Key paths** — Repo root, critical files, branches, plan files, artifact paths
   - **Commands** — Exact commands that worked or failed (copy-paste ready)
   - **Next 3 steps** — Ordered, actionable, smallest useful units

3. **Write handoff** — Emit one **Fork Packet** (see template). Prefer facts over narrative. Omit filler.

4. **Optional file** — If a workspace is open, also write the packet to:
   ```
   .cursor/forks/<YYYY-MM-DD>-<short-slug>.md
   ```
   Create `.cursor/forks/` if missing. Slug = 2–4 words from the task (kebab-case).

5. **Start new chat** — End with short user instructions:
   - Open a **new chat** in this project (same workspace)
   - Paste the Fork Packet as the **first message**
   - Add one line: `Continue from this fork. Treat the packet as ground truth.`

Do **not** claim you can open the new chat yourself. The user starts it.

## Fork Packet template

Use this structure every time. Fill every section; write `None` if empty.

```markdown
# Fork — [one-line task title]

## North star
[Single sentence: what success looks like]

## Workspace
- **Repo:** [absolute or relative path]
- **Branch:** [name or "unknown"]
- **Plan file:** [path if any, else None]

## Done
- [Bullet list of completed work with file paths where relevant]

## In progress
- [What was actively being worked on at fork time]

## Blocked / risks
- [Errors, audit failures, missing tools, unresolved decisions]

## Decisions (do not relitigate)
- [Decision] — [reason]

## Constraints
- [User rules, isolation, scope limits]

## Key files
| Path | Role |
|------|------|
| ... | ... |

## Commands reference
```bash
# commands that worked or should be retried
```

## Next steps
1. [First step]
2. [Second step]
3. [Third step]

## Fork meta
- **Forked at:** [date/time if known]
- **Prior chat topic:** [≤6 words]
```

## Quality bar

- **Dense, not long** — Aim for scannable bullets; skip tool-call play-by-play.
- **Actionable** — Next steps must be executable without re-reading the old chat.
- **Honest** — Mark uncertainty (`unverified`, `build failed at audit`) explicitly.
- **No secrets** — Never copy tokens, passwords, or API keys into the packet.

## Anti-patterns

- Do not summarize only the last message; mine the full thread.
- Do not fork into the same chat and pretend it is new.
- Do not drop blockers (a fork that hides a failed build causes duplicate work).
- Do not paraphrase the user's `/fork` purpose line above.

## Example closing (to user)

> **New chat:** Press `Cmd+L` / open a new Agent chat in this workspace, paste the Fork Packet above, and send:
>
> `Continue from this fork. Treat the packet as ground truth.`
>
> Saved copy: `.cursor/forks/2026-08-26-dcursor-build.md` (if written)
