import { mkdir, writeFile } from 'node:fs/promises';
import { embedderFromEnv } from '@kubecon-pq-agent/embeddings';
import { clientFromEnv, ensureAllIndices } from '@kubecon-pq-agent/es-client';
import { bulkUpsert } from './bulk.js';
import {
  normalizeRooms,
  normalizeSessions,
  normalizeSpeakers,
  sessionEmbeddingText,
  speakerEmbeddingText,
} from './normalize.js';
import {
  extractSchedData,
  fetchSchedulePage,
  type LfSchedData,
  loadSchedFixture,
} from './sources/lf-sched.js';

/**
 * INGEST_SOURCE=fixture (default) reads fixtures/sched/lf-sched-data-*.json.
 * INGEST_SOURCE=live fetches the LF schedule page and saves a new fixture first.
 */
async function loadSchedule(): Promise<LfSchedData> {
  const source = process.env.INGEST_SOURCE ?? 'fixture';
  const fixtureDir = process.env.FIXTURE_DIR ?? 'fixtures/sched';
  if (source === 'live') {
    const html = await fetchSchedulePage();
    const data = extractSchedData(html);
    const stamp = new Date().toISOString().slice(0, 10);
    await mkdir(fixtureDir, { recursive: true });
    await writeFile(`${fixtureDir}/lf-sched-data-${stamp}.json`, JSON.stringify(data));
    console.log(`saved fixture ${fixtureDir}/lf-sched-data-${stamp}.json`);
    return data;
  }
  const file = process.env.FIXTURE_FILE ?? `${fixtureDir}/lf-sched-data-2026-11-09.json`;
  return loadSchedFixture(file);
}

const client = clientFromEnv();
const embedder = embedderFromEnv();
await ensureAllIndices(client);

const data = await loadSchedule();
const sessions = normalizeSessions(data);
const speakers = normalizeSpeakers(data);
const rooms = normalizeRooms(data);

const sessionVectors = await embedder.embed(sessions.map(sessionEmbeddingText));
const speakerVectors = await embedder.embed(speakers.map(speakerEmbeddingText));
const withVec = <T extends { embedding?: number[] }>(docs: T[], vecs: number[][]): T[] =>
  docs.map((d, i) => {
    const v = vecs[i];
    return v && v.length > 0 ? { ...d, embedding: v } : d;
  });

const r1 = await bulkUpsert(client, 'sessions', withVec(sessions, sessionVectors));
const r2 = await bulkUpsert(client, 'speakers', withVec(speakers, speakerVectors));
const r3 = await bulkUpsert(client, 'rooms', rooms);
console.log(`sessions: ${r1.indexed} indexed, ${r1.errors} errors`);
console.log(`speakers: ${r2.indexed} indexed, ${r2.errors} errors`);
console.log(`rooms:    ${r3.indexed} indexed, ${r3.errors} errors`);
for (const alias of ['sessions', 'speakers', 'rooms'] as const) {
  const c = await client.count({ index: alias });
  console.log(`count ${alias}: ${c.count}`);
}
if (r1.errors + r2.errors + r3.errors > 0) process.exit(1);
