/**
 * The post-quantum trail: an append-only, hash-chained record of what the trust plane saw,
 * each record signed with ML-DSA-65 by this identity service.
 *
 * Canonical bytes per record: `pqtrail|v1|<seq>|<at>|<kind>|<data as sorted JSON>|<prev hash>`.
 * The hash is SHA-256 of those bytes. The signature is ML-DSA-65 over the same bytes.
 * The prefix is domain separation, so a record lifted from another chain cannot verify here.
 *
 * Storage is segmented: the store keeps the seed and an index, plus one segment per
 * SEGMENT_SIZE records, because one signature is about 4.4 KB and a Secret holds 1 MiB. The
 * service keeps only the newest window in memory; a window verifies from its first record's
 * own previous hash.
 *
 * Honesty: these are signatures by our own service over our own records. They prove the
 * integrity and order of what the service recorded, not third-party attestation.
 */
import { createHash, randomBytes } from 'node:crypto';
import { ml_dsa65 } from '@noble/post-quantum/ml-dsa.js';

export const TRAIL_ALGORITHM = 'ML-DSA-65';
export const GENESIS_HASH = '0'.repeat(64);
/** Records per storage segment. One record is about 4.8 KB; 150 keep a segment near 0.7 MiB of the 1 MiB limit. */
export const SEGMENT_SIZE = 150;
/** Most records the service keeps in memory and serves. */
export const WINDOW = 500;

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
  loadSeed(): Promise<string | undefined>;
  saveSeed(seed: string): Promise<void>;
  /** The newest records, at most `max`, in order, plus the total count stored. */
  loadTail(max: number): Promise<{ records: TrailRecord[]; total: number }>;
  /** Persist one record. Must reject, not silently drop, when the write fails. */
  append(rec: TrailRecord): Promise<void>;
}

export class MemoryTrailStore implements TrailStore {
  private seed: string | undefined;
  private records: TrailRecord[] = [];
  async loadSeed(): Promise<string | undefined> {
    return this.seed;
  }
  async saveSeed(seed: string): Promise<void> {
    this.seed = seed;
  }
  async loadTail(max: number): Promise<{ records: TrailRecord[]; total: number }> {
    return { records: this.records.slice(-max), total: this.records.length };
  }
  async append(rec: TrailRecord): Promise<void> {
    this.records.push(rec);
  }
}

/** Canonical bytes for one record. Data keys are sorted so the encoding is order-stable. */
export function canonical(r: Omit<TrailRecord, 'hash' | 'sig' | 'alg'>): string {
  // Code-point order, not locale order, so every verifier sorts the same way.
  const data = JSON.stringify(
    Object.fromEntries(Object.entries(r.data).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))),
  );
  return `pqtrail|v1|${r.seq}|${r.at}|${r.kind}|${data}|${r.prev}`;
}

export function hashOf(canon: string): string {
  return createHash('sha256').update(canon).digest('hex');
}

/** Short identifier of a public key, for a person to compare across two sources. */
export function fingerprintOf(publicKeyB64: string): string {
  return `sha256:${createHash('sha256').update(Buffer.from(publicKeyB64, 'base64')).digest('hex').slice(0, 32)}`;
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
    private readonly keys: { publicKey: Uint8Array; secretKey: Uint8Array },
    private records: TrailRecord[],
    private count: number,
    private readonly now: () => Date,
  ) {}

  /** Appends run one at a time: each waits for the previous write before reading the head. */
  private queue: Promise<unknown> = Promise.resolve();

  /** Load the seed and the newest window from the store, or create a fresh seed and persist it. */
  static async open(store: TrailStore, now: () => Date = () => new Date()): Promise<Trail> {
    let seed = await store.loadSeed();
    if (!seed) {
      seed = randomBytes(32).toString('base64');
      await store.saveSeed(seed);
    }
    const keys = ml_dsa65.keygen(Buffer.from(seed, 'base64'));
    const tail = await store.loadTail(WINDOW);
    return new Trail(store, keys, tail.records, tail.total, now);
  }

  get publicKey(): string {
    return Buffer.from(this.keys.publicKey).toString('base64');
  }

  get fingerprint(): string {
    return fingerprintOf(this.publicKey);
  }

  get head(): string {
    return this.records.at(-1)?.hash ?? GENESIS_HASH;
  }

  /** Records stored in total, including those outside the in-memory window. */
  get total(): number {
    return this.count;
  }

  /** The in-memory window, oldest first. */
  list(): TrailRecord[] {
    return [...this.records];
  }

  private verified: { head: string; result: Verification } | undefined;

  /** Verification of the in-memory window, computed once per chain head. */
  verify(): Verification {
    if (this.verified?.head === this.head && this.verified.result.count === this.records.length)
      return this.verified.result;
    const result = verifyTrail(this.records, this.publicKey);
    this.verified = { head: this.head, result };
    return result;
  }

  append(kind: TrailKind, data: Record<string, string>): Promise<TrailRecord> {
    const run = this.queue.then(() => this.appendNow(kind, data));
    this.queue = run.catch(() => undefined);
    return run;
  }

  private async appendNow(kind: TrailKind, data: Record<string, string>): Promise<TrailRecord> {
    const base = {
      seq: this.count + 1,
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
    // Persist first. The in-memory window changes only when the write succeeded, so a failed
    // write leaves the head and the count untouched for the next append.
    await this.store.append(rec);
    this.records = [...this.records, rec].slice(-WINDOW);
    this.count += 1;
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
