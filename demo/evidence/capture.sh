#!/usr/bin/env bash
# Record one piece of evidence: a named text file with a timestamp, the command, its output, and
# optional cluster log lines. Screenshots go beside these with the same base name.
#   demo/evidence/capture.sh <name> -- <command...>
#   demo/evidence/capture.sh tunnel-handshake --logs aethyr-system app=aethyr-node tunnel-identity 'handshake completed' -- curl -s http://127.0.0.1:8082/healthz
set -uo pipefail
NAME="$1"; shift
LOGS=()
if [ "${1:-}" = "--logs" ]; then shift; LOGS=("$1" "$2" "$3" "$4"); shift 4; fi
[ "${1:-}" = "--" ] && shift
DIR="$(cd "$(dirname "$0")" && pwd)"; OUT="$DIR/$NAME.txt"
{
  echo "# $NAME"
  echo "recorded: $(date -Iseconds)  host: $(hostname)  commit: $(git -C "$DIR" rev-parse --short HEAD 2>/dev/null)"
  # The deployed images are what a judge should match against, not the local branch.
  for d in "conf deploy/web" "conf rollout/api" "conf rollout/mcp-server" "aethyr-system deploy/identity" "aethyr-system deploy/aethyr-operator"; do
    set -- $d; img=$(kubectl -n "$1" get "$2" -o jsonpath='{.spec.template.spec.containers[0].image}' 2>/dev/null || true)
    [ -n "$img" ] && echo "deployed: ${2#*/} ${img##*/}"
  done
  echo
  echo '```'
  echo "\$ $*"
  "$@" 2>&1 | sed 's/\x1b\[[0-9;]*m//g' | head -80
  echo "exit: ${PIPESTATUS[0]}"
  echo '```'
  if [ ${#LOGS[@]} -eq 4 ]; then
    echo; echo "## cluster log: ns=${LOGS[0]} selector=${LOGS[1]} container=${LOGS[2]} match='${LOGS[3]}'"; echo '```'
    POD=$(kubectl -n "${LOGS[0]}" get pods -l "${LOGS[1]}" -o jsonpath='{.items[0].metadata.name}')
    kubectl -n "${LOGS[0]}" logs "$POD" -c "${LOGS[2]}" --since=10m 2>/dev/null | sed 's/\x1b\[[0-9;]*m//g' | grep -E "${LOGS[3]}" | tail -5
    echo '```'
  fi
} > "$OUT"
echo "wrote $OUT"; sed -n '1,12p' "$OUT"
