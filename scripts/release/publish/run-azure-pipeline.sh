#!/usr/bin/env bash
set -euo pipefail

branch=$(git branch --show-current)

if [[ "$branch" != "main" ]]; then
  printf '\033[31m%s\033[0m\n' "Publishing is only allowed from main."
  printf '\033[34m%s\033[0m\n' "Current branch: ${branch:-detached HEAD}"
  printf '\033[33m%s\033[0m\n' "Switch with: git switch main"
  exit 1
fi

az pipelines run \
  --organization 'https://dev.azure.com/jacobcassidy' \
  --project 'Cassidy Dark Theme' \
  --name 'jacobcassidy.vscode-cassidy-dark-theme' \
  --branch main \
  --open
