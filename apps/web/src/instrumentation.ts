import { registerOTel } from '@vercel/otel';

/**
 * Server-side tracing for the Next.js app: every page render and every fetch to api carries W3C
 * trace context, so one Dash0 trace runs browser -> web -> api -> Elasticsearch. Exports over
 * OTLP/HTTP to the in-cluster collector (OTEL_EXPORTER_OTLP_ENDPOINT, port 4318).
 */
export function register(): void {
  registerOTel({ serviceName: process.env.OTEL_SERVICE_NAME ?? 'web' });
}
