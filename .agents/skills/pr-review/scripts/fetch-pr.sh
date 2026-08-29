#!/usr/bin/env bash
# Fetch Azure DevOps PR metadata, diff, and thread comments.
# Usage: fetch-pr.sh "<pr_id | url | Pull Request 16739: Title>"
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ORG="Shohoz"
PROJECT="ticket"
REPO="bus"
API="https://dev.azure.com/${ORG}/${PROJECT}/_apis"

PR_ID="$("$SCRIPT_DIR/parse-pr-id.sh" "${1:?PR input required}")"

auth_header() {
  if [[ -n "${AZURE_DEVOPS_PAT:-}" ]]; then
    echo "Authorization: Basic $(printf ':%s' "$AZURE_DEVOPS_PAT" | base64 -w0 2>/dev/null || printf ':%s' "$AZURE_DEVOPS_PAT" | base64)"
  elif command -v az >/dev/null 2>&1; then
    local token
    token="$(az account get-access-token --resource 499b84ac-1321-427f-aa17-267ca6975798 --query accessToken -o tsv 2>/dev/null || true)"
    [[ -n "$token" ]] && echo "Authorization: Bearer $token" && return
    echo "No az token; set AZURE_DEVOPS_PAT" >&2
    exit 1
  else
    echo "Set AZURE_DEVOPS_PAT or install Azure CLI (az login)" >&2
    exit 1
  fi
}

AUTH="$(auth_header)"

pr_json="$(curl -sf -H "$AUTH" \
  "${API}/git/repositories/${REPO}/pullrequests/${PR_ID}?api-version=7.1")"

source_branch="$(echo "$pr_json" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['sourceRefName'].split('/')[-1])")"
target_branch="$(echo "$pr_json" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['targetRefName'].split('/')[-1])")"
title="$(echo "$pr_json" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('title',''))")"
status="$(echo "$pr_json" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('status',''))")"
created_by="$(echo "$pr_json" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('createdBy',{}).get('displayName',''))")"

iterations_json="$(curl -sf -H "$AUTH" \
  "${API}/git/repositories/${REPO}/pullRequests/${PR_ID}/iterations?api-version=7.1")"
iteration_id="$(echo "$iterations_json" | python3 -c "import sys,json; d=json.load(sys.stdin); print(max(i['id'] for i in d['value']))")"

changes_json="$(curl -sf -H "$AUTH" \
  "${API}/git/repositories/${REPO}/pullRequests/${PR_ID}/iterations/${iteration_id}/changes?api-version=7.1&\$top=500")"

threads_json="$(curl -sf -H "$AUTH" \
  "${API}/git/repositories/${REPO}/pullRequests/${PR_ID}/threads?api-version=7.1")"

CACHE_DIR="$(git rev-parse --show-toplevel 2>/dev/null)/.cursor/review-cache"
mkdir -p "$CACHE_DIR"
OUT="$CACHE_DIR/pr-${PR_ID}.meta.json"

python3 - "$OUT" "$PR_ID" "$source_branch" "$target_branch" "$title" "$status" "$created_by" <<'PY'
import json, sys
out, pr_id, src, tgt, title, status, author = sys.argv[1:8]
meta = {
    "pr_id": int(pr_id),
    "url": f"https://dev.azure.com/Shohoz/ticket/_git/bus/pullrequest/{pr_id}",
    "title": title,
    "status": status,
    "created_by": author,
    "source_branch": src,
    "target_branch": tgt,
}
with open(out, "w") as f:
    json.dump(meta, f, indent=2)
print(json.dumps(meta, indent=2))
PY

echo "$changes_json" > "$CACHE_DIR/pr-${PR_ID}.changes.json"
echo "$threads_json" > "$CACHE_DIR/pr-${PR_ID}.threads.json"

# Active reviewer comments (for /pr-fix)
python3 "$SCRIPT_DIR/extract-active-comments.py" "$CACHE_DIR/pr-${PR_ID}.threads.json" \
  > "$CACHE_DIR/pr-${PR_ID}.active-comments.md" 2>/dev/null || true

echo "---"
echo "Cached: $CACHE_DIR/pr-${PR_ID}.*"
echo "Source branch: $source_branch (target: $target_branch)"
echo "Checkout: git fetch origin $source_branch && git checkout $source_branch"
