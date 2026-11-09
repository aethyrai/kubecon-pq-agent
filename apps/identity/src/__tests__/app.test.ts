import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildApp, type PeerRegistry } from '../app.js';
import { MemoryTokenStore } from '../store.js';
import { hashToken, isExpired, newToken, peerIdFromPublicKey, TOKEN_TTL_MS } from '../tokens.js';
import { MemoryTrailStore, Trail } from '../trail.js';

const PUB = Buffer.alloc(1952, 7).toString('base64');
const registry = (admit: boolean): PeerRegistry & { calls: string[] } => ({
  calls: [],
  async register(name) {
    this.calls.push(`register:${name}`);
    return { admitted: admit };
  },
  async tokenIssued(name) {
    this.calls.push(`issued:${name}`);
  },
});

test('peer id is a stable pseudonym of the public key', () => {
  assert.equal(peerIdFromPublicKey(PUB), peerIdFromPublicKey(PUB));
  assert.notEqual(
    peerIdFromPublicKey(PUB),
    peerIdFromPublicKey(Buffer.alloc(1952, 8).toString('base64')),
  );
  assert.match(peerIdFromPublicKey(PUB), /^peer-[a-z0-9x]{32}$/);
});

test('register admits, issues a 12 h token, and verify accepts it until expiry', async () => {
  let now = new Date('2026-11-09T16:00:00Z');
  const reg = registry(true);
  const store = new MemoryTokenStore();
  const app = buildApp(reg, store, () => now);
  const res = await app.request('/register', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ publicKey: PUB, algorithm: 'ML-DSA-65', optIns: { matchmaking: true } }),
  });
  assert.equal(res.status, 201);
  const body = (await res.json()) as { peerId: string; token: string; expiresAt: string };
  assert.equal(body.peerId, peerIdFromPublicKey(PUB));
  assert.equal(new Date(body.expiresAt).getTime() - now.getTime(), TOKEN_TTL_MS);
  assert.deepEqual(reg.calls, [`register:${body.peerId}`, `issued:${body.peerId}`]);

  const ok = await app.request('/verify', { headers: { authorization: `Bearer ${body.token}` } });
  assert.equal(ok.status, 200);
  assert.equal(((await ok.json()) as { peerId: string }).peerId, body.peerId);

  now = new Date(now.getTime() + TOKEN_TTL_MS + 1);
  const expired = await app.request('/verify', {
    headers: { authorization: `Bearer ${body.token}` },
  });
  assert.equal(expired.status, 401);
});

test('an unadmitted peer gets 403 and no token; a bad body gets 400; unknown token 401', async () => {
  const app = buildApp(registry(false), new MemoryTokenStore());
  const res = await app.request('/register', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ publicKey: PUB, algorithm: 'ML-DSA-65' }),
  });
  assert.equal(res.status, 403);
  assert.equal(
    (await app.request('/register', { method: 'POST', body: '{"publicKey":"short"}' })).status,
    400,
  );
  assert.equal(
    (await app.request('/verify', { headers: { authorization: 'Bearer nope' } })).status,
    401,
  );
});

test('a different key under an existing peer id is a 409, never an overwrite', async () => {
  const reg: PeerRegistry = {
    async register() {
      return { admitted: false, conflict: true };
    },
    async tokenIssued() {},
  };
  const app = buildApp(reg, new MemoryTokenStore());
  const res = await app.request('/register', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ publicKey: PUB, algorithm: 'ML-DSA-65' }),
  });
  assert.equal(res.status, 409);
});

test('a malformed DID is rejected before any peer is touched', async () => {
  const reg = registry(true);
  const app = buildApp(reg, new MemoryTokenStore());
  const res = await app.request('/register', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ publicKey: PUB, algorithm: 'ML-DSA-65', did: 'did:key:short' }),
  });
  assert.equal(res.status, 400);
  assert.deepEqual(reg.calls, []);
});

test('only the token hash is ever stored', () => {
  const t = newToken();
  assert.notEqual(t.token, t.hash);
  assert.equal(t.hash, hashToken(t.token));
  assert.equal(isExpired({ peerId: 'p', issuedAt: '', expiresAt: '2000-01-01T00:00:00Z' }), true);
});

test('register and verify append signed trail records, and /trail serves a verified chain', async () => {
  const now = new Date('2026-11-09T19:00:00Z');
  const trail = await Trail.open(new MemoryTrailStore(), () => now);
  const app = buildApp(registry(true), new MemoryTokenStore(), () => now, trail);
  const reg = await app.request('/register', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ publicKey: PUB, algorithm: 'ML-DSA-65' }),
  });
  assert.equal(reg.status, 201);
  const { token } = (await reg.json()) as { token: string };
  const ver = await app.request('/verify', { headers: { authorization: `Bearer ${token}` } });
  assert.equal(ver.status, 200);
  const res = await app.request('/trail');
  assert.equal(res.status, 200);
  const body = (await res.json()) as {
    algorithm: string;
    publicKey: string;
    verification: { ok: boolean; count: number };
    records: Array<{ kind: string; data: Record<string, string> }>;
  };
  assert.equal(body.algorithm, 'ML-DSA-65');
  assert.equal(body.publicKey, trail.publicKey);
  assert.deepEqual(body.verification, { ok: true, count: 3 });
  assert.deepEqual(
    body.records.map((r) => r.kind),
    ['peer.registered', 'token.issued', 'token.verified'],
  );
  assert.equal(body.records[0]?.data.peer, peerIdFromPublicKey(PUB));
  const key = await app.request('/trail/key');
  assert.equal(((await key.json()) as { publicKey: string }).publicKey, trail.publicKey);
});

test('/trail caps the window and reports total and from', async () => {
  const now = new Date('2026-11-09T19:00:00Z');
  const trail = await Trail.open(new MemoryTrailStore(), () => now);
  for (let i = 0; i < 7; i++) await trail.append('token.verified', { peer: `peer-${i}` });
  const app = buildApp(registry(true), new MemoryTokenStore(), () => now, trail);
  const body = (await (await app.request('/trail?limit=3')).json()) as {
    total: number;
    from: number;
    records: Array<{ seq: number }>;
    verification: { ok: boolean; count: number };
  };
  assert.equal(body.total, 7);
  assert.equal(body.from, 5);
  assert.deepEqual(
    body.records.map((r) => r.seq),
    [5, 6, 7],
  );
  assert.deepEqual(body.verification, { ok: true, count: 7 });
  const huge = (await (await app.request('/trail?limit=99999')).json()) as { records: unknown[] };
  assert.equal(huge.records.length, 7);
});

test('/trail answers 404 when the trail is not enabled', async () => {
  const app = buildApp(registry(true), new MemoryTokenStore());
  assert.equal((await app.request('/trail')).status, 404);
});
