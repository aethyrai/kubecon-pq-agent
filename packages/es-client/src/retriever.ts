import type { Client, estypes } from '@elastic/elasticsearch';
import type { IndexName } from './mappings.js';

/** Filters ride on both legs so the fused list is already constrained. */
export interface SessionFilters {
  day?: string | undefined;
  track?: string | undefined;
  level?: string | undefined;
  captioned?: boolean | undefined;
  venue?: string | undefined;
  colocated_event?: string | undefined;
}

export interface HybridQuery {
  index: IndexName;
  /** Keyword text for BM25. */
  text: string;
  /** Query vector for kNN; omit for keyword-only. */
  vector?: number[] | undefined;
  vectorField?: string | undefined;
  textFields: string[];
  filters?: SessionFilters | undefined;
  size: number;
  /** Candidate depth per leg before fusion. */
  depth?: number | undefined;
}

export interface Hit<T> {
  id: string;
  score: number;
  source: T;
  /** Which legs found it: useful on stage to show semantic-only hits. */
  legs: Array<'bm25' | 'knn'>;
}

export const RRF_K = 60;

/** Reciprocal rank fusion over ranked id lists. Pure, so it is unit-tested. */
export function rrf(
  lists: Array<{ leg: 'bm25' | 'knn'; ids: string[] }>,
  k: number = RRF_K,
): Array<{ id: string; score: number; legs: Array<'bm25' | 'knn'> }> {
  const score = new Map<string, number>();
  const legs = new Map<string, Array<'bm25' | 'knn'>>();
  for (const { leg, ids } of lists) {
    ids.forEach((id, rank) => {
      score.set(id, (score.get(id) ?? 0) + 1 / (k + rank + 1));
      legs.set(id, [...(legs.get(id) ?? []), leg]);
    });
  }
  return [...score.entries()]
    .map(([id, s]) => ({ id, score: s, legs: legs.get(id) ?? [] }))
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
}

export function filterClauses(f: SessionFilters | undefined): estypes.QueryDslQueryContainer[] {
  if (!f) return [];
  const out: estypes.QueryDslQueryContainer[] = [];
  if (f.day) out.push({ term: { day: f.day } });
  if (f.track) out.push({ term: { track: f.track } });
  if (f.level) out.push({ term: { level: f.level } });
  if (f.captioned !== undefined) out.push({ term: { captioned: f.captioned } });
  if (f.venue) out.push({ term: { venue: f.venue } });
  if (f.colocated_event) out.push({ term: { colocated_event: f.colocated_event } });
  return out;
}

export async function hybridSearch<T extends object>(
  client: Client,
  q: HybridQuery,
): Promise<Hit<T>[]> {
  const depth = q.depth ?? Math.max(q.size * 3, 30);
  const filter = filterClauses(q.filters);
  const sources = new Map<string, T>();
  const legs: Array<{ leg: 'bm25' | 'knn'; ids: string[] }> = [];

  if (q.text.trim().length > 0) {
    const res = await client.search<T>({
      index: q.index,
      size: depth,
      query: {
        bool: {
          must: [
            {
              multi_match: {
                query: q.text,
                fields: q.textFields,
                type: 'best_fields',
                fuzziness: 'AUTO',
              },
            },
          ],
          filter,
        },
      },
    });
    const ids: string[] = [];
    for (const h of res.hits.hits) {
      if (h._id && h._source) {
        ids.push(h._id);
        sources.set(h._id, h._source);
      }
    }
    legs.push({ leg: 'bm25', ids });
  }

  if (q.vector && q.vector.length > 0) {
    const res = await client.search<T>({
      index: q.index,
      size: depth,
      knn: {
        field: q.vectorField ?? 'embedding',
        query_vector: q.vector,
        k: depth,
        num_candidates: Math.max(depth * 4, 100),
        ...(filter.length > 0 ? { filter: { bool: { filter } } } : {}),
      },
    });
    const ids: string[] = [];
    for (const h of res.hits.hits) {
      if (h._id && h._source) {
        ids.push(h._id);
        sources.set(h._id, h._source);
      }
    }
    legs.push({ leg: 'knn', ids });
  }

  if (legs.length === 0) {
    // No text and no vector: a filtered listing in time order.
    const res = await client.search<T>({
      index: q.index,
      size: q.size,
      query: { bool: { filter } },
      sort: [{ start: 'asc' }] as never,
    });
    return res.hits.hits
      .filter((h) => h._id && h._source)
      .map((h) => ({ id: h._id ?? '', score: 0, source: h._source as T, legs: [] }));
  }

  return rrf(legs)
    .slice(0, q.size)
    .map((r) => ({ id: r.id, score: r.score, source: sources.get(r.id) as T, legs: r.legs }))
    .filter((h) => h.source !== undefined);
}
