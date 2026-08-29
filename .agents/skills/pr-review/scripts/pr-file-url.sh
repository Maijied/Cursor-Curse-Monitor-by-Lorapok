#!/usr/bin/env bash
# Print ADO PR single-file URL for line comments (not side-by-side diff).
# Usage: pr-file-url.sh <pr_id> /app/path/File.php
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PR_ID="$("$SCRIPT_DIR/parse-pr-id.sh" "${1:?PR id required}")"
PATH_ARG="${2:?file path required}"
PATH_ARG="/${PATH_ARG#/}"
echo "https://dev.azure.com/Shohoz/ticket/_git/bus/pullrequest/${PR_ID}?_a=files&path=${PATH_ARG}"
