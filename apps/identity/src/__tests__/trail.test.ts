import assert from 'node:assert/strict';
import { test } from 'node:test';
import { recordPolicyChanges } from '../policy-watch.js';
import { canonical, GENESIS_HASH, hashOf, MemoryTrailStore, Trail, verifyTrail } from '../trail.js';

/** Index into a list and fail the test instead of returning undefined. */
function at<T>(list: readonly T[], i: number): T {
  const r = list[i];
  assert.ok(r !== undefined);
  return r;
}

const clock = (start = '2026-11-09T19:00:00Z') => {
  let t = new Date(start).getTime();
  return () => new Date((t += 1000));
};

test('a fresh trail has a stable public key and an empty, valid chain', async () => {
  const store = new MemoryTrailStore();
  const a = await Trail.open(store, clock());
  const b = await Trail.open(store, clock());
  assert.equal(a.publicKey, b.publicKey);
  assert.equal(a.head, GENESIS_HASH);
  assert.deepEqual(a.verify(), { ok: true, count: 0 });
});

test('append chains records and every signature verifies', async () => {
  const trail = await Trail.open(new MemoryTrailStore(), clock());
  const r1 = await trail.append('peer.registered', { peer: 'peer-a', algorithm: 'ML-DSA-65' });
  const r2 = await trail.append('token.issued', {
    peer: 'peer-a',
    expiresAt: '2026-11-10T07:00:00Z',
  });
  assert.equal(r1.seq, 1);
  assert.equal(r1.prev, GENESIS_HASH);
  assert.equal(r2.prev, r1.hash);
  assert.equal(r1.hash, hashOf(canonical(r1)));
  assert.equal(trail.head, r2.hash);
  assert.deepEqual(trail.verify(), { ok: true, count: 2 });
});

test('canonical bytes sort data keys and carry the domain prefix', () => {
  const c = canonical({
    seq: 1,
    at: 't',
    kind: 'policy.observed',
    data: { z: '1', a: '2' },
    prev: GENESIS_HASH,
  });
  assert.equal(c, `pqtrail|v1|1|t|policy.observed|{"a":"2","z":"1"}|${GENESIS_HASH}`);
});

test('verification fails on a tampered field, a broken link, a bad signature, and a wrong key', async () => {
  const trail = await Trail.open(new MemoryTrailStore(), clock());
  await trail.append('peer.registered', { peer: 'peer-a', algorithm: 'ML-DSA-65' });
  await trail.append('token.verified', { peer: 'peer-a' });
  const good = trail.list();

  const tampered = structuredClone(good);
  at(tampered, 0).data.peer = 'peer-b';
  assert.deepEqual(verifyTrail(tampered, trail.publicKey), {
    ok: false,
    count: 2,
    brokenAt: 1,
    reason: 'hash mismatch',
  });

  const unlinked = structuredClone(good);
  at(unlinked, 1).prev = 'f'.repeat(64);
  assert.equal(verifyTrail(unlinked, trail.publicKey).reason, 'previous hash mismatch');

  const resigned = structuredClone(good);
  at(resigned, 1).sig = at(resigned, 0).sig;
  assert.equal(verifyTrail(resigned, trail.publicKey).reason, 'signature invalid');

  const other = await Trail.open(new MemoryTrailStore(), clock());
  assert.equal(verifyTrail(good, other.publicKey).reason, 'signature invalid');

  await trail.append('token.verified', { peer: 'peer-a' });
  const three = trail.list();
  const gap = [at(three, 0), at(three, 2)];
  assert.equal(verifyTrail(gap, trail.publicKey).reason, 'sequence gap');
});

test('a contiguous window verifies from its first record, so a capped response still checks', async () => {
  const trail = await Trail.open(new MemoryTrailStore(), clock());
  for (let i = 0; i < 5; i++) await trail.append('token.verified', { peer: `peer-${i}` });
  const window = trail.list().slice(2);
  assert.deepEqual(verifyTrail(window, trail.publicKey), { ok: true, count: 3 });
  const bent = structuredClone(window);
  at(bent, 1).data.peer = 'peer-x';
  assert.equal(verifyTrail(bent, trail.publicKey).brokenAt, 4);
});

test('a reopened trail continues the same chain with the same key', async () => {
  const store = new MemoryTrailStore();
  const first = await Trail.open(store, clock());
  await first.append('peer.registered', { peer: 'peer-a', algorithm: 'ML-DSA-65' });
  const again = await Trail.open(store, clock('2026-11-09T20:00:00Z'));
  const r = await again.append('token.verified', { peer: 'peer-a' });
  assert.equal(r.seq, 2);
  assert.equal(again.publicKey, first.publicKey);
  assert.deepEqual(again.verify(), { ok: true, count: 2 });
});

test('policy watch records first sight and rotations, not unchanged polls', async () => {
  const trail = await Trail.open(new MemoryTrailStore(), clock());
  const p768 = { name: 'default', kem: 'ML-KEM-768', signature: 'ML-DSA-65' } as const;
  const p1024 = { name: 'default', kem: 'ML-KEM-1024', signature: 'ML-DSA-87' } as const;
  let snap = await recordPolicyChanges(trail, new Map(), [p768]);
  snap = await recordPolicyChanges(trail, snap, [p768]);
  snap = await recordPolicyChanges(trail, snap, [p1024]);
  snap = await recordPolicyChanges(trail, snap, [p1024]);
  const kinds = trail.list().map((r) => r.kind);
  assert.deepEqual(kinds, ['policy.observed', 'policy.rotated']);
  assert.deepEqual(at(trail.list(), 1).data, {
    policy: 'default',
    fromKem: 'ML-KEM-768',
    toKem: 'ML-KEM-1024',
    fromSignature: 'ML-DSA-65',
    toSignature: 'ML-DSA-87',
  });
  assert.equal(snap.get('default')?.kem, 'ML-KEM-1024');
});
