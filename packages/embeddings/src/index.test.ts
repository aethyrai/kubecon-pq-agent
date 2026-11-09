import assert from 'node:assert/strict';
import { test } from 'node:test';
import { LOCAL_EMBEDDING_DIMS, LocalEmbedder } from './index.js';

test('local embedder returns normalized 384-dim vectors and ranks related text higher', async (t) => {
  if (process.env.SKIP_MODEL_TESTS) return t.skip('model download disabled');
  const e = new LocalEmbedder();
  const [a, b, c] = await e.embed([
    'Agents that fix Kubernetes clusters automatically',
    'An AI SRE that remediates cluster incidents',
    'Baking sourdough bread at home',
  ]);
  assert.ok(a && b && c);
  assert.equal(a.length, LOCAL_EMBEDDING_DIMS);
  const norm = Math.sqrt(a.reduce((s, x) => s + x * x, 0));
  assert.ok(Math.abs(norm - 1) < 1e-3, `norm ${norm}`);
  const dot = (x: number[], y: number[]) => x.reduce((s, v, i) => s + v * (y[i] ?? 0), 0);
  assert.ok(dot(a, b) > dot(a, c), 'related texts should be closer than unrelated');
  const q = await e.embedQuery('talks about agents that fix clusters');
  assert.equal(q.length, LOCAL_EMBEDDING_DIMS);
});
