#!/usr/bin/env bash
# Post line comments from pr-{id}.comments-to-post.md via ADO API.
# Usage: post-batch.sh <pr_id_or_input> [draft_file]
# Format:
#   ### app/path/File.php:L18
#   Comment text (until next ###)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(git rev-parse --show-toplevel)"
PR_ID="$("$SCRIPT_DIR/parse-pr-id.sh" "${1:?PR id required}")"
DRAFT="${2:-$ROOT/.cursor/review-cache/pr-${PR_ID}.comments-to-post.md}"

if [[ ! -f "$DRAFT" ]]; then
  echo "No draft: $DRAFT" >&2
  exit 1
fi

if [[ -z "${AZURE_DEVOPS_PAT:-}" ]]; then
  echo "Set AZURE_DEVOPS_PAT for batch post" >&2
  exit 1
fi

[[ -f "$ROOT/.cursor/review-cache/pr-${PR_ID}.meta.json" ]] || "$SCRIPT_DIR/fetch-pr.sh" "$PR_ID"

export PR_ID DRAFT SCRIPT_DIR
python3 <<'PY'
import os, re, subprocess

pr_id = os.environ["PR_ID"]
draft_path = os.environ["DRAFT"]
script_dir = os.environ["SCRIPT_DIR"]
post = os.path.join(script_dir, "post-comment.sh")

draft = open(draft_path).read()
blocks = re.split(r"\n(?=### )", draft.strip())
count = 0
for block in blocks:
    m = re.match(r"###\s+(.+?):L(\d+)\s*\n(.*)", block, re.S)
    if not m:
        continue
    path, line, body = m.group(1).strip(), m.group(2), m.group(3).strip()
    print(f"Posting {path}:{line}")
    subprocess.run([post, pr_id, path, line, body], check=True)
    count += 1

print(f"Done — {count} comment(s) on PR {pr_id}")
PY
