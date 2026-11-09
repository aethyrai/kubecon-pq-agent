// Loaded with --import before the app: OTel SDK with OTLP gRPC export to the in-cluster collector.
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-grpc';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-grpc';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { NodeSDK } from '@opentelemetry/sdk-node';

const endpoint =
  process.env.OTEL_EXPORTER_OTLP_ENDPOINT ?? 'http://otel-collector.observability.svc:4317';
const sdk = new NodeSDK({
  serviceName: process.env.OTEL_SERVICE_NAME ?? 'mcp-server',
  traceExporter: new OTLPTraceExporter({ url: endpoint }),
  metricReaders: [
    new PeriodicExportingMetricReader({
      exporter: new OTLPMetricExporter({ url: endpoint }),
      exportIntervalMillis: 15000,
    }),
  ],
  instrumentations: [
    getNodeAutoInstrumentations({ '@opentelemetry/instrumentation-fs': { enabled: false } }),
  ],
});
sdk.start();
const shutdown = (): void => {
  sdk.shutdown().finally(() => process.exit(0));
};
process.once('SIGTERM', shutdown);
process.once('SIGINT', shutdown);
