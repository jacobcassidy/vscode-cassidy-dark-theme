#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."
version=$(node -p "require('./package.json').version")
notes=$(awk -v version="$version" '
  /^## / {
    if (found) exit
    if ($2 == "[" version "]") found = 1
    next
  }
  found { print }
' CHANGELOG.md)

if [[ -z "${notes//[[:space:]]/}" ]]; then
  echo "CHANGELOG.md must contain nonempty notes under ## [$version]." >&2
  exit 1
fi
printf '%s\n' "$notes"
