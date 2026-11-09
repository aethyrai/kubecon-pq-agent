export { ensureAllIndices, ensureIndexBehindAlias } from './aliases.js';
export { clientFromEnv } from './client.js';
export type { IndexName } from './mappings.js';
export {
  EMBEDDING_DIMS,
  INDEX_NAMES,
  MAPPINGS,
  physicalIndexName,
  VECTOR_FIELD,
} from './mappings.js';
export type { Hit, HybridQuery, SessionFilters } from './retriever.js';
export { filterClauses, hybridSearch, RRF_K, rrf } from './retriever.js';
