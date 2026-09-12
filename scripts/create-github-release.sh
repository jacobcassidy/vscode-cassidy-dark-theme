#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."
: "${GH_TOKEN:?Set GH_TOKEN to a GitHub token with repository Contents write access.}"
vsix=${1:?Usage: bash scripts/create-github-release.sh /absolute/path/to/extension.vsix}
if [[ ! -f "$vsix" ]]; then
  echo "VSIX file not found: $vsix" >&2
  exit 1
fi

repo=jacobcassidy/vscode-cassidy-dark-theme
version=$(node -p "require('./package.json').version")
tag="v$version"
commit=${BUILD_SOURCEVERSION:-$(git rev-parse HEAD)}
asset=$(basename "$vsix")

notes_file=$(mktemp)
trap 'rm -f "$notes_file"' EXIT
bash scripts/changelog-notes.sh > "$notes_file"

# Query the repository first so authentication errors fail before release creation.
gh api "repos/$repo" --silent
if gh release view "$tag" --repo "$repo" >/dev/null 2>&1; then
  assets=$(gh release view "$tag" --repo "$repo" --json assets --jq '.assets[].name')
  if grep -Fxq -- "$asset" <<< "$assets"; then
    echo "Release $tag already contains $asset; skipping."
  else
    gh release upload "$tag" "$vsix" --repo "$repo"
  fi
else
  gh release create "$tag" "$vsix" \
    --repo "$repo" \
    --target "$commit" \
    --title "$tag" \
    --notes-file "$notes_file"
fi
