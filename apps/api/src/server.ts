import { serve } from '@hono/node-server';
import { embedderFromEnv } from '@kubecon-pq-agent/embeddings';
import { clientFromEnv } from '@kubecon-pq-agent/es-client';
import { buildApp } from './app.js';
import { esConference } from './es-conference.js';
import { log } from './log.js';

const port = Number(process.env.PORT ?? 8080);
const es = clientFromEnv();
const embedder = embedderFromEnv();
// Warm the embedding model so the first /search does not pay the load.
embedder.embedQuery('warm up').catch((err) => log.warn({ err }, 'embedder warm-up failed'));

const app = buildApp(
  {
    elasticsearch: async () => {
      try {
        await es.cluster.health({ timeout: '2s' });
        return true;
      } catch {
        return false;
      }
    },
  },
  esConference(es, embedder),
);

serve({ fetch: app.fetch, port, hostname: '0.0.0.0' }, (info) => {
  log.info({ port: info.port }, 'api listening');
});
