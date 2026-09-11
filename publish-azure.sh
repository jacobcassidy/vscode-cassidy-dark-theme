#!/usr/bin/env bash
set -euo pipefail

branch=$(git branch --show-current)

if [[ "$branch" != "main" ]]; then
  echo "Publishing is only allowed from main."
  echo "Current branch: ${branch:-detached HEAD}"
  echo "Switch with: git switch main"
  exit 1
fi

az pipelines run \
  --organization 'https://dev.azure.com/jacobcassidy' \
  --project 'Cassidy Dark Theme' \
  --name 'jacobcassidy.vscode-cassidy-dark-theme' \
  --branch main \
  --open
