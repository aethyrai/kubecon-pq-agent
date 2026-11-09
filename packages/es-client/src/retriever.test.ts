import assert from 'node:assert/strict';
import { test } from 'node:test';
import { filterClauses, rrf } from './retriever.js';

test('rrf rewards documents found by both legs', () => {
  const fused = rrf([
    { leg: 'bm25', ids: ['a', 'b', 'c'] },
    { leg: 'knn', ids: ['c', 'd', 'a'] },
  ]);
  assert.deepEqual(
    fused.map((f) => f.id),
    ['a', 'c', 'b', 'd'],
  );
  assert.deepEqual(fused[0]?.legs, ['bm25', 'knn']);
  assert.deepEqual(fused[3]?.legs, ['knn']);
});

test('rrf with one leg preserves its order', () => {
  assert.deepEqual(
    rrf([{ leg: 'knn', ids: ['x', 'y'] }]).map((f) => f.id),
    ['x', 'y'],
  );
});

test('filters become term clauses and false captioned is kept', () => {
  const f = filterClauses({ day: '2026-11-10', captioned: false });
  assert.equal(f.length, 2);
  assert.deepEqual(f[1], { term: { captioned: false } });
  assert.deepEqual(filterClauses(undefined), []);
});
