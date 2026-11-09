#!/usr/bin/env node
// Verify a downloaded post-quantum trail offline.
//   node demo/verify-trail.mjs pq-trail.json --key <base64 public key>
//   node demo/verify-trail.mjs pq-trail.json --key-url http://127.0.0.1:8082/trail/key
// The public key must come from a source other than the file under test: a key you fetched
// from the identity service yourself, or one you wrote down earlier. A file that carries its
// own key could be re-signed by anyone. The fingerprint printed first is sha256 of the key,
// to compare with the /trail page or /trail/key.
// Recomputes each record's canonical bytes and SHA-256, checks the chain links and sequence,
// and verifies every ML-DSA-65 signature. Mirrors apps/identity/src/trail.ts.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { ml_dsa65 } from '@noble/post-quantum/ml-dsa.js';

const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith('--'));
const keyArg = args[args.indexOf('--key') + 1];
const keyUrl = args[args.indexOf('--key-url') + 1];
if (!file || (!args.includes('--key') && !args.includes('--key-url'))) {
  console.error(
    'usage: node demo/verify-trail.mjs <pq-trail.json> --key <base64> | --key-url <url>',
  );
  console.error('The key must come from outside the file; the embedded key is not trusted.');
  process.exit(2);
}
let publicKeyB64 = keyArg;
if (args.includes('--key-url')) {
  const res = await fetch(keyUrl);
  if (!res.ok) {
    console.error(`key fetch failed: HTTP ${res.status}`);
    process.exit(2);
  }
  publicKeyB64 = (await res.json()).publicKey;
}
const pk = Buffer.from(publicKeyB64, 'base64');
const fingerprint = `sha256:${createHash('sha256').update(pk).digest('hex').slice(0, 32)}`;
console.log(`key ${fingerprint} (from ${args.includes('--key-url') ? keyUrl : '--key'})`);
const trail = JSON.parse(readFileSync(file, 'utf8'));
if (trail.publicKey && trail.publicKey !== publicKeyB64)
  console.log(
    'note: the key inside the file differs from the key supplied; the supplied key is used',
  );
const GENESIS = '0'.repeat(64);

const canonical = (r) => {
  const data = JSON.stringify(
    Object.fromEntries(Object.entries(r.data).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))),
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
