import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildApp } from '../app.js';
import { chaos } from '../chaos.js';

const TOKEN = 'test-chaos-token-0123456789';
const on = buildApp({ elasticsearch: async () => true }, { DEMO_MODE: 'true', CHAOS_TOKEN: TOKEN });
const off = buildApp(
  { elasticsearch: async () => true },
  { DEMO_MODE: 'false', CHAOS_TOKEN: TOKEN },
);

test('chaos routes are invisible without DEMO_MODE', async () => {
  const res = await off.request('/chaos/es-latency?ms=10', {
    method: 'POST',
    headers: { 'x-chaos-token': TOKEN },
  });
  assert.equal(res.status, 404);
});

test('chaos routes need the token', async () => {
  assert.equal((await on.request('/chaos/status')).status, 403);
  assert.equal(
    (await on.request('/chaos/status', { headers: { 'x-chaos-token': 'wrong' } })).status,
    403,
  );
});

test('es-latency slows /search and reset clears it', async () => {
  const h = { 'x-chaos-token': TOKEN };
  assert.equal(
    (await on.request('/chaos/es-latency?ms=120', { method: 'POST', headers: h })).status,
    200,
  );
  assert.equal(chaos.esLatencyMs, 120);
  const t0 = Date.now();
  await on.request('/search?q=x');
  assert.ok(Date.now() - t0 >= 100, 'search should be delayed');
  assert.equal((await on.request('/chaos/reset', { method: 'POST', headers: h })).status, 200);
  assert.equal(chaos.esLatencyMs, 0);
  const t1 = Date.now();
  await on.request('/search?q=x');
  assert.ok(Date.now() - t1 < 100, 'search should be fast again');
});

test('es-latency rejects out-of-range values', async () => {
  const res = await on.request('/chaos/es-latency?ms=99999', {
    method: 'POST',
    headers: { 'x-chaos-token': TOKEN },
  });
  assert.equal(res.status, 400);
});
