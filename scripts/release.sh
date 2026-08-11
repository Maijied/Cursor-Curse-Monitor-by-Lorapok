#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

VERSION="${1:-}"
if [[ -z "$VERSION" ]]; then
  VERSION="$(node -p "require('./package.json').version")"
fi

TAG="v${VERSION#v}"

if git rev-parse "$TAG" >/dev/null 2>&1; then
  echo "Tag $TAG already exists."
  exit 1
fi

if [[ -n "$(git status --porcelain)" ]]; then
  echo "Working tree is not clean. Commit or stash changes first."
  git status -sb
  exit 1
fi

echo "==> Releasing $TAG"
git tag "$TAG"
git push origin main
git push origin "$TAG"
echo "==> Pushed $TAG — Deploy workflow will publish to Open VSX and create a GitHub Release"
