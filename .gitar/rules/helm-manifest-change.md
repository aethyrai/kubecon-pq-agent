---
title: Helm values or manifest change
description: helm lint and kubeconform must pass on any chart, values, or manifest change
type: check
when: PRs that modify files under deploy/
actions: Confirm the helm-lint and kubeconform CI jobs passed; diagnose and propose a fix if they failed
---

When a PR touches `deploy/charts/`, `deploy/platform/`, `deploy/env/`, `deploy/argocd/`, or
`deploy/crds/`:

- The `helm-lint` and `kubeconform` jobs in `.github/workflows/ci.yml` must both pass. If either fails,
  diagnose the failing template or schema line and propose the fix.
- Check the chart conventions: resources on every container, probes, non-root securityContext with
  dropped capabilities, `automountServiceAccountToken: false`, a NetworkPolicy per namespace, and a
  PodDisruptionBudget on `api` and `mcp-server`.
- Check that an image tag bump in `deploy/env/hack/` refers to a tag that the release workflow pushed.
