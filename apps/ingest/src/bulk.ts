import type { Client } from '@elastic/elasticsearch';
import type { IndexName } from '@kubecon-pq-agent/es-client';
import { withSpan } from '@kubecon-pq-agent/otel';

/** Idempotent upsert of documents keyed by `id` (or `peer_id`) into an alias. */
export async function bulkUpsert<T extends { id: string }>(
  client: Client,
  index: IndexName,
  docs: T[],
): Promise<{ indexed: number; errors: number }> {
  return withSpan(
    'ingest',
    'ingest.bulk',
    { 'ingest.index': index, 'ingest.docs': docs.length },
    () => bulkUpsertInner(client, index, docs),
  );
}

async function bulkUpsertInner<T extends { id: string }>(
  client: Client,
  index: IndexName,
  docs: T[],
): Promise<{ indexed: number; errors: number }> {
  if (docs.length === 0) return { indexed: 0, errors: 0 };
  const operations = docs.flatMap((d) => [{ index: { _index: index, _id: d.id } }, d]);
  const res = await client.bulk({ operations, refresh: 'wait_for' });
  let errors = 0;
  for (const item of res.items) {
    const op = item.index;
    if (op?.error) {
      errors += 1;
      if (errors <= 3)
        console.error(`bulk error on ${index}/${op._id}: ${op.error.reason ?? op.error.type}`);
    }
  }
  return { indexed: docs.length - errors, errors };
}
