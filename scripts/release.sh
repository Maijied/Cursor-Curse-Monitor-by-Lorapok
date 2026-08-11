#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

BUMP="${1:-}"
VERSION=""

if [[ "$BUMP" =~ ^(patch|minor|major)$ ]]; then
  echo "==> Bumping $BUMP version"
  npm version "$BUMP" --no-git-tag-version
  VERSION="$(node -p "require('./package.json').version")"
  git add package.json package-lock.json
  git commit -m "Release v$VERSION"
elif [[ -n "$BUMP" ]]; then
  VERSION="${BUMP#v}"
else
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

echo "==> Validating assets"
npm run validate:assets
npm run sync:icons

echo "==> Releasing $TAG"
node scripts/generate-site-data.mjs
git add website/site-data.json 2>/dev/null || true
if git diff --cached --quiet; then
  :
else
  git commit -m "chore: refresh site-data for $TAG"
fi

git tag "$TAG"
git push origin main
git push origin "$TAG"
echo "==> Pushed $TAG"
echo "    Deploy workflow → Open VSX + GitHub Release"
echo "    Pages workflow  → website with live install commands"
