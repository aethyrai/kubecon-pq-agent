import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CryptoPolicySpec, PQPeerSpec, PQTunnelSpec } from './crds.js';

test('CryptoPolicy rejects ML-KEM-512 and mismatched levels, accepts the two valid pairs', () => {
  assert.equal(
    CryptoPolicySpec.safeParse({ kem: 'ML-KEM-512', signature: 'ML-DSA-65' }).success,
    false,
  );
  assert.equal(
    CryptoPolicySpec.safeParse({ kem: 'ML-KEM-1024', signature: 'ML-DSA-65' }).success,
    false,
  );
  assert.equal(
    CryptoPolicySpec.safeParse({ kem: 'ML-KEM-768', signature: 'ML-DSA-65' }).success,
    true,
  );
  assert.equal(
    CryptoPolicySpec.safeParse({ kem: 'ML-KEM-1024', signature: 'ML-DSA-87', profile: 'cnsa2' })
      .success,
    true,
  );
  assert.equal(
    CryptoPolicySpec.safeParse({ kem: 'ML-KEM-768', signature: 'ML-DSA-65', profile: 'cnsa2' })
      .success,
    false,
  );
});

test('defaults fill hybrid, rekeyInterval, and profile', () => {
  const p = CryptoPolicySpec.parse({ kem: 'ML-KEM-768', signature: 'ML-DSA-65' });
  assert.equal(p.hybrid, 'X25519');
  assert.equal(p.rekeyInterval, '15m');
  assert.equal(p.profile, 'hackathon');
});

test('PQTunnel needs at least one upstream and defaults the listener', () => {
  assert.equal(
    PQTunnelSpec.safeParse({ policyRef: { name: 'p' }, upstreams: [], listener: {} }).success,
    false,
  );
  const t = PQTunnelSpec.parse({
    policyRef: { name: 'p' },
    upstreams: [{ service: 'api', port: 80 }],
    listener: {},
  });
  assert.equal(t.listener.port, 7443);
});

test('PQPeer defaults opt-ins to false', () => {
  const p = PQPeerSpec.parse({ publicKey: 'A'.repeat(44), algorithm: 'ML-DSA-65' });
  assert.deepEqual(p.optIns, { matchmaking: false, directory: false });
});
