#!/usr/bin/env bash
# Run an npm script in every workspace that defines it. Succeeds when no workspace exists yet.
set -euo pipefail
cd "$(dirname "$0")/.."
script="$1"
if ! compgen -G "apps/*/package.json" >/dev/null && ! compgen -G "packages/*/package.json" >/dev/null; then
  echo "$script: no workspaces yet"
  exit 0
fi
npm run "$script" --workspaces --if-present
