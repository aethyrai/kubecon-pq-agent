# kubecon-pq-agent

A KubeCon NA 2026 conference agent. An MCP server and an accessible web client that answer "where should I be now, and where next", and "which talk, which booth, which side event, who should I meet" over the real schedule. MCP clients reach the agent over an Aethyr post-quantum tunnel. The public web client uses HTTPS.

Built for the Cloud Native Hackathon, Salt Lake City, November 9, 2026.

Built with Gitar, Dash0, Radar, Elasticsearch, and OpenTelemetry.

## What it is

One Kubernetes cluster runs the whole product: Elasticsearch holds seven indices built from the public KubeCon schedule, sponsor directory, and co-located event pages; `api` answers hybrid search (BM25 + local vector search fused with reciprocal rank fusion), recommendations, day schedules, conflict checks, next-move guidance, logistics, booths, side events, and room accessibility; `mcp-server` exposes the same as ten MCP tools, a schedule resource, and a "plan my day" prompt; `web` is a Next.js client with full, text, and screen-reader modes. Walk times are estimates from venue and level, because the schedule publishes no distances. The plan stays in the page address, so the server stores no attendee plan. Embeddings run on the CPU inside the cluster, so no attendee query leaves it.

The Aethyr layer wraps it: a `CryptoPolicy` cluster resource declares the key exchange (ML-KEM-768 or ML-KEM-1024) and signature level, `PQTunnel` resources declare which services are reachable through the post-quantum tunnel, and `PQPeer` resources are attendees. `aethyr-operator` renders those into gateway config and hot-reloads the gateway DaemonSet; `identity` admits peers and issues short-lived tokens. After the first scaffold commit, every change is a pull request reviewed by Gitar, built by GitHub Actions, deployed by Argo CD, canaried by Argo Rollouts, watched by Radar, and traced end to end in Dash0.

## What pre-existed

Aethyr Node, our post-quantum tunnel library, is used here as a container image (`ghcr.io/aethyrai/aethyr-tunnel`) and nothing else. Its source and history are in its own repository and were not written during the hackathon window. The tunnel binary speaks mTLS 1.3 on the outside and an ML-DSA-authenticated, ML-KEM-keyed AWP session on the inside.

## Timeline

Except for Aethyr Node, all code in this repository was written on November 9, 2026. The words "Sunday prep" in the title of pull request 10 are an incorrect label.

The hackathon started at 09:00 MST on November 9, 2026. The first commit in this repository is dated 07:16 MST on that day. Pull requests 1 to 6 and 8 merged into `main` before 09:00 MST. Pull request 10 merged at 09:06 MST.

## Use of AI

Claude, an AI coding assistant, helped to write the code in this repository. Gitar reviewed the pull requests and committed the fix in pull request 55.

## What was built

After the first scaffold commit, every change is a pull request reviewed by Gitar; `demo/evidence/CHANGES.md` is the generated log with merge times.

Platform and prep (pull requests 1 to 15, see the timeline above):

- #1 Platform under Argo CD: namespaces with Pod Security labels, default-deny NetworkPolicies, Let's Encrypt issuer, app-of-apps.
- #2, #5 Elasticsearch StatefulSet with a sealed bootstrap password and a sealed write-scoped API key.
- #3 `es-client`: six strict index mappings behind date-suffixed aliases, alias swap, tests.
- #4 CRDs `CryptoPolicy`, `PQTunnel`, `PQPeer` with OpenAPI enums and CEL rules.
- #6, #7 OpenTelemetry collector and node agent exporting to Dash0; Radar under Argo.
- #8 Ingest from the LF schedule JSON with local bge-small embeddings (384 dims, no model API).
- #10 Service skeletons, Rollout charts with canaries, operator, gateway DaemonSet with bootstrap Job, chaos faults, gateway telemetry, web skeleton.
- #11 Identity service, the sample `CryptoPolicy` and `PQTunnel`s.
- #12, #13, #14 Pull secrets, nested dependency fix, bootstrap Job fix.
- #15 Exhibitors (229 booths) and side events from the sponsor directory and co-located schedules.

Product (pull requests 16 to 35):

- #16 `api`: hybrid search (BM25 + kNN, reciprocal rank fusion), recommend, schedule, conflicts, booths, side events, room access.
- #17 `mcp-server`: `search_sessions`, `get_schedule`, `recommend`, `check_conflicts`, `find_booths`, `side_events`, `room_accessibility`; resource `kubecon://schedule/{day}`; prompt `plan-my-day`.
- #18 `web`: schedule with a conflict-aware plan, booths, side events, room accessibility panel, three modes.
- #19 README and the six-minute script.
- #20, #26, #35 Deploys: immutable image tags, operator, web.
- #21 Gateway image with the `signature` field (aethyr-node PR #88): CryptoPolicy drives ML-DSA-65/ML-KEM-768 or ML-DSA-87/ML-KEM-1024.
- #22, #30, #33 Evidence tooling (`capture.sh`, `changes.sh`, `smoke.sh`) and captured proofs: tunnel handshake, public search, canary, 8/8 smoke, MCP recommend and conflicts, the live rotation to ML-KEM-1024 and back.
- #23, #25, #29 Fixes found by running it: ingest fixtures in the image, Dash0 token newline, gateway probe noise.
- #24 Operator as a polling reconciler that records a Kubernetes Event per change action.
- #28/#31 Argo never re-applies the CryptoPolicy spec, so a merge during the demo cannot undo the rotation.
- #32 Web design pass: two-venue day ruler, hyperlegible type, token palette with dark mode, nav that keeps mode and picks.

Afternoon (pull requests 36 to 73):

- #44, #46, #47 Signed post-quantum trail: ML-DSA-65 hash-chained records kept by identity in segmented Secrets, `/trail` and `/trail/key`, the web `/trail` page, and the offline verifier `demo/verify-trail.mjs`.
- #45 Identity rolls with Recreate so the trail has one writer.
- #53, #54 OpenTelemetry through every hop: one shared `@kubecon-pq-agent/otel` bootstrap for every Node service, named spans `search.hybrid` (with `search.leg.bm25` and `search.leg.knn`), `embed.local`, `mcp.tool <name>`, `operator.reconcile`, `ingest.bulk`, server tracing in web, flush on exit.
- #57, #58 Incident and recovery: npm nested the OpenTelemetry SDK under `packages/otel/node_modules` and the images did not copy it, so every new pod crash-looped while the old canary pods kept serving; the Dockerfiles copy the directory and the cluster recovered in twenty minutes.
- #60, #63 Dash0 deployment markers: Argo CD PostSync and SyncFail hooks post a `dash0.deployment` event per roll, tolerant of the pod-network race.
- #61 `trace_id` and `span_id` on every request log line, so a log line in Dash0 opens its trace.
- #68, #72 Chaos faults made real: the sealed token lost its trailing newline, and the latency fault reaches every api replica.
- #36, #48, #49, #50, #59, #64, #73 Evidence captures and README passes; text-only sponsor credits.
- #51, #52, #65, #67, #69 Web: credits, the `/about` section "What you see in Dash0", hybrid wording.
- #66 Run of show; #71 README claims checked against the repository history.
- #55 stays open on purpose: the planted CI break that Gitar diagnosed and fixed with its own commit.

## Tracks

Evidence files live in `demo/evidence/`. One file per judging line:

| Track | What the judge sees | Evidence |
| --- | --- | --- |
| Gitar: Never Merge Broken | Features land through reviewed PRs. [PR 55](https://github.com/aethyrai/kubecon-pq-agent/pull/55) has a deliberately planted type error: CI failed, Gitar diagnosed the error and committed the fix, and CI passed | `gitar-ci-fix.txt`, `gitar-diagnosis.png`, `gitar-autofix-commit.png`, `CHANGES.md` |
| Dash0: Stop Flying Blind | One trace from the tunnel through web and api to Elasticsearch, with the `search.leg.bm25` and `search.leg.knn` spans inside `search.hybrid`; every request log line carries its trace id; a deployment marker per roll; Agent0 names the slow Elasticsearch span after a planted fault | `otel-collector-span-export.txt`, `log-trace-correlation.txt`, `dash0-deployment-markers.txt`, `chaos-es-latency-fault.txt`, `dash0-e2e-trace.png`, `agent0-es-latency.png`, `dash0-kem-flip.png` |
| Radar: AI SRE | Radar explains a pod that we deliberately killed, promotes a canary from the coding agent, audits the cluster before and after | `radar-pod-kill-rca.png`, `claude-radar-promote.png`, `radar-audit-before.png`, `radar-audit-after-monday.png` |
| Elasticsearch: Find the Right Talk | Hybrid search finds what keyword search misses; Elasticsearch is the only datastore | `smoke-through-tunnel.txt` (semantic-only hits counted), `es-hybrid-vs-keyword.png`, `kubectl get pods -n elastic` |
| Merge Forward | Screen-reader mode reading a room panel; every control labelled | `web-screenreader-room.png` |
| Best overall | Live `CryptoPolicy` rotation from ML-KEM-768 to ML-KEM-1024 with the Dash0 label flipping | `cryptopolicy-rotation-ml-kem-1024.txt`, `cryptopolicy-rotation-back-to-768.txt`, `pq-trail-rotation.txt`, `kubectl-aethyr-crds.png`, `dash0-kem-1024.png` |

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
