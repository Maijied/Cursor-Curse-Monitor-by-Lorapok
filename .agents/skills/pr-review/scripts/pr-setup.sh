#!/usr/bin/env bash
# Fetch PR metadata and checkout source branch.
# Usage: pr-setup.sh "<pr input>"
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(git rev-parse --show-toplevel)"
INPUT="${1:?PR input required}"

PR_ID="$("$SCRIPT_DIR/parse-pr-id.sh" "$INPUT")"
META="$ROOT/.cursor/review-cache/pr-${PR_ID}.meta.json"

if [[ -n "${AZURE_DEVOPS_PAT:-}" ]] || command -v az >/dev/null 2>&1; then
  "$SCRIPT_DIR/fetch-pr.sh" "$INPUT"
else
  echo "No PAT/az — using git only" >&2
  git fetch origin 2>/dev/null || true
  if [[ ! -f "$META" ]]; then
    echo "Missing $META — set AZURE_DEVOPS_PAT or run /pr-review first" >&2
    exit 1
  fi
fi

BRANCH="$(python3 -c "import json; print(json.load(open('$META'))['source_branch'])")"
git fetch origin "$BRANCH" 2>/dev/null || true
git checkout "$BRANCH" 2>/dev/null || git checkout -b "$BRANCH" "origin/$BRANCH"

echo "PR $PR_ID on branch $BRANCH"
cat "$META"
