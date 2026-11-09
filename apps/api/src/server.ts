import { serve } from '@hono/node-server';
import { clientFromEnv } from '@kubecon-pq-agent/es-client';
import { buildApp } from './app.js';
import { log } from './log.js';

const port = Number(process.env.PORT ?? 8080);
let es: ReturnType<typeof clientFromEnv> | undefined;
try {
  es = clientFromEnv();
} catch (err) {
  log.warn({ err }, 'Elasticsearch not configured; readiness will report not-ready');
}

const app = buildApp({
  elasticsearch: async () => {
    if (!es) return false;
    try {
      await es.cluster.health({ timeout: '2s' });
      return true;
    } catch {
      return false;
    }
  },
});

serve({ fetch: app.fetch, port, hostname: '0.0.0.0' }, (info) => {
  log.info({ port: info.port }, 'api listening');
});
