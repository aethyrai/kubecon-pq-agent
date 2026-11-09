import type * as k8s from '@kubernetes/client-node';
import { isNotFound } from './store.js';
import { isTrailRecord, type TrailRecord, type TrailStore } from './trail.js';

/** Seed and records in one Secret in aethyr-system. The seed never leaves the Secret. */
export class SecretTrailStore implements TrailStore {
  constructor(
    private readonly core: k8s.CoreV1Api,
    private readonly namespace: string,
    private readonly name = 'aethyr-trail',
  ) {}

  async load(): Promise<{ seed: string | undefined; records: TrailRecord[] }> {
    try {
      const s = await this.core.readNamespacedSecret({
        name: this.name,
        namespace: this.namespace,
      });
      const d = s.data ?? {};
      const seed = d.seed ? Buffer.from(d.seed, 'base64').toString('utf8') : undefined;
      const raw: unknown = d.records
        ? JSON.parse(Buffer.from(d.records, 'base64').toString('utf8'))
        : [];
      const records = Array.isArray(raw) ? raw.filter(isTrailRecord) : [];
      return { seed, records };
    } catch (err) {
      if (isNotFound(err)) return { seed: undefined, records: [] };
      throw err;
    }
  }

  async save(seed: string, records: TrailRecord[]): Promise<void> {
    const body: k8s.V1Secret = {
      apiVersion: 'v1',
      kind: 'Secret',
      metadata: { name: this.name, namespace: this.namespace },
      type: 'Opaque',
      stringData: { seed, records: JSON.stringify(records) },
    };
    try {
      await this.core.replaceNamespacedSecret({ name: this.name, namespace: this.namespace, body });
    } catch (err) {
      if (!isNotFound(err)) throw err;
      await this.core.createNamespacedSecret({ namespace: this.namespace, body });
    }
  }
}
