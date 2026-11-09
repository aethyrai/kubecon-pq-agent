#!/usr/bin/env bash
# Laptop side of the Aethyr tunnel (SOP 5.4 steps 5-6, 6.1 step 3).
# Fetches the client cert, learns the gateway DID, registers this laptop as a PQPeer, and opens
#   127.0.0.1:8085 -> api  (gateway :7443)
#   127.0.0.1:8081 -> mcp  (gateway :7444)
#   127.0.0.1:8082 -> identity (gateway :7445)
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

# 2b. Follow the live CryptoPolicy: a CNSA 2.0 gateway (ML-DSA-87 / ML-KEM-1024, FIPS transport) refuses a
#     Level-3 client, so the client derives its level and transport from the same policy the operator renders.
SIG=$(kubectl get cryptopolicy hackathon -o jsonpath='{.spec.signature}' 2>/dev/null || echo ML-DSA-65)
PROFILE=$(kubectl get cryptopolicy hackathon -o jsonpath='{.spec.profile}' 2>/dev/null || echo hackathon)
FIPS=false; [ "$PROFILE" = cnsa2 ] && FIPS=true
echo "policy: signature=$SIG profile=$PROFILE -> client fips_transport=$FIPS"

# 3. Gateway DID from its startup log (first tunnel container)
POD=$(kubectl -n $NS get pods -l app=aethyr-node -o jsonpath='{.items[0].metadata.name}')
GW_DID=$(kubectl -n $NS logs "$POD" -c tunnel-api --tail=-1 | sed 's/\x1b\[[0-9;]*m//g' | grep -oE 'did_presented=[^ ]+' | head -1 | cut -d= -f2)
[ -n "$GW_DID" ] || { echo "gateway DID not found in logs of $POD"; exit 1; }
printf '# gateway\n%s\n' "$GW_DID" > "$DIR/peers.txt"

mkcfg() { # name peerPort localPort
  cat > "$DIR/tunnel-$1.json" <<JSON
{"role":"initiator","listen":"127.0.0.1:$3","peer":"$GW:$2","tenant_did":"$TENANT","allowlist":"$DIR/peers.txt",
 "tls":{"cert":"$DIR/tls/tls.crt","key":"$DIR/tls/tls.key","ca":"$DIR/tls/ca.crt","server_name":"api.kube.aethyr.cloud"},
 "handshake_version":2,"fips_transport":$FIPS,"signature":"$SIG"}
JSON
}
mkcfg api 7443 8085; mkcfg mcp 7444 8081; mkcfg identity 7445 8082

# 4. Learn this laptop's DID at both levels (one dry start each) and register both as PQPeers, so the
#    operator admits them once and a later CryptoPolicy flip needs only a client restart.
did_for() { # level fips   (the presented DID depends on both the level and the transport)
  local tmp="$DIR/tunnel-probe-$1.json"
  sed "s/\"signature\":\"$SIG\"/\"signature\":\"$1\"/; s/\"fips_transport\":$FIPS/\"fips_transport\":$2/" "$DIR/tunnel-api.json" > "$tmp"
  timeout 2 "$BIN" "$tmp" 2>&1 | sed 's/\x1b\[[0-9;]*m//g' | grep -oE 'did_presented=[^ ]+' | head -1 | cut -d= -f2 || true
}
register() { # name level did
  local PUB; PUB=$(printf '%s' "$3" | base64 -w0)  # placeholder until the client exposes its raw ML-DSA key
  kubectl apply -f - <<YAML
apiVersion: aethyr.io/v1alpha1
kind: PQPeer
metadata: { name: $1, namespace: $NS }
spec:
  publicKey: "$(printf '%-44s' "$PUB" | tr ' ' A)"
  algorithm: $2
  did: "$3"
  displayName: presenter-laptop-$2
  optIns: { matchmaking: true, directory: false }
YAML
}
DID65=$(did_for ML-DSA-65 false); DID87=$(did_for ML-DSA-87 true)
[ -n "$DID65" ] && [ -n "$DID87" ] || { echo "could not read the laptop DIDs"; exit 1; }
MY_DID=$DID65; [ "$SIG" = ML-DSA-87 ] && MY_DID=$DID87
register laptop-l3 ML-DSA-65 "$DID65" >/dev/null; register laptop-l5 ML-DSA-87 "$DID87" >/dev/null
echo "laptop DIDs registered: L3 $DID65 / L5 $DID87 (active: $SIG)"
kubectl -n $NS wait pqpeer/laptop-l3 pqpeer/laptop-l5 --for=jsonpath='{.status.admitted}'=true --timeout=60s
# the gateway rolls once when a new DID joins the allowlist; wait for it
sleep 8; kubectl -n $NS rollout status ds/aethyr-node --timeout=120s >/dev/null 2>&1 || true

# 5. Open both tunnels
"$BIN" "$DIR/tunnel-api.json" & A=$!
"$BIN" "$DIR/tunnel-mcp.json" & B=$!
"$BIN" "$DIR/tunnel-identity.json" & C=$!
trap 'kill $A $B $C 2>/dev/null' EXIT
sleep 1; echo "tunnels up: api http://127.0.0.1:8085  mcp http://127.0.0.1:8081/mcp  identity http://127.0.0.1:8082"
curl -s -m 10 -o /dev/null -w 'identity /healthz through tunnel: HTTP %{http_code}\n' http://127.0.0.1:8082/healthz || true
curl -s -m 10 -o /dev/null -w 'api /healthz through tunnel: HTTP %{http_code}\n' http://127.0.0.1:8085/healthz || true
wait
