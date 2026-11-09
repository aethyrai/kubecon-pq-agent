# Submission

Submission URL: (fill in at kickoff)
Submission format: (fill in at kickoff)

## Text (150 words)

kubecon-pq-agent is a conference agent for KubeCon NA 2026. Ask it which talk, which booth, which side event, or where to be now, and it answers over the real schedule. It runs as an MCP server for coding agents and as an accessible web client with full, text, and reader modes. Every MCP request rides an Aethyr post-quantum tunnel, and a signed trail records what the trust plane did.

Aethyr Node, our post-quantum tunnel library, pre-existed as a container image. Everything else was written on November 9, 2026, as pull requests reviewed by Gitar, which diagnosed and fixed a CI break. Dash0 traces every request from the web client through the api to Elasticsearch, with deployment markers from Argo CD. Radar explains a killed pod and promotes a canary. Elasticsearch is the only datastore: hybrid BM25 and vector search over seven indices, embedded inside the cluster.

Live: https://app.kube.aethyr.cloud. Source: https://github.com/aethyrai/kubecon-pq-agent.

## Links for the form

- Live site: https://app.kube.aethyr.cloud
- Provenance page: https://app.kube.aethyr.cloud/about
- Signed trail: https://app.kube.aethyr.cloud/trail
- Repository and README: https://github.com/aethyrai/kubecon-pq-agent
- Evidence files: https://github.com/aethyrai/kubecon-pq-agent/tree/main/demo/evidence
