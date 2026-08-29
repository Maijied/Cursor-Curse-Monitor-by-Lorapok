#!/usr/bin/env bash
# Show diff of local branch vs origin remote (what ADO PR still shows).
# Usage: remote-diff.sh [file...]
set -euo pipefail
BRANCH="$(git branch --show-current)"
REMOTE="origin/${BRANCH}"
git fetch origin "$BRANCH" 2>/dev/null || true
if [[ $# -gt 0 ]]; then
  git diff "$REMOTE" -- "$@"
else
  git diff "$REMOTE" --stat
fi
