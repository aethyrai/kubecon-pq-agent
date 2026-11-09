#!/usr/bin/env bash
# Add latency in front of every Elasticsearch call in api, or reset it.
#   demo/chaos/es-latency.sh 2000     # 2 s of latency
#   demo/chaos/es-latency.sh reset
#   demo/chaos/es-latency.sh status
# Goes through the tunnel (127.0.0.1:8085, override with API_URL). CHAOS_TOKEN comes from ~/.secrets/chaos-token.
#
# The fault lives in each api pod's memory and the Service picks a pod per request, so every
# command is sent ROUNDS times (default 8) to reach all replicas, and status reports the distinct
# answers seen. With two replicas the chance that a pod misses all eight rounds is below 1% (2 × (1/2)^8).
set -euo pipefail
API="${API_URL:-http://127.0.0.1:8085}"
TOKEN=$(tr -d '\n' < "${CHAOS_TOKEN_FILE:-$HOME/.secrets/chaos-token}")
ROUNDS="${ROUNDS:-8}"
call() { # method path
  curl -sf -X "$1" -H "X-Chaos-Token: $TOKEN" "$API$2"
}
repeat() { # method path -> distinct responses
  for _ in $(seq 1 "$ROUNDS"); do call "$1" "$2"; echo; done | sort -u
}
case "${1:-}" in
  reset) repeat POST /chaos/reset ;;
  status) repeat GET /chaos/status ;;
  ''|*[!0-9]*) echo "usage: $0 <ms>|reset|status" >&2; exit 2 ;;
  *) repeat POST "/chaos/es-latency?ms=$1" ;;
esac
# One line per distinct answer. Two different status lines mean the replicas disagree: run again.
