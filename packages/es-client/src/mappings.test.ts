import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  EMBEDDING_DIMS,
  INDEX_NAMES,
  MAPPINGS,
  physicalIndexName,
  VECTOR_FIELD,
} from './mappings.js';

test('seven indices, each with a strict mapping', () => {
  assert.equal(INDEX_NAMES.length, 7);
  for (const name of INDEX_NAMES) {
    assert.equal(MAPPINGS[name].dynamic, 'strict', `${name} must be strict`);
    assert.ok(MAPPINGS[name].properties, `${name} has properties`);
  }
});

test('every vector field is a 1536-dim cosine HNSW dense_vector', () => {
  for (const [name, field] of Object.entries(VECTOR_FIELD)) {
    const props = MAPPINGS[name as keyof typeof MAPPINGS].properties ?? {};
    const prop = props[field];
    assert.ok(prop && prop.type === 'dense_vector', `${name}.${field} is dense_vector`);
    if (prop.type === 'dense_vector') {
      assert.equal(prop.dims, EMBEDDING_DIMS);
      assert.ok(prop.dims === 384 || prop.dims === 1536);
      assert.equal(prop.similarity, 'cosine');
    }
  }
});

test('rooms carries no vector', () => {
  assert.equal(VECTOR_FIELD.rooms, undefined);
  const props = MAPPINGS.rooms.properties ?? {};
  for (const p of Object.values(props)) assert.notEqual(p.type, 'dense_vector');
});

test('logistics carries no vector, so it stays out of semantic search', () => {
  assert.equal(VECTOR_FIELD.logistics, undefined);
  for (const p of Object.values(MAPPINGS.logistics.properties ?? {}))
    assert.notEqual(p.type, 'dense_vector');
});

test('attendees stores only the pseudonymous peer_id as key', () => {
  const props = MAPPINGS.attendees.properties ?? {};
  assert.equal(props.peer_id?.type, 'keyword');
  assert.equal('email' in props, false);
  assert.equal('name' in props, false);
});

test('physical index name is alias-yyyymmdd in UTC', () => {
  assert.equal(
    physicalIndexName('sessions', new Date('2026-11-09T23:59:00Z')),
    'sessions-20261109',
  );
});
