import type * as k8s from '@kubernetes/client-node';
import type { TokenRecord } from './tokens.js';

/** Token records keyed by token hash. In-cluster: one Secret in aethyr-system. */
export interface TokenStore {
  get(hash: string): Promise<TokenRecord | undefined>;
  put(hash: string, rec: TokenRecord): Promise<void>;
}

export class MemoryTokenStore implements TokenStore {
  private readonly m = new Map<string, TokenRecord>();
  async get(hash: string): Promise<TokenRecord | undefined> {
    return this.m.get(hash);
  }
  async put(hash: string, rec: TokenRecord): Promise<void> {
    this.m.set(hash, rec);
  }
}

export class SecretTokenStore implements TokenStore {
  constructor(
    private readonly core: k8s.CoreV1Api,
    private readonly namespace: string,
    private readonly name = 'aethyr-peer-tokens',
  ) {}

  private async read(): Promise<{ data: Record<string, string>; exists: boolean }> {
    try {
      const s = await this.core.readNamespacedSecret({
        name: this.name,
        namespace: this.namespace,
      });
      const data: Record<string, string> = {};
      for (const [k, v] of Object.entries(s.data ?? {}))
        data[k] = Buffer.from(v, 'base64').toString('utf8');
      return { data, exists: true };
    } catch (err) {
      if (isNotFound(err)) return { data: {}, exists: false };
      throw err;
    }
  }

  async get(hash: string): Promise<TokenRecord | undefined> {
    const { data } = await this.read();
    const raw = data[hash];
    if (!raw) return undefined;
    const parsed: unknown = JSON.parse(raw);
    return isTokenRecord(parsed) ? parsed : undefined;
  }

  async put(hash: string, rec: TokenRecord): Promise<void> {
    const { data, exists } = await this.read();
    data[hash] = JSON.stringify(rec);
    const body: k8s.V1Secret = {
      apiVersion: 'v1',
      kind: 'Secret',
      metadata: { name: this.name, namespace: this.namespace },
      type: 'Opaque',
      stringData: data,
    };
    if (exists)
      await this.core.replaceNamespacedSecret({ name: this.name, namespace: this.namespace, body });
    else await this.core.createNamespacedSecret({ namespace: this.namespace, body });
  }
}

function isTokenRecord(v: unknown): v is TokenRecord {
  return (
    typeof v === 'object' &&
    v !== null &&
    typeof (v as TokenRecord).peerId === 'string' &&
    typeof (v as TokenRecord).expiresAt === 'string'
  );
}

export function isNotFound(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code: unknown }).code === 404
  );
}
