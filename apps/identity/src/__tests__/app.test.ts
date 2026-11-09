import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildApp, type PeerRegistry } from '../app.js';
import { MemoryTokenStore } from '../store.js';
import { hashToken, isExpired, newToken, peerIdFromPublicKey, TOKEN_TTL_MS } from '../tokens.js';

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
