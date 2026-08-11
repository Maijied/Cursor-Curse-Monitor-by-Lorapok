#!/usr/bin/env bash
set -euo pipefail

echo "==> Cursor Curse Monitor — CI/CD push helper"
echo
echo "GitHub requires the 'workflow' scope to push .github/workflows files."
echo "Run this once, then complete browser login:"
echo
echo "  gh auth refresh -h github.com -s workflow"
echo
read -r -p "Press Enter after auth refresh completes..."

cd "$(dirname "$0")/.."
git push origin main

echo
echo "Done. Next steps:"
echo "  1. Add secret OVSX_PAT in GitHub repo Settings → Secrets"
echo "  2. ./scripts/release.sh          # tags current package.json version and deploys"
echo "  3. See DEPLOYMENT.md"
