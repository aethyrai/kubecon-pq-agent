import { Hono } from 'hono';
import { log } from './log.js';

export interface Readiness {
  /** True when Elasticsearch answered a health call recently. */
  elasticsearch: () => Promise<boolean>;
}

export interface SessionStub {
  id: string;
  title: string;
  track: string;
  day: string;
  start: string;
  end: string;
  room: string;
  captioned: boolean;
}

/** The one fixed document the Monday build replaces with the real retriever. */
export const STUB_SESSION: SessionStub = {
  id: 'stub-0001',
  title: 'Stub: Agents That Fix Clusters',
  track: 'AI Inference + Agentic',
  day: '2026-11-10',
  start: '2026-11-10T11:30:00',
  end: '2026-11-10T12:00:00',
  room: 'Salt Palace | Level 1 | Grand Ballroom BDF',
  captioned: true,
};

export function buildApp(ready: Readiness): Hono {
  const app = new Hono();

  app.get('/healthz', (c) => c.json({ status: 'ok' }));

  app.get('/readyz', async (c) => {
    const es = await ready.elasticsearch();
    return c.json({ status: es ? 'ready' : 'not-ready', elasticsearch: es }, es ? 200 : 503);
  });

  app.get('/search', (c) => {
    const q = c.req.query('q') ?? '';
    log.info({ q }, 'search (stub)');
    return c.json({ query: q, hits: [STUB_SESSION], total: 1, stub: true });
  });

  app.notFound((c) => c.json({ error: 'not found' }, 404));
  app.onError((err, c) => {
    log.error({ err }, 'unhandled');
    return c.json({ error: 'internal error' }, 500);
  });
  return app;
}
