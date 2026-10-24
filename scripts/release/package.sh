#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/../.."
npm run check:generated

version=$(node -p "require('./package.json').version")
vsix=${1:-"dist/cassidy-dark-$version.vsix"}

mkdir -p "$(dirname "$vsix")"
./node_modules/.bin/vsce package --out "$vsix"
