import type { CryptoPolicySpec } from '@kubecon-pq-agent/schema';
import type { Trail } from './trail.js';

export interface PolicySnapshot {
  name: string;
  kem: CryptoPolicySpec['kem'];
  signature: CryptoPolicySpec['signature'];
}

/**
 * Compare the policies seen now with the last snapshot and append trail records: one
 * `policy.observed` per policy the first time it is seen, and one `policy.rotated` whenever
 * its key exchange or signature level changes. Returns the new snapshot. Pure apart from the
 * trail append, so it is testable without a cluster.
 */
export async function recordPolicyChanges(
  trail: Trail,
  previous: ReadonlyMap<string, PolicySnapshot>,
  current: readonly PolicySnapshot[],
): Promise<Map<string, PolicySnapshot>> {
  const next = new Map<string, PolicySnapshot>();
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
