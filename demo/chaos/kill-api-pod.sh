#!/usr/bin/env bash
# Delete one api pod in conf with a ServiceAccount that can do nothing else (SOP 6.4 step 2).
# Reset: none needed; the Rollout replaces the pod. Watch Radar open the incident.
set -euo pipefail
NS=conf
SA=chaos-pod-killer
TOKEN=$(kubectl -n $NS create token $SA --duration=10m)
SERVER=$(kubectl config view --minify -o jsonpath='{.clusters[0].cluster.server}')
POD=$(kubectl -n $NS get pods -l app=api -o jsonpath='{.items[0].metadata.name}')
echo "deleting $POD as $SA"
kubectl --server="$SERVER" --token="$TOKEN" --insecure-skip-tls-verify=false --certificate-authority=<(kubectl config view --minify --raw -o jsonpath='{.clusters[0].cluster.certificate-authority-data}' | base64 -d) \
  -n $NS delete pod "$POD" --wait=false
kubectl -n $NS get pods -l app=api
