#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/../../.."
if [[ -z "${GH_TOKEN:-}" ]]; then
  printf '\033[31m%s\033[0m\n' "GH_TOKEN is required." >&2
  printf '\033[35m%s\033[0m\n' "Set GH_TOKEN to a GitHub token with repository Contents write access." >&2
  exit 1
fi

if [[ -z "${1:-}" ]]; then
  printf '\033[31m%s\033[0m\n' "A VSIX file path is required." >&2
  printf '\033[35m%s\033[0m\n' "Usage: bash scripts/release/publish/create-github-release.sh /absolute/path/to/extension.vsix" >&2
  exit 1
fi

vsix=$1
if [[ ! -f "$vsix" ]]; then
  printf '\033[31m%s\033[0m\n' "VSIX file not found: $vsix" >&2
  exit 1
fi

repo=jacobcassidy/vscode-cassidy-dark-theme
version=$(node -p "require('./package.json').version")
tag="v$version"
commit=${BUILD_SOURCEVERSION:-$(git rev-parse HEAD)}
asset=$(basename "$vsix")

notes_file=$(mktemp)
trap 'rm -f "$notes_file"' EXIT
bash scripts/release/publish/get-changelog-notes.sh > "$notes_file"

# Query the repository first so authentication errors fail before release creation.
gh api "repos/$repo" --silent
if gh release view "$tag" --repo "$repo" >/dev/null 2>&1; then
  assets=$(gh release view "$tag" --repo "$repo" --json assets --jq '.assets[].name')
  if grep -Fxq -- "$asset" <<< "$assets"; then
    printf '\033[34m%s\033[0m\n' "Release $tag already contains $asset; skipping."
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
