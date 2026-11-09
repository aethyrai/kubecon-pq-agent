import assert from 'node:assert/strict';
import { test } from 'node:test';
import { conflictedIds, parseIds, toggleId } from './plan.ts';

test('parseIds trims, splits, and de-duplicates', () => {
  assert.deepEqual(parseIds(' a, b ,a,,c'), ['a', 'b', 'c']);
  assert.deepEqual(parseIds(['a', 'b']), ['a', 'b']);
  assert.deepEqual(parseIds(undefined), []);
});

test('conflictedIds collects both sides of every conflict', () => {
  assert.deepEqual([...conflictedIds([{ a: 'x', b: 'y', overlapMinutes: 5 }])].sort(), ['x', 'y']);
});

test('toggleId adds or removes', () => {
  assert.equal(toggleId(['a'], 'b'), 'a,b');
  assert.equal(toggleId(['a', 'b'], 'a'), 'b');
});
