import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildApp } from '../app.js';
import { conflicts, overlaps } from '../conference.js';
import { fakeConference, SESSIONS } from './fake-conference.js';

const conf = fakeConference();
const app = buildApp({ elasticsearch: async () => true }, conf, { DEMO_MODE: 'false' });
const down = buildApp({ elasticsearch: async () => false }, conf, { DEMO_MODE: 'false' });
const json = async (res: Response): Promise<Record<string, unknown>> =>
  (await res.json()) as Record<string, unknown>;

test('health and readiness', async () => {
  assert.equal((await app.request('/healthz')).status, 200);
  assert.equal((await app.request('/readyz')).status, 200);
  assert.equal((await down.request('/readyz')).status, 503);
});

test('GET /search returns cards without abstracts and passes filters through', async () => {
  const res = await app.request('/search?q=agents&day=2026-11-10&captioned=true');
  assert.equal(res.status, 200);
  const b = await json(res);
  const hits = b.hits as Array<Record<string, unknown>>;
  assert.equal(hits.length, 1);
  assert.equal(hits[0]?.id, 's2');
  assert.equal('abstract' in (hits[0] ?? {}), false);
  assert.deepEqual(b.filters, { day: '2026-11-10', captioned: true });
});

test('POST /recommend echoes session ids for chips and rejects short input', async () => {
  const res = await app.request('/recommend?size=2', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ interests: 'agents that fix clusters', filters: { day: '2026-11-10' } }),
  });
  assert.equal(res.status, 200);
  const b = await json(res);
  assert.deepEqual(b.session_ids, ['s1', 's2']);
  const bad = await app.request('/recommend', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ interests: 'ab' }),
  });
  assert.equal(bad.status, 400);
});

test('GET /schedule/:day validates the day and sorts by start', async () => {
  const res = await app.request('/schedule/2026-11-10');
  const b = await json(res);
  assert.deepEqual(
    (b.sessions as Array<{ id: string }>).map((s) => s.id),
    ['s1', 's2', 's3'],
  );
  assert.equal((await app.request('/schedule/2026-12-25')).status, 400);
});

test('GET /plan/conflicts finds the overlapping pair and reports missing ids', async () => {
  const res = await app.request('/plan/conflicts?ids=s1,s2,s3,nope');
  const b = await json(res);
  assert.deepEqual(b.conflicts, [{ a: 's1', b: 's2', overlapMinutes: 15 }]);
  assert.deepEqual(b.missing, ['nope']);
  assert.equal((await app.request('/plan/conflicts?ids=s1')).status, 400);
});

test('overlaps and conflicts are pure and symmetric', () => {
  const [s1, s2, s3] = SESSIONS;
  assert.ok(s1 && s2 && s3);
  assert.equal(overlaps(s1, s2), true);
  assert.equal(overlaps(s2, s1), true);
  assert.equal(overlaps(s1, s3), false);
  assert.equal(conflicts([s1, s3]).length, 0);
});

test('booths, side events, and room access', async () => {
  const booths = await json(await app.request('/booths?q=observability'));
  assert.equal((booths.exhibitors as Array<{ booth: string }>)[0]?.booth, '203');
  const ev = await json(await app.request('/side-events?day=2026-11-08'));
  assert.equal(ev.total, 1);
  assert.equal((await app.request('/side-events?day=bad')).status, 400);
  const room = await json(await app.request('/rooms/82949/access'));
  assert.equal((room.facts as string[]).length, 5);
  assert.equal((await app.request('/rooms/0/access')).status, 404);
});

test('unknown route is a JSON 404', async () => {
  assert.deepEqual(await json(await app.request('/nope')), { error: 'not found' });
});
