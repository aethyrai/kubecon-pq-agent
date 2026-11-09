import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildApp, STUB_SESSION } from '../app.js';

const app = buildApp({ elasticsearch: async () => true });
const down = buildApp({ elasticsearch: async () => false });

test('GET /healthz is always ok', async () => {
  const res = await app.request('/healthz');
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { status: 'ok' });
});

test('GET /readyz reflects Elasticsearch', async () => {
  assert.equal((await app.request('/readyz')).status, 200);
  assert.equal((await down.request('/readyz')).status, 503);
});

test('GET /search returns the stub document', async () => {
  const res = await app.request('/search?q=agents');
  assert.equal(res.status, 200);
  const body: unknown = await res.json();
  assert.ok(typeof body === 'object' && body !== null);
  const b = body as { hits: unknown[]; stub: boolean; query: string };
  assert.equal(b.query, 'agents');
  assert.equal(b.stub, true);
  assert.deepEqual(b.hits[0], STUB_SESSION);
});

test('unknown route is a JSON 404', async () => {
  const res = await app.request('/nope');
  assert.equal(res.status, 404);
  assert.deepEqual(await res.json(), { error: 'not found' });
});
