#!/usr/bin/env bash
# Post a file-level PR thread comment to Azure DevOps.
# Usage: post-comment.sh <pr_id> <file_path> <line> "<comment_text>"
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PR_ID="$("$SCRIPT_DIR/parse-pr-id.sh" "${1:?PR id required}")"
FILE_PATH="${2:?file path required}"
LINE="${3:?line number required}"
COMMENT="${4:?comment text required}"

ORG="Shohoz"
PROJECT="ticket"
REPO="bus"
API="https://dev.azure.com/${ORG}/${PROJECT}/_apis"

if [[ -z "${AZURE_DEVOPS_PAT:-}" ]]; then
  echo "Set AZURE_DEVOPS_PAT (Code Read & write)" >&2
  exit 1
fi

AUTH="Authorization: Basic $(printf ':%s' "$AZURE_DEVOPS_PAT" | base64 -w0 2>/dev/null || printf ':%s' "$AZURE_DEVOPS_PAT" | base64)"

META="$(git rev-parse --show-toplevel)/.cursor/review-cache/pr-${PR_ID}.meta.json"
if [[ ! -f "$META" ]]; then
  echo "Run fetch-pr.sh first" >&2
  exit 1
fi
BRANCH="$(python3 -c "import json; print(json.load(open('$META'))['source_branch'])")"
COMMIT="$(git rev-parse "origin/${BRANCH}" 2>/dev/null || git rev-parse "$BRANCH")"

payload="$(python3 - "$FILE_PATH" "$LINE" "$COMMENT" "$COMMIT" <<'PY'
import json, sys
path, line, comment, commit = sys.argv[1:5]
print(json.dumps({
    "comments": [{
        "parentCommentId": 0,
        "content": comment,
        "commentType": 1
    }],
    "status": 1,
    "threadContext": {
        "filePath": "/" + path.lstrip("/"),
        "rightFileStart": {"line": int(line), "offset": 1},
        "rightFileEnd": {"line": int(line), "offset": 1}
    }
}))
PY
)"

curl -sf -X POST -H "$AUTH" -H "Content-Type: application/json" \
  -d "$payload" \
  "${API}/git/repositories/${REPO}/pullRequests/${PR_ID}/threads?api-version=7.1" \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print('Posted thread', d.get('id','?'))"
