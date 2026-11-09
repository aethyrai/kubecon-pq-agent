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
  const res = await app.request('/plan/conflicts?ids=s1,s2,s2,s3,nope');
  const b = await json(res);
  assert.deepEqual(b.conflicts, [{ a: 's1', b: 's2', overlapMinutes: 15 }]);
  assert.deepEqual(b.missing, ['nope']);
  assert.equal((await app.request('/plan/conflicts?ids=')).status, 400);
});

test('GET /plan/conflicts accepts a plan with one pick', async () => {
  const res = await app.request('/plan/conflicts?ids=s1');
  assert.equal(res.status, 200);
  const b = await json(res);
  assert.deepEqual(b.conflicts, []);
  assert.equal((b.sessions as unknown[]).length, 1);
});

test('GET /plan/conflicts carries tight connections labelled as estimates', async () => {
  const b = await json(await app.request('/plan/conflicts?ids=s1,s3'));
  assert.deepEqual(b.tight, []);
  assert.equal(b.walk_basis, 'estimate');
});

test('GET /plan/next answers from the ids and the given time', async () => {
  const res = await app.request('/plan/next?ids=s1,s3,nope&now=2026-11-10T13:00');
  assert.equal(res.status, 200);
  const b = await json(res);
  assert.equal(b.state, 'free');
  assert.equal(b.now, '2026-11-10T13:00:00');
  assert.deepEqual(b.missing, ['nope']);
  assert.equal(b.free_minutes, 60);
  assert.equal(b.walk_basis, 'estimate');
  const next = b.next as { session: Record<string, unknown>; leave_by: string };
  assert.equal(next.session.id, 's3');
  assert.equal('abstract' in next.session, false);
  assert.equal(next.leave_by, '2026-11-10T14:00:00');
  assert.deepEqual(
    (b.during_gap as Array<{ id: string }>).map((l) => l.id),
    ['lunch-1'],
  );
});

test('GET /plan/next applies the from room', async () => {
  const from = encodeURIComponent('Hyatt Regency | Level 4 | Regency Ballroom B-D');
  const b = await json(await app.request(`/plan/next?ids=s3&now=2026-11-10T13:00&from=${from}`));
  assert.equal((b.next as { walk_estimate_minutes: number }).walk_estimate_minutes, 12);
});

test('GET /plan/next with only unknown ids is no_plan', async () => {
  const b = await json(await app.request('/plan/next?ids=nope&now=2026-11-10T13:00'));
  assert.equal(b.state, 'no_plan');
  assert.deepEqual(b.missing, ['nope']);
});

test('GET /plan/next rejects no ids, too many ids, and a bad time', async () => {
  assert.equal((await app.request('/plan/next')).status, 400);
  const many = Array.from({ length: 41 }, (_, i) => `x${i}`).join(',');
  assert.equal((await app.request(`/plan/next?ids=${many}`)).status, 400);
  assert.equal((await app.request('/plan/next?ids=s1&now=soon')).status, 400);
  assert.equal((await app.request('/plan/next?ids=s1&now=')).status, 400);
});

test('GET /plan/next still answers when the logistics lookup fails', async () => {
  const broken = buildApp(
    { elasticsearch: async () => true },
    {
      ...fakeConference(),
      logistics: async () => {
        throw new Error('security_exception: 403');
      },
    },
    { DEMO_MODE: 'false' },
  );
  const res = await broken.request('/plan/next?ids=s1,s3&now=2026-11-10T13:00');
  assert.equal(res.status, 200);
  const b = await json(res);
  assert.equal(b.state, 'free');
  assert.deepEqual(b.during_gap, []);
});

test('GET /plan/next defaults to the venue clock', async () => {
  const b = await json(await app.request('/plan/next?ids=s1'));
  assert.match(String(b.now), /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/);
});

test('GET /logistics filters by day, reports today, and validates the day', async () => {
  const b = await json(await app.request('/logistics?day=2026-11-10'));
  assert.equal(b.total, 1);
  assert.match(String(b.today), /^\d{4}-\d{2}-\d{2}$/);
  const none = await json(await app.request('/logistics?day=2026-11-12'));
  assert.equal(none.total, 0);
  assert.equal((await app.request('/logistics?day=2026-12-25')).status, 400);
});

test('overlaps and conflicts are pure and symmetric', () => {
  const [s1, s2, s3] = SESSIONS;
  assert.ok(s1 && s2 && s3);
  assert.equal(overlaps(s1, s2), true);
  assert.equal(overlaps(s2, s1), true);
  assert.equal(overlaps(s1, s3), false);
  assert.equal(conflicts([s1, s3]).length, 0);
});

test('POST /recommend accepts a JSON boolean captioned filter', async () => {
  const res = await app.request('/recommend', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ interests: 'agent security', filters: { captioned: true } }),
  });
  const b = await json(res);
  assert.deepEqual(b.filters, { captioned: true });
  assert.deepEqual(b.session_ids, ['s2']);
});

test('GET /booths with no query lists exhibitors', async () => {
  const b = await json(await app.request('/booths'));
  assert.equal((b.exhibitors as unknown[]).length, 1);
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
