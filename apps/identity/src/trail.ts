/**
 * The post-quantum trail: an append-only, hash-chained record of what the trust plane saw,
 * each record signed with ML-DSA-65 by this identity service.
 *
 * Canonical bytes per record: `pqtrail|v1|<seq>|<at>|<kind>|<data as sorted JSON>|<prev hash>`.
 * The hash is SHA-256 of those bytes. The signature is ML-DSA-65 over the same bytes.
 * The prefix is domain separation, so a record lifted from another chain cannot verify here.
 *
 * Honesty: these are signatures by our own service over our own records. They prove the
 * integrity and order of what the service recorded, not third-party attestation.
 */
import { createHash, randomBytes } from 'node:crypto';
import { ml_dsa65 } from '@noble/post-quantum/ml-dsa.js';

export const TRAIL_ALGORITHM = 'ML-DSA-65';
export const GENESIS_HASH = '0'.repeat(64);

export type TrailKind =
  | 'peer.registered'
  | 'token.issued'
  | 'token.verified'
  | 'policy.observed'
  | 'policy.rotated';

export interface TrailRecord {
  seq: number;
  at: string;
  kind: TrailKind;
  data: Record<string, string>;
  prev: string;
  hash: string;
  sig: string;
  alg: typeof TRAIL_ALGORITHM;
}

export interface TrailStore {
  load(): Promise<{ seed: string | undefined; records: TrailRecord[] }>;
  save(seed: string, records: TrailRecord[]): Promise<void>;
}

export class MemoryTrailStore implements TrailStore {
  private seed: string | undefined;
  private records: TrailRecord[] = [];
  async load(): Promise<{ seed: string | undefined; records: TrailRecord[] }> {
    return { seed: this.seed, records: [...this.records] };
  }
  async save(seed: string, records: TrailRecord[]): Promise<void> {
    this.seed = seed;
    this.records = [...records];
  }
}

/** Canonical bytes for one record. Data keys are sorted so the encoding is order-stable. */
export function canonical(r: Omit<TrailRecord, 'hash' | 'sig' | 'alg'>): string {
  const data = JSON.stringify(
    Object.fromEntries(Object.entries(r.data).sort(([a], [b]) => a.localeCompare(b))),
  );
  return `pqtrail|v1|${r.seq}|${r.at}|${r.kind}|${data}|${r.prev}`;
}

export function hashOf(canon: string): string {
  return createHash('sha256').update(canon).digest('hex');
}

export interface Verification {
  ok: boolean;
  count: number;
  /** Sequence number of the first record that fails, when ok is false. */
  brokenAt?: number;
  reason?: string;
}

/**
 * Pure verification of a chain, or of a contiguous window of one, against a public key. A
 * window starts from its first record's own previous hash and sequence; a full chain starts
 * from genesis. Used by the service and mirrored by demo/verify-trail.mjs.
 */
export function verifyTrail(records: readonly TrailRecord[], publicKeyB64: string): Verification {
  const pk = Buffer.from(publicKeyB64, 'base64');
  const first = records[0];
  let prev = first?.prev ?? GENESIS_HASH;
  const base = first ? first.seq - 1 : 0;
  for (const [i, r] of records.entries()) {
    const fail = (reason: string): Verification => ({
      ok: false,
      count: records.length,
      brokenAt: r.seq,
      reason,
    });
    if (r.seq !== base + i + 1) return fail('sequence gap');
    if (r.prev !== prev) return fail('previous hash mismatch');
    if (r.alg !== TRAIL_ALGORITHM) return fail('unexpected algorithm');
    const canon = canonical(r);
    if (hashOf(canon) !== r.hash) return fail('hash mismatch');
    let sigOk = false;
    try {
      sigOk = ml_dsa65.verify(Buffer.from(r.sig, 'base64'), Buffer.from(canon), pk);
    } catch {
      sigOk = false;
    }
    if (!sigOk) return fail('signature invalid');
    prev = r.hash;
  }
  return { ok: true, count: records.length };
}

export class Trail {
  private constructor(
    private readonly store: TrailStore,
    private readonly seed: string,
    private readonly keys: { publicKey: Uint8Array; secretKey: Uint8Array },
    private records: TrailRecord[],
    private readonly now: () => Date,
  ) {}

  /** Load the seed and records from the store, or create a fresh seed and persist it. */
  static async open(store: TrailStore, now: () => Date = () => new Date()): Promise<Trail> {
    const { seed, records } = await store.load();
    const s = seed ?? randomBytes(32).toString('base64');
    const keys = ml_dsa65.keygen(Buffer.from(s, 'base64'));
    if (!seed) await store.save(s, records);
    return new Trail(store, s, keys, records, now);
  }

  get publicKey(): string {
    return Buffer.from(this.keys.publicKey).toString('base64');
  }

  get head(): string {
    return this.records.at(-1)?.hash ?? GENESIS_HASH;
  }

  list(): TrailRecord[] {
    return [...this.records];
  }

  verify(): Verification {
    return verifyTrail(this.records, this.publicKey);
  }

  async append(kind: TrailKind, data: Record<string, string>): Promise<TrailRecord> {
    const base = {
      seq: this.records.length + 1,
      at: this.now().toISOString(),
      kind,
      data,
      prev: this.head,
    };
    const canon = canonical(base);
    const sig = ml_dsa65.sign(Buffer.from(canon), this.keys.secretKey);
    const rec: TrailRecord = {
      ...base,
      hash: hashOf(canon),
      sig: Buffer.from(sig).toString('base64'),
      alg: TRAIL_ALGORITHM,
    };
    this.records = [...this.records, rec];
    await this.store.save(this.seed, this.records);
    return rec;
  }
}

export function isTrailRecord(v: unknown): v is TrailRecord {
  if (typeof v !== 'object' || v === null) return false;
  const r = v as Record<string, unknown>;
  return (
    typeof r.seq === 'number' &&
    typeof r.at === 'string' &&
    typeof r.kind === 'string' &&
    typeof r.data === 'object' &&
    r.data !== null &&
    typeof r.prev === 'string' &&
    typeof r.hash === 'string' &&
    typeof r.sig === 'string' &&
    r.alg === TRAIL_ALGORITHM
  );
}
