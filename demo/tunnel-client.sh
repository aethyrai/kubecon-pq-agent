#!/usr/bin/env bash
# Laptop side of the Aethyr tunnel (SOP 5.4 steps 5-6, 6.1 step 3).
# Fetches the client cert, learns the gateway DID, registers this laptop as a PQPeer, and opens
#   127.0.0.1:8080 -> api  (gateway :7443)
#   127.0.0.1:8081 -> mcp  (gateway :7444)
# Usage: demo/tunnel-client.sh [gateway-ip]      Stop with Ctrl-C.
set -euo pipefail
GW="${1:-34.22.42.147}"
NS=aethyr-system
DIR="${AETHYR_CLIENT_DIR:-$HOME/.aethyr/kubecon}"
TENANT="did:aethyr:org:kubecon-pq-agent"
BIN="${AETHYR_TUNNEL_BIN:-$(command -v aethyr-tunnel)}"
mkdir -p "$DIR/tls"; chmod 700 "$DIR"

# 1. Client cert + CA from the bootstrap Secret
for k in tls.crt tls.key ca.crt; do
  kubectl -n $NS get secret aethyr-client-tls -o "jsonpath={.data.tls\.crt}" >/dev/null
  kubectl -n $NS get secret aethyr-client-tls -o "jsonpath={.data['$(echo $k | sed 's/\./\\./g')']}" | base64 -d > "$DIR/tls/$k"
done
chmod 600 "$DIR/tls/tls.key"

# 2. Stable laptop identity seed
[ -s "$DIR/seed" ] || openssl rand -hex 32 > "$DIR/seed"; chmod 600 "$DIR/seed"
export AWP_NODE_SEED; AWP_NODE_SEED=$(cat "$DIR/seed")

# 3. Gateway DID from its startup log (first tunnel container)
POD=$(kubectl -n $NS get pods -l app=aethyr-node -o jsonpath='{.items[0].metadata.name}')
GW_DID=$(kubectl -n $NS logs "$POD" -c tunnel-api | sed 's/\x1b\[[0-9;]*m//g' | grep -oE 'did_presented=[^ ]+' | head -1 | cut -d= -f2)
[ -n "$GW_DID" ] || { echo "gateway DID not found in logs of $POD"; exit 1; }
printf '# gateway\n%s\n' "$GW_DID" > "$DIR/peers.txt"

mkcfg() { # name peerPort localPort
  cat > "$DIR/tunnel-$1.json" <<JSON
{"role":"initiator","listen":"127.0.0.1:$3","peer":"$GW:$2","tenant_did":"$TENANT","allowlist":"$DIR/peers.txt",
 "tls":{"cert":"$DIR/tls/tls.crt","key":"$DIR/tls/tls.key","ca":"$DIR/tls/ca.crt","server_name":"api.kube.aethyr.cloud"},
 "handshake_version":2,"fips_transport":false}
JSON
}
mkcfg api 7443 8080; mkcfg mcp 7444 8081

# 4. Learn this laptop's DID (one dry start) and register it as a PQPeer the operator admits
MY_DID=$(timeout 2 "$BIN" "$DIR/tunnel-api.json" 2>&1 | sed 's/\x1b\[[0-9;]*m//g' | grep -oE 'did_presented=[^ ]+' | head -1 | cut -d= -f2 || true)
[ -n "$MY_DID" ] || { echo "could not read the laptop DID"; exit 1; }
PUB=$(printf '%s' "$MY_DID" | base64 -w0)  # placeholder until the client exposes its raw ML-DSA key
kubectl apply -f - <<YAML
apiVersion: aethyr.io/v1alpha1
kind: PQPeer
metadata: { name: laptop, namespace: $NS }
spec:
  publicKey: "$(printf '%-44s' "$PUB" | tr ' ' A)"
  algorithm: ML-DSA-65
  did: "$MY_DID"
  displayName: presenter-laptop
  optIns: { matchmaking: true, directory: false }
YAML
echo "laptop DID $MY_DID registered; waiting for admission and gateway reload"
kubectl -n $NS wait pqpeer/laptop --for=jsonpath='{.status.admitted}'=true --timeout=60s
sleep 5

# 5. Open both tunnels
"$BIN" "$DIR/tunnel-api.json" & A=$!
"$BIN" "$DIR/tunnel-mcp.json" & B=$!
trap 'kill $A $B 2>/dev/null' EXIT
sleep 1; echo "tunnels up: api http://127.0.0.1:8080  mcp http://127.0.0.1:8081/mcp"
curl -s -m 10 -o /dev/null -w 'api /healthz through tunnel: HTTP %{http_code}\n' http://127.0.0.1:8080/healthz || true
wait
