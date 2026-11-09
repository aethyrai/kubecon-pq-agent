#!/usr/bin/env bash
# Validate rendered charts and plain manifests against Kubernetes and CRD schemas.
set -euo pipefail
cd "$(dirname "$0")/.."
KUBE_VERSION="${KUBE_VERSION:-1.31.0}"
args=(-strict -summary -ignore-missing-schemas -kubernetes-version "$KUBE_VERSION"
  -schema-location default
  -schema-location 'https://raw.githubusercontent.com/datreeio/CRDs-catalog/main/{{.Group}}/{{.ResourceKind}}_{{.ResourceAPIVersion}}.json')
found=0
# Plain manifests
while IFS= read -r f; do
  found=1; echo "kubeconform $f"; kubeconform "${args[@]}" "$f"
done < <(find deploy/argocd deploy/crds deploy/platform -name '*.yaml' \
  -not -path '*/templates/*' -not -name 'Chart.yaml' -not -name 'values*.yaml' 2>/dev/null | sort)
# Rendered charts
while IFS= read -r chart; do
  found=1
  dir=$(dirname "$chart"); name=$(basename "$dir")
  vals=()
  [ -f "deploy/env/hack/$name.yaml" ] && vals=(-f "deploy/env/hack/$name.yaml")
  echo "kubeconform (helm template) $dir"
  helm template "$name" "$dir" "${vals[@]}" | kubeconform "${args[@]}" -
done < <(find deploy/charts deploy/platform -name Chart.yaml 2>/dev/null | sort)
if [ "$found" = 0 ]; then echo "kubeconform: no manifests yet"; fi
