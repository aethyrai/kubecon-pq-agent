import type * as k8s from '@kubernetes/client-node';
import { isConflict, isNotFound } from './store.js';
import { isTrailRecord, SEGMENT_SIZE, type TrailRecord, type TrailStore } from './trail.js';

/** The slice of CoreV1Api this store uses, so tests can fake it without a cluster. */
export interface SecretApi {
  readNamespacedSecret(p: { name: string; namespace: string }): Promise<k8s.V1Secret>;
  createNamespacedSecret(p: { namespace: string; body: k8s.V1Secret }): Promise<k8s.V1Secret>;
  replaceNamespacedSecret(p: {
    name: string;
    namespace: string;
    body: k8s.V1Secret;
  }): Promise<k8s.V1Secret>;
}

export function segmentName(prefix: string, n: number): string {
  return `${prefix}-${String(n).padStart(5, '0')}`;
}

/**
 * Seed and index in one Secret (`aethyr-trail`: keys `seed`, `segments`), records in numbered
 * segment Secrets (`aethyr-trail-00001`, ...) of SEGMENT_SIZE records each. No list permission
 * is needed: the index names the newest segment, and load also probes the next one in case a
 * crash landed between creating a segment and updating the index. Writes carry the Secret's
 * resourceVersion and retry on 409, so a concurrent writer cannot silently drop a record.
 */
export class SecretTrailStore implements TrailStore {
  constructor(
    private readonly core: SecretApi,
    private readonly namespace: string,
    private readonly prefix = 'aethyr-trail',
  ) {}

  private async read(name: string): Promise<k8s.V1Secret | undefined> {
    try {
      return await this.core.readNamespacedSecret({ name, namespace: this.namespace });
    } catch (err) {
      if (isNotFound(err)) return undefined;
      throw err;
    }
  }

  private static field(s: k8s.V1Secret | undefined, key: string): string | undefined {
    const v = s?.data?.[key];
    return v === undefined ? undefined : Buffer.from(v, 'base64').toString('utf8');
  }

  private static records(s: k8s.V1Secret | undefined): TrailRecord[] {
    const raw = SecretTrailStore.field(s, 'records');
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isTrailRecord) : [];
  }

  /** Replace when the Secret exists, create when it does not, retrying a 409 from a fresh read. */
  private async write(name: string, data: Record<string, string>, attempt = 0): Promise<void> {
    const current = await this.read(name);
    const body: k8s.V1Secret = {
      apiVersion: 'v1',
      kind: 'Secret',
      metadata: {
        name,
        namespace: this.namespace,
        ...(current?.metadata?.resourceVersion
          ? { resourceVersion: current.metadata.resourceVersion }
          : {}),
      },
      type: 'Opaque',
      stringData: data,
    };
    try {
      if (current)
        await this.core.replaceNamespacedSecret({ name, namespace: this.namespace, body });
      else await this.core.createNamespacedSecret({ namespace: this.namespace, body });
    } catch (err) {
      if (isConflict(err) && attempt < 3) return this.write(name, data, attempt + 1);
      throw err;
    }
  }

  async loadSeed(): Promise<string | undefined> {
    return SecretTrailStore.field(await this.read(this.prefix), 'seed');
  }

  async saveSeed(seed: string): Promise<void> {
    const index = await this.read(this.prefix);
    const segments = SecretTrailStore.field(index, 'segments') ?? '0';
    await this.write(this.prefix, { seed, segments });
  }

  /** The newest segment number, probing one past the index in case the index write was lost. */
  private async newestSegment(): Promise<{ n: number; records: TrailRecord[] }> {
    const index = await this.read(this.prefix);
    let n = Number(SecretTrailStore.field(index, 'segments') ?? '0');
    if (n === 0) return { n: 0, records: [] };
    const probe = await this.read(segmentName(this.prefix, n + 1));
    if (probe) n += 1;
    const seg = probe ?? (await this.read(segmentName(this.prefix, n)));
    return { n, records: SecretTrailStore.records(seg) };
  }

  async loadTail(max: number): Promise<{ records: TrailRecord[]; total: number }> {
    const newest = await this.newestSegment();
    if (newest.n === 0) return { records: [], total: 0 };
    let records = newest.records;
    let n = newest.n;
    while (records.length < max && n > 1) {
      n -= 1;
      records = [
        ...SecretTrailStore.records(await this.read(segmentName(this.prefix, n))),
        ...records,
      ];
    }
    const total = (newest.n - 1) * SEGMENT_SIZE + newest.records.length;
    return { records: records.slice(-max), total };
  }

  async append(rec: TrailRecord): Promise<void> {
    const newest = await this.newestSegment();
    const full = newest.n === 0 || newest.records.length >= SEGMENT_SIZE;
    const n = full ? newest.n + 1 : newest.n;
    const records = full ? [rec] : [...newest.records, rec];
    await this.write(segmentName(this.prefix, n), { records: JSON.stringify(records) });
    if (full) {
      const seed = (await this.loadSeed()) ?? '';
      await this.write(this.prefix, { seed, segments: String(n) });
    }
  }
}
