---
title: Review conventions for kubecon-pq-agent
description: How every pull request in this repo is reviewed
type: check
when: Every pull request
actions: Review against the conventions below and request changes when one is broken
---

This repo is a TypeScript monorepo on Node 22 (`apps/*`, `packages/*`) with Helm charts and Argo CD
manifests under `deploy/`. Review every PR against these conventions:

1. Component names are fixed: `api`, `mcp-server`, `web`, `ingest`, `identity`, `aethyr-operator`,
   `aethyr-node`. The same name is used in the folder, the chart, the image, and the Argo Application.
2. No `as` casts in TypeScript. Use type guards or narrowing. Exported functions have explicit return types.
3. Every Kubernetes container sets resources, liveness and readiness probes, a non-root securityContext
   with all capabilities dropped, `readOnlyRootFilesystem: true`, and `automountServiceAccountToken: false`.
4. Elasticsearch is the only datastore. Flag any new database, cache, or queue.
5. Aethyr Node is a pre-existing library consumed as an image and an npm package. Flag any PR that
   vendors its source into this repo.
6. Secrets are SealedSecrets. Flag any plaintext token, key, or password in a manifest, values file,
   or workflow.
7. Tests live next to the code they cover. A new route, tool, or CRD field needs a test with a fixture.
8. Commit messages and PR titles say what changed and why in plain English.
