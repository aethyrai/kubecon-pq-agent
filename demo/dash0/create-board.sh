#!/usr/bin/env bash
# Create or update the stage dashboard in Dash0. Needs a Dash0 API token that may write dashboards
# in ~/.secrets/dash0-api-token (Dash0: Settings > API tokens; keep it out of the repo and the chat).
set -euo pipefail
HOST="${DASH0_API_HOST:-https://api.us-west-2.aws.dash0.com}"
DATASET="${DASH0_DATASET:-default}"
TOKEN=$(tr -d '\n' < "${DASH0_API_TOKEN_FILE:-$HOME/.secrets/dash0-api-token}")
BODY="$(dirname "$0")/stage-board.json"
# PUT by origin is an upsert, so running this twice updates instead of duplicating.
code=$(curl -sS -o /tmp/dash0-board.json -w '%{http_code}' -X PUT "$HOST/api/dashboards/kubecon-pq-agent-stage?dataset=$DATASET" \
  -H "Authorization: Bearer $TOKEN" -H 'content-type: application/json' --data-binary @"$BODY")
echo "HTTP $code"; head -c 400 /tmp/dash0-board.json; echo
[ "$code" = 200 ] || [ "$code" = 201 ]
