import type { CryptoPolicySpec } from '@kubecon-pq-agent/schema';
import type { Trail, TrailRecord } from './trail.js';

export interface PolicySnapshot {
  name: string;
  kem: CryptoPolicySpec['kem'];
  signature: CryptoPolicySpec['signature'];
}

/**
 * The last known state of every policy, read back from the trail itself, so a restart compares
 * against what was recorded and does not re-record a policy as newly observed or miss a
 * rotation that happened while the service was down. Only the in-memory window is consulted;
 * a policy whose last record fell out of the window is treated as new.
 */
export function snapshotFromRecords(records: readonly TrailRecord[]): Map<string, PolicySnapshot> {
  const snap = new Map<string, PolicySnapshot>();
  for (const r of records) {
    const name = r.data.policy;
    if (!name) continue;
    if (r.kind === 'policy.observed' && r.data.kem && r.data.signature)
      snap.set(name, { name, kem: asKem(r.data.kem), signature: asSig(r.data.signature) });
    if (r.kind === 'policy.rotated' && r.data.toKem && r.data.toSignature)
      snap.set(name, { name, kem: asKem(r.data.toKem), signature: asSig(r.data.toSignature) });
  }
  return snap;
}

function asKem(v: string): CryptoPolicySpec['kem'] {
  return v === 'ML-KEM-1024' ? 'ML-KEM-1024' : 'ML-KEM-768';
}
function asSig(v: string): CryptoPolicySpec['signature'] {
  return v === 'ML-DSA-87' ? 'ML-DSA-87' : 'ML-DSA-65';
}

/**
 * Compare the policies seen now with the last snapshot and append trail records: one
 * `policy.observed` per policy the first time it is seen, and one `policy.rotated` whenever
 * its key exchange or signature level changes. Returns the new snapshot.
 */
export async function recordPolicyChanges(
  trail: Trail,
  previous: ReadonlyMap<string, PolicySnapshot>,
  current: readonly PolicySnapshot[],
): Promise<Map<string, PolicySnapshot>> {
  const next = new Map<string, PolicySnapshot>(previous);
  for (const p of current) {
    const was = previous.get(p.name);
    if (!was) {
      await trail.append('policy.observed', { policy: p.name, kem: p.kem, signature: p.signature });
    } else if (was.kem !== p.kem || was.signature !== p.signature) {
      await trail.append('policy.rotated', {
        policy: p.name,
        fromKem: was.kem,
        toKem: p.kem,
        fromSignature: was.signature,
        toSignature: p.signature,
      });
    }
    next.set(p.name, p);
  }
  return next;
}
