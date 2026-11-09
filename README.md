# kubecon-pq-agent

A KubeCon NA 2026 conference agent. An MCP server and an accessible web client that answer "which talk, which booth, which side event, who should I meet" over the real schedule. Every attendee request travels over an Aethyr post-quantum tunnel.

Built for the Cloud Native Hackathon, Salt Lake City, November 9, 2026.

## What it is

One Kubernetes cluster runs the whole product: Elasticsearch holds six indices built from the public KubeCon schedule, sponsor directory, and co-located event pages; `api` answers hybrid search (BM25 + local vector search fused with reciprocal rank fusion), recommendations, day schedules, conflict checks, booths, side events, and room accessibility; `mcp-server` exposes the same as eight MCP tools, a schedule resource, and a "plan my day" prompt; `web` is a Next.js client with full, text, and screen-reader modes. Embeddings run on the CPU inside the cluster, so no attendee query leaves it.

The Aethyr layer wraps it: a `CryptoPolicy` cluster resource declares the key exchange (ML-KEM-768 or ML-KEM-1024) and signature level, `PQTunnel` resources declare which services are reachable through the post-quantum tunnel, and `PQPeer` resources are attendees. `aethyr-operator` renders those into gateway config and hot-reloads the gateway DaemonSet; `identity` admits peers and issues short-lived tokens. Every change is a pull request reviewed by Gitar, built by GitHub Actions, deployed by Argo CD, canaried by Argo Rollouts, watched by Radar, and traced end to end in Dash0.

## What pre-existed

Aethyr Node, our post-quantum tunnel library, is used here as a container image (`ghcr.io/aethyrai/aethyr-tunnel`) and nothing else. Its source and history are in its own repository and were not written during the hackathon window. The tunnel binary speaks mTLS 1.3 on the outside and an ML-DSA-authenticated, ML-KEM-keyed AWP session on the inside.

Everything else in this repository was written on November 9, 2026.

## What was built on November 9

Platform and prep (morning, pull requests 1 to 15):

- #1 Platform under Argo CD: namespaces with Pod Security labels, default-deny NetworkPolicies, Let's Encrypt issuer, app-of-apps.
- #2, #5 Elasticsearch StatefulSet with a sealed bootstrap password and a sealed write-scoped API key.
- #3 `es-client`: six strict index mappings behind date-suffixed aliases, alias swap, tests.
- #4 CRDs `CryptoPolicy`, `PQTunnel`, `PQPeer` with OpenAPI enums and CEL rules.
- #6, #7 OpenTelemetry collector and node agent exporting to Dash0; Radar under Argo.
- #8 Ingest from the LF schedule JSON with local bge-small embeddings (384 dims).
- #10 Service skeletons, Rollout charts with canaries, operator, gateway DaemonSet with bootstrap Job, chaos faults, gateway telemetry, web skeleton.
- #11 Identity service, the sample `CryptoPolicy` and `PQTunnel`s.
- #12, #13, #14 Pull secrets, nested dependency fix, bootstrap Job fix.
- #15 Exhibitors (229 booths) and side events from the sponsor directory and co-located schedules.

Product (afternoon, pull requests 16 to 18):

- #16 `api`: hybrid search, recommend, schedule, conflicts, booths, side events, room access.
- #17 `mcp-server`: `search_sessions`, `get_schedule`, `recommend`, `check_conflicts`, `find_booths`, `side_events`, `room_accessibility`; resource `kubecon://schedule/{day}`; prompt `plan-my-day`.
- #18 `web`: schedule with a conflict-aware plan, booths, side events, room accessibility panel, three modes.

## Tracks

Evidence files live in `demo/evidence/`. One file per judging line:

| Track | What the judge sees | Evidence |
| --- | --- | --- |
| Gitar: Never Merge Broken | Every change is a reviewed PR; PR 8 is a planted CI break Gitar diagnoses and auto-fixes | `gitar-diagnosis.png`, `gitar-autofix-commit.png`, the PR list |
| Dash0: Stop Flying Blind | One trace from the tunnel through api, Elasticsearch, and the model; Agent0 names the slow Elasticsearch span after a planted fault | `dash0-e2e-trace.png`, `agent0-es-latency.png`, `dash0-slo-recovery.png`, `dash0-kem-flip.png` |
| Radar: AI SRE | Radar explains a killed pod, promotes a canary from the coding agent, audits the cluster before and after | `radar-pod-kill-rca.png`, `cline-radar-promote.png`, `radar-audit-before.png`, `radar-audit-after-monday.png` |
| Elasticsearch: Find the Right Talk | Hybrid search finds what keyword search misses; Elasticsearch is the only datastore | `es-hybrid-vs-keyword.png`, `kubectl get pods -n elastic` |
| Merge Forward | Screen-reader mode reading a room panel; every control labelled | `web-screenreader-room.png` |
| Best overall | Live `CryptoPolicy` rotation from ML-KEM-768 to ML-KEM-1024 with the Dash0 label flipping | `kubectl-aethyr-crds.png`, `dash0-kem-1024.png`, `tunnel-local-smoke.txt` |

## Run it

The cluster is `kube-aethyr`, a single k3s node. The kind fallback:

```bash
kind create cluster --name kubecon
helm upgrade --install argocd argo/argo-cd -n argocd --create-namespace
kubectl apply -f deploy/crds/
kubectl apply -f deploy/argocd/app-of-apps.yaml
kubectl -n conf port-forward svc/web 3000:80   # then open http://localhost:3000
```

Through the tunnel from a laptop (needs `aethyr-tunnel` on the path and cluster access):

```bash
demo/tunnel-client.sh            # opens 127.0.0.1:8085 -> api and 127.0.0.1:8081 -> mcp-server
curl http://127.0.0.1:8085/search?q=agents+that+fix+clusters
```

Register the MCP server in a client: Streamable HTTP at `http://127.0.0.1:8081/mcp`.
