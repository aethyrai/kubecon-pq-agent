import assert from 'node:assert/strict';
import { test } from 'node:test';
import type * as k8s from '@kubernetes/client-node';
import { SEGMENT_SIZE, Trail, verifyTrail } from '../trail.js';
import { type SecretApi, SecretTrailStore, segmentName } from '../trail-store.js';

/** An in-memory Secret API with resourceVersion semantics and optional injected conflicts. */
class FakeSecrets implements SecretApi {
  readonly secrets = new Map<string, k8s.V1Secret>();
  rv = 1;
  conflictsToInject = 0;
  writes = 0;
  private encode(body: k8s.V1Secret): k8s.V1Secret {
    const data: Record<string, string> = {};
    for (const [k, v] of Object.entries(body.stringData ?? {}))
      data[k] = Buffer.from(v).toString('base64');
    return { metadata: { ...body.metadata, resourceVersion: String(++this.rv) }, data };
  }
  async readNamespacedSecret(p: { name: string }): Promise<k8s.V1Secret> {
    const s = this.secrets.get(p.name);
    if (!s) throw Object.assign(new Error('not found'), { code: 404 });
    return structuredClone(s);
  }
  async createNamespacedSecret(p: { body: k8s.V1Secret }): Promise<k8s.V1Secret> {
    const name = p.body.metadata?.name ?? '';
    if (this.secrets.has(name)) throw Object.assign(new Error('exists'), { code: 409 });
    this.writes += 1;
    const s = this.encode(p.body);
    this.secrets.set(name, s);
    return s;
  }
  async replaceNamespacedSecret(p: { name: string; body: k8s.V1Secret }): Promise<k8s.V1Secret> {
    const cur = this.secrets.get(p.name);
    if (!cur) throw Object.assign(new Error('not found'), { code: 404 });
    if (this.conflictsToInject > 0) {
      this.conflictsToInject -= 1;
      throw Object.assign(new Error('conflict'), { code: 409 });
    }
    if (p.body.metadata?.resourceVersion !== cur.metadata?.resourceVersion)
      throw Object.assign(new Error('stale'), { code: 409 });
    this.writes += 1;
    const s = this.encode(p.body);
    this.secrets.set(p.name, s);
    return s;
  }
}

const clock = () => {
  let t = Date.parse('2026-11-09T19:00:00Z');
  return () => {
    t += 1000;
    return new Date(t);
  };
};

test('segments roll over at SEGMENT_SIZE and the index names the newest segment', async () => {
  const api = new FakeSecrets();
  const store = new SecretTrailStore(api, 'aethyr-system');
  const trail = await Trail.open(store, clock());
  for (let i = 0; i < SEGMENT_SIZE + 2; i++) await trail.append('token.issued', { peer: `p${i}` });
  assert.ok(api.secrets.has(segmentName('aethyr-trail', 1)));
  assert.ok(api.secrets.has(segmentName('aethyr-trail', 2)));
  const index = api.secrets.get('aethyr-trail');
  assert.equal(Buffer.from(index?.data?.segments ?? '', 'base64').toString(), '2');
  assert.equal(trail.total, SEGMENT_SIZE + 2);
  const tail = await store.loadTail(10);
  assert.equal(tail.total, SEGMENT_SIZE + 2);
  assert.deepEqual(
    tail.records.map((r) => r.seq),
    Array.from({ length: 10 }, (_, i) => SEGMENT_SIZE - 7 + i),
  );
  assert.deepEqual(verifyTrail(tail.records, trail.publicKey), { ok: true, count: 10 });
});

test('a reopened store continues the chain across segments with the same key', async () => {
  const api = new FakeSecrets();
  const first = await Trail.open(new SecretTrailStore(api, 'aethyr-system'), clock());
  for (let i = 0; i < SEGMENT_SIZE + 1; i++) await first.append('token.issued', { peer: `p${i}` });
  const again = await Trail.open(new SecretTrailStore(api, 'aethyr-system'), clock());
  assert.equal(again.publicKey, first.publicKey);
  assert.equal(again.total, SEGMENT_SIZE + 1);
  const r = await again.append('peer.registered', { peer: 'late', algorithm: 'ML-DSA-65' });
  assert.equal(r.seq, SEGMENT_SIZE + 2);
  assert.equal(r.prev, first.head);
  assert.equal(again.verify().ok, true);
});

test('a 409 on replace fails the append instead of overwriting another writer, and the chain stays whole', async () => {
  const api = new FakeSecrets();
  const trail = await Trail.open(new SecretTrailStore(api, 'aethyr-system'), clock());
  await trail.append('token.issued', { peer: 'a' });
  api.conflictsToInject = 1;
  await assert.rejects(trail.append('token.issued', { peer: 'b' }), /conflict/);
  const c = await trail.append('token.issued', { peer: 'c' });
  assert.equal(c.seq, 2);
  const tail = await new SecretTrailStore(api, 'aethyr-system').loadTail(10);
  assert.deepEqual(
    tail.records.map((r) => r.data.peer),
    ['a', 'c'],
  );
  assert.deepEqual(verifyTrail(tail.records, trail.publicKey), { ok: true, count: 2 });
});

test('a failed index write at rollover keeps the record, warns, and the next append continues the chain', async () => {
  const api = new FakeSecrets();
  const warnings: string[] = [];
  const store = new SecretTrailStore(api, 'aethyr-system', 'aethyr-trail', (m) => warnings.push(m));
  const trail = await Trail.open(store, clock());
  for (let i = 0; i < SEGMENT_SIZE; i++) await trail.append('token.issued', { peer: `p${i}` });
  // Fail only the index write that follows the creation of segment 2.
  const origReplace = api.replaceNamespacedSecret.bind(api);
  let armed = true;
  api.replaceNamespacedSecret = async (p) => {
    if (armed && p.name === 'aethyr-trail') {
      armed = false;
      throw Object.assign(new Error('etcd timeout'), { code: 500 });
    }
    return origReplace(p);
  };
  const r = await trail.append('token.issued', { peer: 'rollover' });
  assert.equal(r.seq, SEGMENT_SIZE + 1);
  assert.equal(warnings.length, 1);
  const next = await trail.append('token.issued', { peer: 'after' });
  assert.equal(next.seq, SEGMENT_SIZE + 2);
  const fresh = await new SecretTrailStore(api, 'aethyr-system').loadTail(5);
  assert.equal(fresh.total, SEGMENT_SIZE + 2);
  assert.deepEqual(
    fresh.records.slice(-2).map((x) => x.data.peer),
    ['rollover', 'after'],
  );
  assert.deepEqual(verifyTrail(fresh.records, trail.publicKey), { ok: true, count: 5 });
});

test('a segment created before the index was updated is found on load', async () => {
  const api = new FakeSecrets();
  const store = new SecretTrailStore(api, 'aethyr-system');
  const trail = await Trail.open(store, clock());
  for (let i = 0; i < SEGMENT_SIZE + 1; i++) await trail.append('token.issued', { peer: `p${i}` });
  for (let i = 0; i < SEGMENT_SIZE; i++) await trail.append('token.issued', { peer: `q${i}` });
  // Simulate two lost index writes: the index says 1 while segments 2 and 3 exist.
  const idx = api.secrets.get('aethyr-trail');
  assert.ok(idx?.data);
  idx.data.segments = Buffer.from('1').toString('base64');
  const tail = await store.loadTail(5);
  assert.equal(tail.total, 2 * SEGMENT_SIZE + 1);
  assert.equal(tail.records.at(-1)?.seq, 2 * SEGMENT_SIZE + 1);
});

test('the seed is written once and never appears in a segment', async () => {
  const api = new FakeSecrets();
  const trail = await Trail.open(new SecretTrailStore(api, 'aethyr-system'), clock());
  await trail.append('token.issued', { peer: 'a' });
  const seed = api.secrets.get('aethyr-trail')?.data?.seed;
  assert.ok(seed);
  const seg = api.secrets.get(segmentName('aethyr-trail', 1));
  assert.equal(seg?.data?.seed, undefined);
  assert.ok(!JSON.stringify(seg).includes(seed));
});
