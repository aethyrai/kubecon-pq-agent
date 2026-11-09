import type { Context, Hono, Next } from 'hono';

/**
 * Planted faults for the demo. Every route is off unless DEMO_MODE=true and the caller sends
 * X-Chaos-Token matching CHAOS_TOKEN. Every fault has a reset.
 */
export interface ChaosState {
  /** Extra latency added in front of every Elasticsearch call, in ms. */
  esLatencyMs: number;
}

export const chaos: ChaosState = { esLatencyMs: 0 };

export function chaosEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return (
    env.DEMO_MODE === 'true' && typeof env.CHAOS_TOKEN === 'string' && env.CHAOS_TOKEN.length >= 16
  );
}

export function chaosGuard(env: NodeJS.ProcessEnv = process.env) {
  return async (c: Context, next: Next): Promise<Response | undefined> => {
    if (!chaosEnabled(env)) return c.json({ error: 'not found' }, 404);
    if (c.req.header('x-chaos-token') !== env.CHAOS_TOKEN)
      return c.json({ error: 'forbidden' }, 403);
    await next();
    return undefined;
  };
}

export function mountChaos(app: Hono, env: NodeJS.ProcessEnv = process.env): void {
  app.use('/chaos/*', chaosGuard(env));
  app.post('/chaos/es-latency', (c) => {
    const ms = Number(c.req.query('ms') ?? '2000');
    if (!Number.isFinite(ms) || ms < 0 || ms > 30000)
      return c.json({ error: 'ms must be 0..30000' }, 400);
    chaos.esLatencyMs = ms;
    return c.json({ fault: 'es-latency', esLatencyMs: ms });
  });
  app.post('/chaos/reset', (c) => {
    chaos.esLatencyMs = 0;
    return c.json({ reset: true, esLatencyMs: 0 });
  });
  app.get('/chaos/status', (c) => c.json({ ...chaos }));
}

/** Call before every Elasticsearch request. */
export async function chaosDelay(): Promise<void> {
  if (chaos.esLatencyMs > 0) await new Promise((r) => setTimeout(r, chaos.esLatencyMs));
}
