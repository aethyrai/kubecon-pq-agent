import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { CryptoPolicy, PQPeer, PQTunnel } from '@kubecon-pq-agent/schema';
import {
  renderAllowlist,
  renderGatewayConfig,
  renderTunnel,
  SENTINEL_DID,
  upstreamAddress,
} from '../render.js';

const policy768: CryptoPolicy = {
  apiVersion: 'aethyr.io/v1alpha1',
  kind: 'CryptoPolicy',
  metadata: { name: 'hackathon' },
  spec: {
    kem: 'ML-KEM-768',
    hybrid: 'X25519',
    signature: 'ML-DSA-65',
    rekeyInterval: '15m',
    profile: 'hackathon',
  },
};
const policy1024: CryptoPolicy = {
  ...policy768,
  metadata: { name: 'cnsa2' },
  spec: { ...policy768.spec, kem: 'ML-KEM-1024', signature: 'ML-DSA-87', profile: 'cnsa2' },
};
const tunnel: PQTunnel = {
  apiVersion: 'aethyr.io/v1alpha1',
  kind: 'PQTunnel',
  metadata: { name: 'api', namespace: 'conf' },
  spec: {
    listener: { port: 7443, protocol: 'TCP' },
    policyRef: { name: 'hackathon' },
    upstreams: [{ service: 'api', port: 80 }],
  },
};
const peer = (name: string, admitted: boolean, did?: string): PQPeer => ({
  apiVersion: 'aethyr.io/v1alpha1',
  kind: 'PQPeer',
  metadata: { name, namespace: 'aethyr-system' },
  spec: {
    publicKey: 'A'.repeat(44),
    algorithm: 'ML-DSA-65',
    optIns: { matchmaking: false, directory: false },
    ...(did ? { did } : {}),
  },
  status: { admitted },
});

test('renderTunnel maps a PQTunnel and policy to a responder config at level 3', () => {
  const t = renderTunnel(tunnel, policy768);
  assert.equal(t.role, 'responder');
  assert.equal(t.listen, '0.0.0.0:7443');
  assert.equal(t.target, 'api.conf.svc:80');
  assert.equal(t.signature, 'ML-DSA-65');
  assert.equal(t.fips_transport, false);
  assert.equal(t.handshake_version, 2);
});

test('a policy change to ML-KEM-1024 flips the identity level and the config hash', () => {
  const a = renderGatewayConfig([tunnel], [policy768], []);
  const b = renderGatewayConfig([tunnel], [{ ...policy1024, metadata: { name: 'hackathon' } }], []);
  assert.notEqual(a.hash, b.hash);
  assert.match(b.data['tunnel-api.json'] ?? '', /"signature": "ML-DSA-87"/);
  assert.match(b.data['tunnel-api.json'] ?? '', /"fips_transport": true/);
});

test('a tunnel whose policy is missing is left out, and the hash is stable across runs', () => {
  const missing: PQTunnel = {
    ...tunnel,
    metadata: { name: 'mcp', namespace: 'conf' },
    spec: { ...tunnel.spec, policyRef: { name: 'nope' } },
  };
  const a = renderGatewayConfig([tunnel, missing], [policy768], []);
  assert.equal('tunnel-mcp.json' in a.data, false);
  assert.equal(a.hash, renderGatewayConfig([missing, tunnel], [policy768], []).hash);
});

test('allowlist contains only admitted peers that have a DID, sorted', () => {
  const list = renderAllowlist([
    peer('b', true, 'did:aethyr:device:zb'),
    peer('a', true, 'did:aethyr:device:za'),
    peer('c', false, 'did:aethyr:device:zc'),
    peer('d', true),
  ]);
  const lines = list.trim().split('\n').slice(1);
  assert.deepEqual(
    lines.map((l) => l.split(' ')[0]),
    ['did:aethyr:device:za', 'did:aethyr:device:zb'],
  );
});

test('upstreamAddress accepts namespace/name', () => {
  assert.equal(upstreamAddress('mcp-server', 80, 'conf'), 'mcp-server.conf.svc:80');
  assert.equal(upstreamAddress('other/api', 8080, 'conf'), 'api.other.svc:8080');
});
