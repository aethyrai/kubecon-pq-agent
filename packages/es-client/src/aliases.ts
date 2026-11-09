import type { Client } from '@elastic/elasticsearch';
import { INDEX_NAMES, type IndexName, MAPPINGS, physicalIndexName } from './mappings.js';

export interface EnsureResult {
  alias: IndexName;
  index: string;
  created: boolean;
}

/**
 * Create `<alias>-<date>` with its mapping if it does not exist, and point the
 * alias at it. If the alias already points at another index, swap atomically.
 * Idempotent: a second run is a no-op.
 */
export async function ensureIndexBehindAlias(
  client: Client,
  alias: IndexName,
  when: Date = new Date(),
): Promise<EnsureResult> {
  const index = physicalIndexName(alias, when);
  const exists = await client.indices.exists({ index });
  if (!exists) {
    await client.indices.create({
      index,
      settings: { number_of_shards: 1, number_of_replicas: 0 },
      mappings: MAPPINGS[alias],
    });
  }
  const aliasExists = await client.indices.existsAlias({ name: alias });
  const actions: Array<Record<string, { index: string; alias: string }>> = [];
  if (aliasExists) {
    const current = await client.indices.getAlias({ name: alias });
    for (const old of Object.keys(current)) {
      if (old !== index) actions.push({ remove: { index: old, alias } });
    }
    if (!Object.hasOwn(current, index)) actions.push({ add: { index, alias } });
  } else {
    actions.push({ add: { index, alias } });
  }
  if (actions.length > 0) await client.indices.updateAliases({ actions });
  return { alias, index, created: !exists };
}

/** Apply all six indices. */
export async function ensureAllIndices(
  client: Client,
  when: Date = new Date(),
): Promise<EnsureResult[]> {
  const out: EnsureResult[] = [];
  for (const alias of INDEX_NAMES) out.push(await ensureIndexBehindAlias(client, alias, when));
  return out;
}
