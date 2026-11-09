#!/usr/bin/env node
// Verify a downloaded post-quantum trail offline.
//   node demo/verify-trail.mjs pq-trail.json
// Recomputes each record's canonical bytes and SHA-256, checks the chain links and sequence,
// and verifies every ML-DSA-65 signature against the public key inside the file. Mirrors
// apps/identity/src/trail.ts; keep the canonical format in step.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { ml_dsa65 } from '@noble/post-quantum/ml-dsa.js';

const file = process.argv[2];
if (!file) {
  console.error('usage: node demo/verify-trail.mjs <pq-trail.json>');
  process.exit(2);
}
const trail = JSON.parse(readFileSync(file, 'utf8'));
const pk = Buffer.from(trail.publicKey, 'base64');
const GENESIS = '0'.repeat(64);

const canonical = (r) => {
  const data = JSON.stringify(
    Object.fromEntries(Object.entries(r.data).sort(([a], [b]) => a.localeCompare(b))),
  );
  return `pqtrail|v1|${r.seq}|${r.at}|${r.kind}|${data}|${r.prev}`;
};

// A capped response is a window: verify from the first record's own previous hash and sequence.
const first = trail.records[0];
let prev = first ? first.prev : GENESIS;
let n = first ? first.seq - 1 : 0;
if (first && first.seq !== 1)
  console.log(
    `window: records ${first.seq}..${trail.total ?? '?'} of ${trail.total ?? '?'}, chained from ${prev.slice(0, 16)}`,
  );
for (const r of trail.records) {
  n += 1;
  const fail = (why) => {
    console.log(`BROKEN at record ${r.seq}: ${why}`);
    process.exit(1);
  };
  if (r.seq !== n) fail('sequence gap');
  if (r.prev !== prev) fail('previous hash mismatch');
  if (r.alg !== 'ML-DSA-65') fail('unexpected algorithm');
  const canon = canonical(r);
  if (createHash('sha256').update(canon).digest('hex') !== r.hash) fail('hash mismatch');
  let ok = false;
  try {
    ok = ml_dsa65.verify(Buffer.from(r.sig, 'base64'), Buffer.from(canon), pk);
  } catch {
    ok = false;
  }
  if (!ok) fail('signature invalid');
  prev = r.hash;
  console.log(`ok  #${r.seq}  ${r.at}  ${r.kind}  ${Object.values(r.data).join(' ')}`);
}
console.log(
  `INTACT: ${trail.records.length} record${trail.records.length === 1 ? '' : 's'} checked, every ML-DSA-65 signature verified, head ${prev.slice(0, 16)}`,
);
