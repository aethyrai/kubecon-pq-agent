import { Client } from '@elastic/elasticsearch';

export interface EsEnv extends Record<string, string | undefined> {
  ELASTICSEARCH_URL?: string | undefined;
  ELASTICSEARCH_API_KEY?: string | undefined;
  ELASTICSEARCH_USERNAME?: string | undefined;
  ELASTICSEARCH_PASSWORD?: string | undefined;
}

/**
 * Build a client from the environment. An API key wins over basic auth.
 * In-cluster default: http://elasticsearch.elastic.svc:9200.
 */
export function clientFromEnv(env: EsEnv = process.env): Client {
  const node = env.ELASTICSEARCH_URL ?? 'http://elasticsearch.elastic.svc:9200';
  if (env.ELASTICSEARCH_API_KEY) {
    return new Client({ node, auth: { apiKey: env.ELASTICSEARCH_API_KEY } });
  }
  if (env.ELASTICSEARCH_USERNAME && env.ELASTICSEARCH_PASSWORD) {
    return new Client({
      node,
      auth: { username: env.ELASTICSEARCH_USERNAME, password: env.ELASTICSEARCH_PASSWORD },
    });
  }
  throw new Error('Set ELASTICSEARCH_API_KEY or ELASTICSEARCH_USERNAME and ELASTICSEARCH_PASSWORD');
}
