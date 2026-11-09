# Six-minute run of show

Submission URL: (fill in at kickoff)
Submission format: (fill in at kickoff)

Open every screen in its own browser tab, in this order, before the slot. Hotspot on, laptop plugged in, tunnel up (`demo/tunnel-client.sh`).

| Clock | Step | Say (one sentence) | Screen / command |
| --- | --- | --- | --- |
| 0:00 | Open | 9,000 people, 300 sessions, hostile Wi-Fi, and your meeting graph is organizational intelligence. | README |
| 0:20 | Product | Watch the coding agent plan Tuesday. | Cline/Claude Code: `recommend` then `check_conflicts` via `http://127.0.0.1:8081/mcp` |
| 1:10 | Accessibility | The same product in a screen reader. | `https://app.kube.aethyr.cloud/rooms/82949?mode=reader` with VoiceOver/NVDA |
| 1:40 | Trace | One request, one trace, from the tunnel to Elasticsearch, and every request's log line carries its trace id. | Dash0 trace for `/recommend`: web, api, `search.hybrid` with `search.leg.bm25` and `search.leg.knn`, Elasticsearch spans; open a `search` log line and jump to its trace |
| 2:05 | Deploys | Every promotion today left a mark on the chart. | Dash0 api chart: deployment markers, one per image tag (Argo CD sync hooks post `dash0.deployment`) |
| 2:20 | Crypto-agility | Every request rode a post-quantum tunnel. Here is the policy, and here is the change, live. | `kubectl apply -f demo/cryptopolicy-ml-kem-1024.yaml`; `kubectl get cryptopolicy`; Dash0 `aethyr.tunnel.handshakes` by `kem` |
| 3:00 | Dash0 fault | I slow Elasticsearch. Agent0 finds it. | `demo/chaos/es-latency.sh 2000`; Agent0: "Why is /search slow?"; `demo/chaos/es-latency.sh reset` |
| 3:45 | Radar | Radar explains the pod I killed and promotes the canary from my coding agent. | `demo/chaos/kill-api-pod.sh`; Radar incident; Radar MCP promote |
| 4:45 | Gitar | Every change today was a reviewed PR. Here is one Gitar fixed for me. | PR "Add conflict scoring to recommend": diagnosis, auto-applied commit, green CI |
| 5:20 | Close | Aethyr Node is our existing library. Everything else you saw was built today. | README, "What was built on November 9" |
| 5:50 | Stop | Thank you. | |

Reset after: `kubectl apply -f deploy/platform/aethyr/policy-and-tunnels.yaml` (back to ML-KEM-768).
