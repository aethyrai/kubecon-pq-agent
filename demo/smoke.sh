#!/usr/bin/env bash
# Integration smoke test through the tunnel. Prints a PASS/FAIL table; exit 1 on any FAIL.
#   demo/smoke.sh            # api at 127.0.0.1:8085, mcp at 127.0.0.1:8081 (demo/tunnel-client.sh)
set -uo pipefail
API="${API_URL:-http://127.0.0.1:8085}"; MCP="${MCP_URL:-http://127.0.0.1:8081/mcp}"
fail=0; row() { printf '| %-34s | %-4s | %s\n' "$1" "$2" "$3"; [ "$2" = PASS ] || fail=1; }
echo "| check | result | detail"; echo "| --- | --- | ---"
j() { curl -s -m 20 "$@"; }
h=$(j -o /dev/null -w '%{http_code}' "$API/healthz"); row "api /healthz" "$([ "$h" = 200 ] && echo PASS || echo FAIL)" "HTTP $h"
r=$(j -o /dev/null -w '%{http_code}' "$API/readyz"); row "api /readyz (Elasticsearch)" "$([ "$r" = 200 ] && echo PASS || echo FAIL)" "HTTP $r"
kw=$(j "$API/search?q=talks%20about%20agents%20that%20fix%20clusters" | python3 -c 'import json,sys;d=json.load(sys.stdin);h=d["hits"];print(len(h), sum(1 for x in h if x.get("legs")==["knn"]))' 2>/dev/null || echo "0 0")
set -- $kw; row "hybrid search returns hits" "$([ "${1:-0}" -gt 0 ] && echo PASS || echo FAIL)" "hits=${1:-0}"; row "semantic-only hits present" "$([ "${2:-0}" -gt 0 ] && echo PASS || echo FAIL)" "knn-only=${2:-0}"
rec=$(j -X POST -H 'content-type: application/json' -d '{"interests":"agent security and supply chain","filters":{"day":"2026-11-10"}}' "$API/recommend?size=3" | python3 -c 'import json,sys;d=json.load(sys.stdin);print(",".join(d["session_ids"]))' 2>/dev/null || true)
row "recommend returns session ids" "$([ -n "$rec" ] && echo PASS || echo FAIL)" "ids=$rec"
if [ -n "$rec" ]; then c=$(j "$API/plan/conflicts?ids=$rec" | python3 -c 'import json,sys;d=json.load(sys.stdin);print(len(d["conflicts"]), len(d["missing"]))' 2>/dev/null || echo "x x"); set -- $c; row "conflicts computed" "$([ "${2:-x}" = 0 ] && echo PASS || echo FAIL)" "conflicts=${1:-?} missing=${2:-?}"; fi
b=$(j "$API/booths?q=observability" | python3 -c 'import json,sys;d=json.load(sys.stdin);e=d["exhibitors"];print(len(e), (e[0]["booth"] if e else ""))' 2>/dev/null || echo "0"); set -- $b; row "booths search" "$([ "${1:-0}" -gt 0 ] && echo PASS || echo FAIL)" "n=${1:-0} first booth=${2:-}"
m=$(j -X POST "$MCP" -H 'content-type: application/json' -H 'accept: application/json' -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"smoke","version":"0"}}}' | grep -c kubecon-pq-agent || true)
row "mcp initialize through tunnel" "$([ "${m:-0}" -gt 0 ] && echo PASS || echo FAIL)" "server info seen=$m"
exit $fail
