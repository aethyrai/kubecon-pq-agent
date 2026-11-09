import assert from 'node:assert/strict';
import { test } from 'node:test';
import { formatTime } from './api.ts';
import { conflictedIds, dropFor, dropSuggestions, parseIds, toggleId } from './plan.ts';

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

test('dropSuggestions drops the lower score, else the later start, once per session', () => {
  const ids = ['a', 'b', 'c'];
  const sessions = [
    { id: 'a', start: '2026-11-10T11:00:00', score: 0.9 },
    { id: 'b', start: '2026-11-10T11:10:00', score: 0.5 },
    { id: 'c', start: '2026-11-10T11:35:00', score: 0.7 },
  ];
  const chain = [
    { a: 'a', b: 'b', overlapMinutes: 30 },
    { a: 'b', b: 'c', overlapMinutes: 5 },
  ];
  assert.deepEqual([...dropSuggestions(chain, sessions, ids)], ['b']);
  const noScores = sessions.map(({ id, start }) => ({ id, start }));
  assert.deepEqual([...dropSuggestions(chain, noScores, ids)], ['b', 'c']);
  assert.deepEqual([...dropSuggestions([], sessions, ids)], []);
});

test('dropSuggestions drops an id the plan does not know, and falls back to plan order', () => {
  const same = [
    { id: 'a', start: '2026-11-10T11:00:00' },
    { id: 'b', start: '2026-11-10T11:00:00' },
  ];
  assert.deepEqual(
    [...dropSuggestions([{ a: 'b', b: 'a', overlapMinutes: 30 }], same, ['a', 'b'])],
    ['b'],
  );
  assert.deepEqual(
    [...dropSuggestions([{ a: 'zz', b: 'a', overlapMinutes: 10 }], same, ['a'])],
    ['zz'],
  );
});

test('dropFor picks per pair, so a chain does not drag another pair into a wrong choice', () => {
  // A-B: drop B (lower score). B-C: C scores lower than B, so the pair drops C, not B.
  const sessions = [
    { id: 'a', start: '2026-11-10T11:00:00', score: 0.9 },
    { id: 'b', start: '2026-11-10T11:10:00', score: 0.5 },
    { id: 'c', start: '2026-11-10T11:35:00', score: 0.4 },
  ];
  const ids = ['a', 'b', 'c'];
  assert.equal(dropFor({ a: 'a', b: 'b', overlapMinutes: 30 }, sessions, ids), 'b');
  assert.equal(dropFor({ a: 'b', b: 'c', overlapMinutes: 5 }, sessions, ids), 'c');
  assert.deepEqual(
    [
      ...dropSuggestions(
        [
          { a: 'a', b: 'b', overlapMinutes: 30 },
          { a: 'b', b: 'c', overlapMinutes: 5 },
        ],
        sessions,
        ids,
      ),
    ],
    ['b', 'c'],
  );
});
