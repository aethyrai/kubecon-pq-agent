# Changes merged on 2026-11-09 (America/Denver)

| PR | Merged | Title | Gitar |
| --- | --- | --- | --- |
| [#1](https://github.com/aethyrai/kubecon-pq-agent/pull/1) | 07:41 | Bootstrap the platform through Argo CD | pass |
| [#2](https://github.com/aethyrai/kubecon-pq-agent/pull/2) | 07:49 | Add a one-node Elasticsearch StatefulSet | pass |
| [#3](https://github.com/aethyrai/kubecon-pq-agent/pull/3) | 07:49 | Add the es-client package with the six index mappings | pass |
| [#4](https://github.com/aethyrai/kubecon-pq-agent/pull/4) | 07:51 | Add the CryptoPolicy, PQTunnel, and PQPeer CRDs | pass |
| [#5](https://github.com/aethyrai/kubecon-pq-agent/pull/5) | 08:01 | Seal the Elasticsearch API key for the apps | pass |
| [#6](https://github.com/aethyrai/kubecon-pq-agent/pull/6) | 08:01 | Run the OTel collector, node agent, and Radar under Argo CD | pass |
| [#8](https://github.com/aethyrai/kubecon-pq-agent/pull/8) | 08:44 | Add the ingest app with local embeddings and the schedule fixture | pass |
| [#10](https://github.com/aethyrai/kubecon-pq-agent/pull/10) | 09:06 | Skeletons, charts, operator, identity, chaos, web (Sunday prep) | pass |
| [#11](https://github.com/aethyrai/kubecon-pq-agent/pull/11) | 09:17 | Add the identity chart, the aethyr-policy Argo app, and the identity tunnel | pass |
| [#12](https://github.com/aethyrai/kubecon-pq-agent/pull/12) | 09:17 | Pull every image with the ghcr-pull secret | pass |
| [#13](https://github.com/aethyrai/kubecon-pq-agent/pull/13) | 09:55 | Images: copy each app's nested node_modules | pass |
| [#14](https://github.com/aethyrai/kubecon-pq-agent/pull/14) | 09:55 | gateway bootstrap: run the one-shot key generation as root on plain Alpine | pass |
| [#15](https://github.com/aethyrai/kubecon-pq-agent/pull/15) | 09:56 | Ingest exhibitors and side events from the LF sponsor directory and co-located schedules | pass |
| [#16](https://github.com/aethyrai/kubecon-pq-agent/pull/16) | 09:56 | api: hybrid search, recommend, schedule, conflicts, booths, side events, room access | pass |
| [#17](https://github.com/aethyrai/kubecon-pq-agent/pull/17) | 09:56 | mcp-server: the eight conference tools, the schedule resource, and the plan prompt | pass |
| [#18](https://github.com/aethyrai/kubecon-pq-agent/pull/18) | 09:56 | web: schedule with a conflict-aware plan, booths, side events, room accessibility panel | pass |
| [#19](https://github.com/aethyrai/kubecon-pq-agent/pull/19) | 09:56 | README for submission and the six-minute script with the real commands | pass |
| [#20](https://github.com/aethyrai/kubecon-pq-agent/pull/20) | 10:12 | Deploy the release's immutable image tags to the hackathon cluster | pass |
| [#21](https://github.com/aethyrai/kubecon-pq-agent/pull/21) | 10:12 | Gateway image with the signature field; api tunnel on local port 8085 | pass |
| [#22](https://github.com/aethyrai/kubecon-pq-agent/pull/22) | 10:12 | Evidence tooling: capture.sh, changes.sh, smoke.sh; first captures | pass |
| [#23](https://github.com/aethyrai/kubecon-pq-agent/pull/23) | 10:23 | ingest image: ship every fixture folder; point the Job at fixtures/lf | pass |
| [#24](https://github.com/aethyrai/kubecon-pq-agent/pull/24) | 10:26 | operator: poll-and-reconcile, Kubernetes Events per change action, operator-owned config-hash | pass |
| [#25](https://github.com/aethyrai/kubecon-pq-agent/pull/25) | 10:28 | Dash0: re-seal the auth token without the trailing newline; seal the RUM token for web | pass |
| [#26](https://github.com/aethyrai/kubecon-pq-agent/pull/26) | 10:33 | Deploy aethyr-operator sha-0531f9e (polling reconciler with Events) | pass |
| [#29](https://github.com/aethyrai/kubecon-pq-agent/pull/29) | 10:40 | gateway: one liveness probe a minute, no readiness probe | pass |
| [#30](https://github.com/aethyrai/kubecon-pq-agent/pull/30) | 10:40 | Evidence: recommend and check_conflicts through the tunnel over MCP | pass |
| [#31](https://github.com/aethyrai/kubecon-pq-agent/pull/31) | 10:47 | Argo: never re-apply the CryptoPolicy spec | pass |
| [#32](https://github.com/aethyrai/kubecon-pq-agent/pull/32) | 11:01 | web: design pass with a two-venue day ruler, hyperlegible type, and styled modes | pass |
| [#33](https://github.com/aethyrai/kubecon-pq-agent/pull/33) | 11:01 | Laptop client follows the live CryptoPolicy; rotation evidence | pass |
| [#35](https://github.com/aethyrai/kubecon-pq-agent/pull/35) | 11:08 | Deploy web sha-4e8f5b7 (design pass, product pages) | pass |
| [#36](https://github.com/aethyrai/kubecon-pq-agent/pull/36) | 11:29 | README: the full list of what was built today; regenerate the change log | pass |
| [#37](https://github.com/aethyrai/kubecon-pq-agent/pull/37) | 11:39 | web: ruler key sentence and numbered room facts in reader mode | pass |
| [#38](https://github.com/aethyrai/kubecon-pq-agent/pull/38) | 11:45 | web: /about page with provenance, linked from the footer | pass |
| [#40](https://github.com/aethyrai/kubecon-pq-agent/pull/40) | 11:49 | Deploy web sha-1578b2d (ruler key, reader-mode numbered facts, /about) | pass |
| [#39](https://github.com/aethyrai/kubecon-pq-agent/pull/39) | 11:49 | web: choose the talk to drop per conflict pair (rebased #34) | pass |
| [#41](https://github.com/aethyrai/kubecon-pq-agent/pull/41) | 11:54 | Deploy web sha-9be2c50 (per-pair drop fix) | pass |
| [#7](https://github.com/aethyrai/kubecon-pq-agent/pull/7) | 12:00 | Lowercase the OTLP gRPC header keys for the Dash0 exporter | pass |
| [#43](https://github.com/aethyrai/kubecon-pq-agent/pull/43) | 12:01 | Wiring for the signed PQ trail (issue #42) | pass |
| [#45](https://github.com/aethyrai/kubecon-pq-agent/pull/45) | 12:10 | identity: Recreate strategy so only one writer ever appends to the signed trail | pass |
| [#46](https://github.com/aethyrai/kubecon-pq-agent/pull/46) | 12:13 | identity RBAC: enumerate the 50 trail segment Secrets by name | pass |
| [#44](https://github.com/aethyrai/kubecon-pq-agent/pull/44) | 12:14 | Signed post-quantum trail: ML-DSA-65 chained records in identity, /trail page, offline verifier | pass |
| [#47](https://github.com/aethyrai/kubecon-pq-agent/pull/47) | 12:20 | Deploy identity sha-1a2d73b and web sha-1a2d73b (signed PQ trail) | pass |
| [#48](https://github.com/aethyrai/kubecon-pq-agent/pull/48) | 12:30 | Evidence: the signed PQ trail records the rotation round trip | pass |
| [#49](https://github.com/aethyrai/kubecon-pq-agent/pull/49) | 12:34 | Evidence pass: deployed image tags in captures, operating notes, segment comment | pass |
| [#50](https://github.com/aethyrai/kubecon-pq-agent/pull/50) | 12:56 | README: credits line for the sponsor tools (text only) | pass |
| [#51](https://github.com/aethyrai/kubecon-pq-agent/pull/51) | 13:00 | web: text-only credit line in the footer and on /about | pass |
| [#52](https://github.com/aethyrai/kubecon-pq-agent/pull/52) | 13:06 | Deploy web sha-d1e060b (credits line) | pass |
| [#53](https://github.com/aethyrai/kubecon-pq-agent/pull/53) | 13:50 | Spans through every hop: shared OTel package, named spans per stage, web server tracing | pass |
| [#54](https://github.com/aethyrai/kubecon-pq-agent/pull/54) | 13:54 | Flush OTel spans on natural exit; version-tag ingest traces; credit OpenTelemetry | pass |
| [#56](https://github.com/aethyrai/kubecon-pq-agent/pull/56) | 13:59 | Roll all six images to sha-8de26b4: OTel spans everywhere, exit flush | pass |
| [#57](https://github.com/aethyrai/kubecon-pq-agent/pull/57) | 14:08 | Ship the otel package's nested node_modules in every runtime image | pass |
| [#58](https://github.com/aethyrai/kubecon-pq-agent/pull/58) | 14:13 | Roll all six images to sha-f32be44: recover from the otel crash loop | pass |
| [#59](https://github.com/aethyrai/kubecon-pq-agent/pull/59) | 14:21 | Evidence: collector span export and smoke run after the OTel roll | pass |
| [#61](https://github.com/aethyrai/kubecon-pq-agent/pull/61) | 14:26 | Stamp trace_id and span_id on every pino log line | pass |
| [#60](https://github.com/aethyrai/kubecon-pq-agent/pull/60) | 14:26 | Dash0 deployment markers from Argo CD sync hooks | pass |
| [#62](https://github.com/aethyrai/kubecon-pq-agent/pull/62) | 14:33 | Roll all six images to sha-ff350ab: pino trace ids, first Dash0 deployment markers | pass |
| [#63](https://github.com/aethyrai/kubecon-pq-agent/pull/63) | 14:44 | Deployment-marker hook survives a refused connection | pass |
| [#64](https://github.com/aethyrai/kubecon-pq-agent/pull/64) | 14:44 | Evidence: first Dash0 deployment markers and trace ids on log lines | pass |
| [#65](https://github.com/aethyrai/kubecon-pq-agent/pull/65) | 14:47 | web: about page explains Dash0 deployment markers and log-to-trace links; footer credits OpenTelemetry | pass |
| [#67](https://github.com/aethyrai/kubecon-pq-agent/pull/67) | 14:50 | web: about page: accurate search.hybrid wording | pass |
| [#68](https://github.com/aethyrai/kubecon-pq-agent/pull/68) | 14:52 | Re-seal the chaos token without its trailing newline | pass |
| [#66](https://github.com/aethyrai/kubecon-pq-agent/pull/66) | 14:53 | Run of show: leg spans, log trace ids, and a deployment-marker beat | pass |
| [#69](https://github.com/aethyrai/kubecon-pq-agent/pull/69) | 14:55 | Web to sha-1ffb105: /about Dash0 section and OpenTelemetry credit | pass |
| [#71](https://github.com/aethyrai/kubecon-pq-agent/pull/71) | 15:00 | docs(readme): correct claims to match the repository history | pass |
| [#72](https://github.com/aethyrai/kubecon-pq-agent/pull/72) | 15:02 | Latency fault reaches every api replica; evidence of the fixed chaos token | pass |
| [#73](https://github.com/aethyrai/kubecon-pq-agent/pull/73) | 15:03 | Evidence: web roll through the retrying deployment-marker hook | pass |
