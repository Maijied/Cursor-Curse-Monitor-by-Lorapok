#!/usr/bin/env bash
# Parse PR id from Azure DevOps URL, bare id, or "Pull Request 16739: Title" format.
# Usage: parse-pr-id.sh "<input>"
set -euo pipefail
arg="${1:?PR input required}"

if [[ "$arg" =~ pullrequest/([0-9]+) ]]; then
  echo "${BASH_REMATCH[1]}"
elif [[ "$arg" =~ [Pp]ull[[:space:]]+[Rr]equest[[:space:]]+([0-9]+) ]]; then
  echo "${BASH_REMATCH[1]}"
elif [[ "$arg" =~ ^[Pp][Rr][[:space:]]*#?([0-9]+) ]]; then
  echo "${BASH_REMATCH[1]}"
elif [[ "$arg" =~ ^[0-9]+$ ]]; then
  echo "$arg"
else
  echo "Cannot parse PR id from: $arg" >&2
  echo "Expected: URL, 16739, or 'Pull Request 16739: Title'" >&2
  exit 1
fi
