import { PQPeerSpec } from '@kubecon-pq-agent/schema';
import { Hono } from 'hono';
import { z } from 'zod';
import type { TokenStore } from './store.js';
import { hashToken, isExpired, newToken, peerIdFromPublicKey, TOKEN_TTL_MS } from './tokens.js';

export interface PeerRegistry {
  /** Create or update the PQPeer and wait for the operator to admit it. */
  register(name: string, spec: z.infer<typeof PQPeerSpec>): Promise<{ admitted: boolean }>;
  /** Record the token issue time on the peer's status. */
  tokenIssued(name: string, at: string): Promise<void>;
}

const RegisterBody = z.object({
  publicKey: z.string().min(44),
  algorithm: z.enum(['ML-DSA-65', 'ML-DSA-87']),
  did: z
    .string()
    .regex(/^did:(aethyr|key):/)
    .optional(),
  displayName: z.string().max(80).optional(),
  optIns: z
    .object({ matchmaking: z.boolean().optional(), directory: z.boolean().optional() })
    .optional(),
});

export function buildApp(
  registry: PeerRegistry,
  store: TokenStore,
  now: () => Date = () => new Date(),
): Hono {
  const app = new Hono();
  app.get('/healthz', (c) => c.json({ status: 'ok' }));
  app.get('/readyz', (c) => c.json({ status: 'ready' }));

  app.post('/register', async (c) => {
    const parsed = RegisterBody.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success)
      return c.json({ error: 'invalid registration', issues: parsed.error.issues }, 400);
    const b = parsed.data;
    const peerId = peerIdFromPublicKey(b.publicKey);
    const issuedAt = now();
    const expiresAt = new Date(issuedAt.getTime() + TOKEN_TTL_MS);
    const spec = PQPeerSpec.parse({
      publicKey: b.publicKey,
      algorithm: b.algorithm,
      ...(b.did ? { did: b.did } : {}),
      ...(b.displayName ? { displayName: b.displayName } : {}),
      optIns: {
        matchmaking: b.optIns?.matchmaking ?? false,
        directory: b.optIns?.directory ?? false,
      },
      expiresAt: expiresAt.toISOString(),
    });
    const { admitted } = await registry.register(peerId, spec);
    if (!admitted) return c.json({ error: 'peer not admitted', peerId }, 403);
    const t = newToken();
    await store.put(t.hash, {
      peerId,
      issuedAt: issuedAt.toISOString(),
      expiresAt: expiresAt.toISOString(),
    });
    await registry.tokenIssued(peerId, issuedAt.toISOString());
    return c.json({ peerId, token: t.token, expiresAt: expiresAt.toISOString() }, 201);
  });

  /** api calls this with the bearer it received; cache the answer for a minute. */
  app.get('/verify', async (c) => {
    const auth = c.req.header('authorization') ?? '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    if (!token) return c.json({ valid: false, reason: 'missing' }, 401);
    const rec = await store.get(hashToken(token));
    if (!rec) return c.json({ valid: false, reason: 'unknown' }, 401);
    if (isExpired(rec, now())) return c.json({ valid: false, reason: 'expired' }, 401);
    return c.json({ valid: true, peerId: rec.peerId, expiresAt: rec.expiresAt });
  });
  return app;
}
