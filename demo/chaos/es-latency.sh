#!/usr/bin/env bash
# Add latency in front of every Elasticsearch call in api, or reset it.
#   demo/chaos/es-latency.sh 2000     # 2 s of latency
#   demo/chaos/es-latency.sh reset
# Goes through the tunnel (127.0.0.1:8080). CHAOS_TOKEN comes from ~/.secrets/chaos-token.
set -euo pipefail
API="${API_URL:-http://127.0.0.1:8085}"
TOKEN=$(cat "${CHAOS_TOKEN_FILE:-$HOME/.secrets/chaos-token}")
case "${1:-}" in
  reset) curl -sf -X POST -H "X-Chaos-Token: $TOKEN" "$API/chaos/reset"; echo ;;
  ''|*[!0-9]*) echo "usage: $0 <ms>|reset" >&2; exit 2 ;;
  *) curl -sf -X POST -H "X-Chaos-Token: $TOKEN" "$API/chaos/es-latency?ms=$1"; echo ;;
esac
