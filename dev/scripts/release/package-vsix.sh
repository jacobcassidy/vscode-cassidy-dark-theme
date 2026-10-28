#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/../../.."

version=$(node -p "require('./package.json').version")
vsix=${1:-"dev/packages/cassidy-dark-$version.vsix"}

mkdir -p "$(dirname "$vsix")"
printf 'Packaging VS Code extension: %s\n' "$vsix" >&2
./node_modules/.bin/vsce package --out "$vsix"
