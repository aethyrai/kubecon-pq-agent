import assert from 'node:assert/strict';
import { test } from 'node:test';
import { formatTime } from './api.ts';
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

test('formatTime keeps the wall-clock hour regardless of the server timezone', () => {
  assert.equal(formatTime('2026-11-10T11:30:00'), '11:30 AM');
  assert.equal(formatTime('2026-11-10T00:05:00'), '12:05 AM');
  assert.equal(formatTime('2026-11-10T15:00:00'), '3:00 PM');
  assert.equal(formatTime('garbage'), 'garbage');
});
