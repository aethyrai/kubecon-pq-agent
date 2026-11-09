import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  normalizeRooms,
  normalizeSessions,
  normalizeSpeakers,
  parseRoomName,
  stripHtml,
} from '../normalize.js';
import { loadSchedFixture } from '../sources/lf-sched.js';

const FIXTURE = new URL('../../../../fixtures/sched/lf-sched-data-2026-11-09.json', import.meta.url)
  .pathname;
const data = await loadSchedFixture(FIXTURE);

test('fixture normalizes to more than 200 sessions with the required fields', () => {
  const sessions = normalizeSessions(data);
  assert.ok(sessions.length > 200, `got ${sessions.length}`);
  for (const s of sessions.slice(0, 50)) {
    assert.ok(
      s.id && s.title && s.start && s.end && s.day,
      `session ${s.id} is missing a core field`,
    );
    assert.match(s.day, /^2026-11-\d\d$/);
    assert.ok(s.url.endsWith(s.id));
  }
});

test('service sessions such as registration are not talks', () => {
  const sessions = normalizeSessions(data);
  assert.equal(
    sessions.some((s) => /registration \+ badge/i.test(s.title)),
    false,
  );
});

test('every room in the schedule becomes a room document', () => {
  const rooms = normalizeRooms(data);
  assert.equal(rooms.length, data.all.rooms.length);
  const usedRoomIds = new Set(data.all.sessions.map((s) => s.roomId).filter((r) => r !== null));
  const roomIds = new Set(rooms.map((r) => Number(r.id)));
  for (const id of usedRoomIds) assert.ok(roomIds.has(id), `room ${id} missing`);
});

test('tracks and levels come from the categories, not from the title', () => {
  const sessions = normalizeSessions(data);
  const tracked = sessions.filter((s) => s.track.length > 0);
  assert.ok(tracked.length > 150, `only ${tracked.length} sessions carry a track`);
  const levels = new Set(sessions.map((s) => s.level));
  assert.ok(levels.has('Beginner') || levels.has('Advanced'));
});

test('speakers link back to real sessions and carry an org', () => {
  const speakers = normalizeSpeakers(data);
  assert.ok(speakers.length > 300);
  const ids = new Set(data.all.sessions.map((s) => s.id));
  for (const sp of speakers.slice(0, 50)) for (const sid of sp.session_ids) assert.ok(ids.has(sid));
  assert.ok(speakers.filter((s) => s.org.length > 0).length > speakers.length / 2);
});

test('parseRoomName splits venue, level, and name', () => {
  assert.deepEqual(parseRoomName('Salt Palace | Level 1 | Grand Ballroom BDF'), {
    venue: 'Salt Palace',
    level: 'Level 1',
    name: 'Grand Ballroom BDF',
  });
  assert.deepEqual(parseRoomName('Off-Site Location'), {
    venue: 'Off-Site Location',
    level: '',
    name: 'Off-Site Location',
  });
});

test('stripHtml removes tags and decodes entities', () => {
  assert.equal(
    stripHtml('<p>Karpenter &amp; friends</p><p>line two</p>'),
    'Karpenter & friends\nline two',
  );
});
