import { mkdir, writeFile } from 'node:fs/promises';
import { embedderFromEnv } from '@kubecon-pq-agent/embeddings';
import { clientFromEnv, ensureAllIndices } from '@kubecon-pq-agent/es-client';
import { bulkUpsert } from './bulk.js';
import {
  normalizeLogistics,
  normalizeRooms,
  normalizeSessions,
  normalizeSpeakers,
  sessionEmbeddingText,
  speakerEmbeddingText,
} from './normalize.js';
import {
  fetchColoc,
  LF_COLOC_CNCF_URL,
  LF_COLOC_SPONSOR_URL,
  loadColocFixture,
  sessionsFromCncfHosted,
  sideEventsFromSponsorHosted,
} from './sources/lf-coloc.js';
import {
  extractSchedData,
  fetchSchedulePage,
  type LfSchedData,
  loadSchedFixture,
} from './sources/lf-sched.js';
import {
  fetchSponsorDirectory,
  loadSponsorFixture,
  parseSponsorDirectory,
} from './sources/lf-sponsors.js';

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

const live = (process.env.INGEST_SOURCE ?? 'fixture') === 'live';
const lfDir = process.env.LF_FIXTURE_DIR ?? 'fixtures/lf';
const data = await loadSchedule();
const colocSponsor = live
  ? await fetchColoc(LF_COLOC_SPONSOR_URL)
  : await loadColocFixture(`${lfDir}/coloc-sponsor-hosted-2026-11-09.html`);
const colocCncf = live
  ? await fetchColoc(LF_COLOC_CNCF_URL)
  : await loadColocFixture(`${lfDir}/coloc-cncf-hosted-2026-11-09.html`);
const exhibitors = live
  ? parseSponsorDirectory(await fetchSponsorDirectory())
  : await loadSponsorFixture(`${lfDir}/sponsor-directory-2026-11-09.html`);
const sideEvents = sideEventsFromSponsorHosted(colocSponsor);
const sessions = [...normalizeSessions(data), ...sessionsFromCncfHosted(colocCncf)];
const speakers = normalizeSpeakers(data);
const rooms = normalizeRooms(data);

const sessionVectors = await embedder.embed(sessions.map(sessionEmbeddingText));
const speakerVectors = await embedder.embed(speakers.map(speakerEmbeddingText));
const exhibitorVectors = await embedder.embed(
  exhibitors.map((e) => [e.name, e.description, e.categories.join(', ')].join('\n')),
);
const sideEventVectors = await embedder.embed(
  sideEvents.map((e) => [e.name, e.description].join('\n')),
);
const withVec = <T extends { embedding?: number[] }>(docs: T[], vecs: number[][]): T[] =>
  docs.map((d, i) => {
    const v = vecs[i];
    return v && v.length > 0 ? { ...d, embedding: v } : d;
  });

const r1 = await bulkUpsert(client, 'sessions', withVec(sessions, sessionVectors));
const r2 = await bulkUpsert(client, 'speakers', withVec(speakers, speakerVectors));
const r3 = await bulkUpsert(client, 'rooms', rooms);
const r4 = await bulkUpsert(client, 'exhibitors', withVec(exhibitors, exhibitorVectors));
const r5 = await bulkUpsert(client, 'side_events', withVec(sideEvents, sideEventVectors));
const r6 = await bulkUpsert(client, 'logistics', normalizeLogistics(data));
const results = {
  sessions: r1,
  speakers: r2,
  rooms: r3,
  exhibitors: r4,
  side_events: r5,
  logistics: r6,
};
for (const [name, r] of Object.entries(results))
  console.log(`${name.padEnd(12)} ${r.indexed} indexed, ${r.errors} errors`);
for (const alias of [
  'sessions',
  'speakers',
  'rooms',
  'exhibitors',
  'side_events',
  'logistics',
] as const) {
  const c = await client.count({ index: alias });
  console.log(`count ${alias}: ${c.count}`);
}
if (Object.values(results).some((r) => r.errors > 0)) process.exit(1);
