#!/usr/bin/env bash
# Lint every Helm chart under deploy/charts and deploy/platform that has a Chart.yaml.
set -euo pipefail
cd "$(dirname "$0")/.."
found=0
while IFS= read -r chart; do
  found=1
  dir=$(dirname "$chart")
  echo "helm lint $dir"
  if [ -f "deploy/env/hack/$(basename "$dir").yaml" ]; then
    helm lint "$dir" -f "deploy/env/hack/$(basename "$dir").yaml"
  else
    helm lint "$dir"
  fi
done < <(find deploy/charts deploy/platform -name Chart.yaml 2>/dev/null | sort)
if [ "$found" = 0 ]; then echo "helm-lint: no charts yet"; fi
