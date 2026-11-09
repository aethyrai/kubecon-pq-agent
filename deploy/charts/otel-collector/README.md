# otel-collector

The Dash0 auth token and OTLP endpoint live in the SealedSecret `dash0-auth` in this folder
(keys `token` and `endpoint`). The collector values are in `deploy/env/hack/otel-collector.yaml`
and `otel-agent.yaml`; the chart itself is the upstream `opentelemetry-collector` chart pulled by
the Argo Applications in `deploy/argocd/apps/`.

Re-seal after a token rotation:

```
kubectl -n observability create secret generic dash0-auth \
  --from-file=token=$HOME/.secrets/dash0-token \
  --from-literal=endpoint=ingress.us-west-2.aws.dash0.com:4317 \
  --dry-run=client -o yaml \
  | kubeseal --cert deploy/platform/sealed-secrets/pub-cert.pem -o yaml \
  > deploy/charts/otel-collector/dash0-auth.sealedsecret.yaml
```
