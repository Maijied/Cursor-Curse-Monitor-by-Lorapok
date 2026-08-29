# Azure DevOps PR — Bus repo

Org: `Shohoz` · Project: `ticket` · Repo: `bus`

## Commands

| Command | Skill | Action |
|---------|-------|--------|
| `/pr-review Pull Request 16739: …` | `pr-review/` | Analyze → cache findings |
| `/pr-fix Pull Request 16775: …` | `pr-fix/` | Fix **reviewer** comments locally |
| `/pr-annotate Pull Request 16775: …` | `pr-annotate/` | Quick review + post line comments |

Legacy aliases (redirect): `/review-pr` → `/pr-review`, `/review-comment` → `/pr-fix`, `/review-comment-on-pr` → `/pr-annotate`

## Auth

```bash
export AZURE_DEVOPS_PAT='...'   # Read: fetch; Read & write: post
```

## Scripts (`pr-review/scripts/`)

| Script | Purpose |
|--------|---------|
| `parse-pr-id.sh` | Parse URL or `Pull Request 16739: Title` |
| `fetch-pr.sh` | Meta, changes, threads → `.cursor/review-cache/` |
| `post-comment.sh` | Post file thread (needs PAT) |
| `pr-file-url.sh` | Single-file PR URL for browser annotate |
| `remote-diff.sh` | Local vs `origin/<branch>` — skip fixed lines |
| `pr-setup.sh` | Fetch + checkout PR branch |
| `post-batch.sh` | Post all lines from `comments-to-post.md` |
| `build-index.sh` | Regenerate `.cursor/codebase-index.md` |
| `extract-active-comments.py` | Unresolved threads → markdown |

## Cache (`.cursor/review-cache/`)

`pr-{id}.meta.json`, `.review.md`, `.comments-draft.md`, `.comments-to-post.md`, `.active-comments.md`, `.comment-fixes.md`

## Browser annotate

See [browser-annotate.md](browser-annotate.md).
