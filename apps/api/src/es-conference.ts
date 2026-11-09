import type { Client } from '@elastic/elasticsearch';
import type { Embedder } from '@kubecon-pq-agent/embeddings';
import { type Hit, hybridSearch } from '@kubecon-pq-agent/es-client';
import { chaosDelay } from './chaos.js';
import type { Conference, Exhibitor, Room, Session, SideEvent } from './conference.js';

const SESSION_FIELDS = ['title^3', 'abstract', 'tags^2', 'speakers^2', 'track'];
const EXHIBITOR_FIELDS = ['name^3', 'description', 'categories^2'];

export function esConference(client: Client, embedder: Embedder): Conference {
  const vectorFor = async (text: string): Promise<number[] | undefined> => {
    if (text.trim().length === 0) return undefined;
    const v = await embedder.embedQuery(text);
    return v.length > 0 ? v : undefined;
  };
  return {
    async searchSessions(text, filters, size): Promise<Hit<Session>[]> {
      await chaosDelay();
      return hybridSearch<Session>(client, {
        index: 'sessions',
        text,
        vector: await vectorFor(text),
        textFields: SESSION_FIELDS,
        filters,
        size,
      });
    },
    async recommend(interests, filters, size): Promise<Hit<Session>[]> {
      await chaosDelay();
      // Interest text is semantic first: weight the kNN leg by giving BM25 a short query.
      return hybridSearch<Session>(client, {
        index: 'sessions',
        text: interests,
        vector: await vectorFor(interests),
        textFields: SESSION_FIELDS,
        filters,
        size,
        depth: size * 5,
      });
    },
    async schedule(day, filters): Promise<Session[]> {
      await chaosDelay();
      const hits = await hybridSearch<Session>(client, {
        index: 'sessions',
        text: '',
        textFields: SESSION_FIELDS,
        filters: { ...filters, day },
        size: 500,
        sort: [{ start: 'asc' }],
      });
      return hits.map((h) => h.source).sort((a, b) => a.start.localeCompare(b.start));
    },
    async sessionsById(ids): Promise<Session[]> {
      if (ids.length === 0) return [];
      await chaosDelay();
      const res = await client.mget<Session>({ index: 'sessions', ids });
      return res.docs.flatMap((d) => ('found' in d && d.found && d._source ? [d._source] : []));
    },
    async searchBooths(text, size): Promise<Hit<Exhibitor>[]> {
      await chaosDelay();
      return hybridSearch<Exhibitor>(client, {
        index: 'exhibitors',
        text,
        vector: await vectorFor(text),
        textFields: EXHIBITOR_FIELDS,
        size,
      });
    },
    async sideEvents(day): Promise<SideEvent[]> {
      await chaosDelay();
      const res = await client.search<SideEvent>({
        index: 'side_events',
        size: 100,
        query: day
          ? { range: { start: { gte: `${day}T00:00:00`, lt: `${day}T23:59:59` } } }
          : { match_all: {} },
        sort: [{ start: 'asc' }],
      });
      return res.hits.hits.flatMap((h) => (h._source ? [h._source] : []));
    },
    async room(id): Promise<Room | undefined> {
      await chaosDelay();
      try {
        const res = await client.get<Room>({ index: 'rooms', id });
        return res.found ? res._source : undefined;
      } catch (err) {
        if (
          typeof err === 'object' &&
          err !== null &&
          'meta' in err &&
          (err as { meta: { statusCode?: number } }).meta.statusCode === 404
        )
          return undefined;
        throw err;
      }
    },
  };
}
