import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseMode } from './mode.ts';

test('parseMode falls back to full', () => {
  assert.equal(parseMode(undefined), 'full');
  assert.equal(parseMode('nope'), 'full');
  assert.equal(parseMode('text'), 'text');
  assert.equal(parseMode(['reader', 'full']), 'reader');
});
