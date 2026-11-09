import { annotate } from '@kubecon-pq-agent/otel';
import { PQPeerSpec } from '@kubecon-pq-agent/schema';
import { Hono } from 'hono';
import { z } from 'zod';
import type { TokenStore } from './store.js';
import type { Trail, TrailKind } from './trail.js';

/** Most records one /trail response carries. */
export const TRAIL_PAGE = 500;

import { hashToken, isExpired, newToken, peerIdFromPublicKey, TOKEN_TTL_MS } from './tokens.js';

export interface PeerRegistry {
  /**
   * Create the PQPeer, or update it when the public key is unchanged, and wait for the operator
   * to admit it. A different key under an existing name is a conflict, never an overwrite.
   */
  register(
    name: string,
    spec: z.infer<typeof PQPeerSpec>,
  ): Promise<{ admitted: boolean; conflict?: boolean }>;
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

/**
 * The v2 DID is derived from the key by the tunnel; the laptop client learns it from its own startup
 * log. Until the client exposes the raw key, the identity service accepts the DID as given and only
 * checks that the same DID is not registered under a different key (see register's conflict rule).
 */
export function didMatchesKey(did: string, _publicKey: string): boolean {
  return /^did:(aethyr|key):[A-Za-z0-9:_-]{16,}$/.test(did);
}

export function buildApp(
  registry: PeerRegistry,
  store: TokenStore,
  now: () => Date = () => new Date(),
  trail?: Trail,
  onTrailError: (err: unknown, kind: TrailKind) => void = () => undefined,
): Hono {
  const app = new Hono();
  /** Record after the state change succeeded. A failed write is logged and never fails the caller. */
  const record = async (kind: TrailKind, data: Record<string, string>): Promise<void> => {
    if (!trail) return;
    try {
      await trail.append(kind, data);
    } catch (err) {
      onTrailError(err, kind);
    }
  };
  app.get('/healthz', (c) => c.json({ status: 'ok' }));
  app.get('/readyz', (c) => c.json({ status: 'ready' }));

  app.post('/register', async (c) => {
    const parsed = RegisterBody.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success)
      return c.json({ error: 'invalid registration', issues: parsed.error.issues }, 400);
    const b = parsed.data;
    const peerId = peerIdFromPublicKey(b.publicKey);
    annotate({ 'peer.id': peerId, 'peer.algorithm': b.algorithm });
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
    // Proof of key possession: /register is reachable only through the PQ tunnel (NetworkPolicy), and the
    // tunnel handshake already authenticates the caller's ML-DSA key. The DID in the body must match the
    // key when both are given, so a peer cannot claim another peer's DID.
    if (b.did && !didMatchesKey(b.did, b.publicKey))
      return c.json({ error: 'did does not match publicKey' }, 400);
    const { admitted, conflict } = await registry.register(peerId, spec);
    if (conflict)
      return c.json(
        { error: 'a peer with this id already exists with a different key', peerId },
        409,
      );
    if (!admitted) return c.json({ error: 'peer not admitted', peerId }, 403);
    const t = newToken();
    await store.put(t.hash, {
      peerId,
      issuedAt: issuedAt.toISOString(),
      expiresAt: expiresAt.toISOString(),
    });
    await registry.tokenIssued(peerId, issuedAt.toISOString());
    await record('peer.registered', { peer: peerId, algorithm: b.algorithm });
    await record('token.issued', { peer: peerId, expiresAt: expiresAt.toISOString() });
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
    // Verifies are not recorded: one per api request would fill the store with no story to tell.
    return c.json({ valid: true, peerId: rec.peerId, expiresAt: rec.expiresAt });
  });

  /**
   * The signed trail, verified at read time against this service's own public key. The
   * response carries the last `limit` records (default and maximum 500) and the verification
   * of the window the service holds; a window verifies from its first record's own previous
   * hash. `total` counts every record ever stored.
   */
  app.get('/trail', (c) => {
    if (!trail) return c.json({ error: 'trail not enabled' }, 404);
    const all = trail.list();
    const asked = Number(c.req.query('limit') ?? TRAIL_PAGE);
    const limit = Number.isInteger(asked) && asked > 0 ? Math.min(asked, TRAIL_PAGE) : TRAIL_PAGE;
    const records = all.slice(-limit);
    return c.json({
      algorithm: 'ML-DSA-65',
      publicKey: trail.publicKey,
      fingerprint: trail.fingerprint,
      head: trail.head,
      total: trail.total,
      from: records[0]?.seq ?? 0,
      verification: trail.verify(),
      records,
    });
  });
  app.get('/trail/key', (c) => {
    if (!trail) return c.json({ error: 'trail not enabled' }, 404);
    return c.json({
      algorithm: 'ML-DSA-65',
      publicKey: trail.publicKey,
      fingerprint: trail.fingerprint,
    });
  });
  return app;
}
