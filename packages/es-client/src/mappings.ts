import type { estypes } from '@elastic/elasticsearch';

/** Dimension of BAAI/bge-small-en-v1.5, the default local embedder. OpenAI text-embedding-3-small needs 1536. */
export const EMBEDDING_DIMS = Number(process.env.EMBEDDING_DIMS ?? 384);

export const INDEX_NAMES = [
  'sessions',
  'speakers',
  'exhibitors',
  'side_events',
  'rooms',
  'attendees',
  'logistics',
] as const;

export type IndexName = (typeof INDEX_NAMES)[number];

const text = (): estypes.MappingProperty => ({ type: 'text' });
const keyword = (): estypes.MappingProperty => ({ type: 'keyword' });
const textWithKeyword = (): estypes.MappingProperty => ({
  type: 'text',
  fields: { keyword: { type: 'keyword', ignore_above: 512 } },
});
const date = (): estypes.MappingProperty => ({ type: 'date' });
const bool = (): estypes.MappingProperty => ({ type: 'boolean' });
const integer = (): estypes.MappingProperty => ({ type: 'integer' });
const embedding = (): estypes.MappingProperty => ({
  type: 'dense_vector',
  dims: EMBEDDING_DIMS,
  index: true,
  similarity: 'cosine',
  index_options: { type: 'hnsw', m: 16, ef_construction: 100 },
});

/** One mapping per index, from the Component Spec data model. */
export const MAPPINGS: Record<IndexName, estypes.MappingTypeMapping> = {
  sessions: {
    dynamic: 'strict',
    properties: {
      id: keyword(),
      title: textWithKeyword(),
      abstract: text(),
      speakers: keyword(),
      track: keyword(),
      level: keyword(),
      day: date(),
      start: date(),
      end: date(),
      room: keyword(),
      venue: keyword(),
      colocated_event: keyword(),
      tags: keyword(),
      captioned: bool(),
      recorded: bool(),
      url: keyword(),
      embedding: embedding(),
    },
  },
  speakers: {
    dynamic: 'strict',
    properties: {
      id: keyword(),
      name: textWithKeyword(),
      org: keyword(),
      bio: text(),
      session_ids: keyword(),
      topics: keyword(),
      embedding: embedding(),
    },
  },
  exhibitors: {
    dynamic: 'strict',
    properties: {
      id: keyword(),
      name: textWithKeyword(),
      booth: keyword(),
      tier: keyword(),
      description: text(),
      categories: keyword(),
      hall: keyword(),
      url: keyword(),
      embedding: embedding(),
    },
  },
  side_events: {
    dynamic: 'strict',
    properties: {
      id: keyword(),
      name: textWithKeyword(),
      host: keyword(),
      start: date(),
      end: date(),
      address: text(),
      geo: { type: 'geo_point' },
      rsvp_url: keyword(),
      capacity_note: text(),
      description: text(),
      badge_required: bool(),
      accessibility_note: text(),
      embedding: embedding(),
    },
  },
  rooms: {
    dynamic: 'strict',
    properties: {
      id: keyword(),
      venue: keyword(),
      level: keyword(),
      name: textWithKeyword(),
      capacity: integer(),
      wheelchair_route: text(),
      captioning: keyword(),
      hearing_loop: bool(),
      quiet_room_nearby: keyword(),
      nearest_accessible_restroom: text(),
    },
  },
  attendees: {
    dynamic: 'strict',
    properties: {
      peer_id: keyword(),
      topics: keyword(),
      saved_session_ids: keyword(),
      opt_matchmaking: bool(),
      opt_directory: bool(),
      display_name: keyword(),
      free_slots: { type: 'date_range' },
      updated_at: date(),
      interest_embedding: embedding(),
    },
  },
  logistics: {
    dynamic: 'strict',
    properties: {
      id: keyword(),
      kind: keyword(),
      title: textWithKeyword(),
      day: date(),
      start: date(),
      end: date(),
      room: keyword(),
      venue: keyword(),
    },
  },
};

/** Indices that carry a vector field, and the name of that field. */
export const VECTOR_FIELD: Partial<Record<IndexName, string>> = {
  sessions: 'embedding',
  speakers: 'embedding',
  exhibitors: 'embedding',
  side_events: 'embedding',
  attendees: 'interest_embedding',
};

/** Physical index name behind an alias: `<alias>-<yyyymmdd>`. */
export function physicalIndexName(alias: IndexName, when: Date = new Date()): string {
  const y = when.getUTCFullYear();
  const m = String(when.getUTCMonth() + 1).padStart(2, '0');
  const d = String(when.getUTCDate()).padStart(2, '0');
  return `${alias}-${y}${m}${d}`;
}
