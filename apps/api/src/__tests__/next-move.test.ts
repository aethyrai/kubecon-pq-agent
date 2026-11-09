import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { LogisticsItem } from '../conference.js';
import { nextMove, parseLocalTime, tightConnections, venueNow, walkMinutes } from '../next-move.js';
import { S } from './fake-conference.js';

const L1A = 'Salt Palace | Level 1 | Grand Ballroom BDF';
const L1B = 'Salt Palace | Level 1 | Grand Ballroom GI';
const L2 = 'Salt Palace | Level 2 | 250 A-C';
const HYATT = 'Hyatt Regency | Level 4 | Regency Ballroom B-D';
const OFF = 'Off-Site Location';

const lunch: LogisticsItem = {
  id: 'l1',
  kind: 'lunch',
  title: 'Lunch',
  day: '2026-11-10',
  start: '2026-11-10T12:50:00',
  end: '2026-11-10T14:50:00',
  room: L1A,
  venue: 'Salt Palace',
};
const registration: LogisticsItem = {
  ...lunch,
  id: 'r1',
  kind: 'registration',
  title: 'Registration + Badge Pick-Up',
  start: '2026-11-10T07:30:00',
  end: '2026-11-10T18:00:00',
};

const morning = S('a', '2026-11-10T11:00:00', '2026-11-10T11:30:00', { room: L1A });
const afternoon = S('b', '2026-11-10T14:00:00', '2026-11-10T14:30:00', { room: L2 });
const nextDay = S('c', '2026-11-11T09:00:00', '2026-11-11T09:30:00', { room: L1A });

test('walkMinutes grades rooms by distance and refuses to guess off-site', () => {
  assert.equal(walkMinutes(L1A, L1A), 0);
  assert.equal(walkMinutes(L1A, L1B), 5);
  assert.equal(walkMinutes(L1A, L2), 8);
  assert.equal(walkMinutes(L1A, HYATT), 12);
  assert.equal(walkMinutes(L1A, OFF), null);
  assert.equal(walkMinutes(OFF, OFF), null);
  assert.equal(walkMinutes('', L1A), null);
});

test('walkMinutes treats a room with no level as another level', () => {
  assert.equal(walkMinutes('Salt Palace | 200 South Entrance (South)', L1A), 8);
});

test('venueNow is Mountain wall-clock time without an offset', () => {
  assert.equal(venueNow(new Date('2026-11-10T18:30:05Z')), '2026-11-10T11:30:05');
  assert.equal(venueNow(new Date('2026-11-11T06:30:00Z')), '2026-11-10T23:30:00');
});

test('parseLocalTime accepts local times and rejects everything else', () => {
  assert.equal(parseLocalTime('2026-11-10T11:30'), '2026-11-10T11:30:00');
  assert.equal(parseLocalTime('2026-11-10T11:30:15'), '2026-11-10T11:30:15');
  assert.equal(parseLocalTime('2026-11-10T25:00'), undefined);
  assert.equal(parseLocalTime('2026-11-10T11:30:00Z'), undefined);
  assert.equal(parseLocalTime('soon'), undefined);
  assert.equal(parseLocalTime(undefined), undefined);
});

test('tightConnections flags a gap shorter than the walk', () => {
  const a = S('a', '2026-11-10T11:00:00', '2026-11-10T11:30:00', { room: L1A });
  const b = S('b', '2026-11-10T11:35:00', '2026-11-10T12:00:00', { room: HYATT });
  assert.deepEqual(tightConnections([b, a]), [
    { from: 'a', to: 'b', gapMinutes: 5, walkMinutes: 12, shortByMinutes: 7 },
  ]);
});

test('tightConnections ignores enough time, off-site rooms, and other days', () => {
  const a = S('a', '2026-11-10T11:00:00', '2026-11-10T11:30:00', { room: L1A });
  const exact = S('b', '2026-11-10T11:38:00', '2026-11-10T12:00:00', { room: L2 });
  const off = S('o', '2026-11-10T11:31:00', '2026-11-10T12:00:00', { room: OFF });
  const late = S('d', '2026-11-10T23:50:00', '2026-11-10T23:55:00', { room: L1A });
  const tomorrow = S('e', '2026-11-11T00:00:00', '2026-11-11T00:30:00', { room: HYATT });
  assert.deepEqual(tightConnections([a, exact]), []);
  assert.deepEqual(tightConnections([a, off]), []);
  assert.deepEqual(tightConnections([late, tomorrow]), []);
});

test('nextMove with no sessions is no_plan', () => {
  const m = nextMove([], '2026-11-10T11:00:00', []);
  assert.equal(m.state, 'no_plan');
  assert.equal(m.next, null);
});

test('nextMove after the last pick is done', () => {
  const m = nextMove([morning], '2026-11-10T20:00:00', []);
  assert.equal(m.state, 'done');
  assert.equal(m.current, null);
});

test('nextMove during a pick reports time left and the next stop', () => {
  const m = nextMove([morning, afternoon], '2026-11-10T11:10:00', []);
  assert.equal(m.state, 'in_session');
  assert.equal(m.current?.session.id, 'a');
  assert.equal(m.current?.started_minutes_ago, 10);
  assert.equal(m.current?.ends_in_minutes, 20);
  assert.equal(m.next?.session.id, 'b');
  assert.equal(m.next?.walk_estimate_minutes, 8);
  assert.equal(m.next?.leave_by, '2026-11-10T13:52:00');
  assert.equal(m.walk_basis, 'estimate');
});

test('nextMove during the last pick has no next stop', () => {
  const m = nextMove([morning], '2026-11-10T11:10:00', []);
  assert.equal(m.state, 'in_session');
  assert.equal(m.next, null);
});

test('nextMove says go when the walk time is reached, and walks from the last pick', () => {
  const before = nextMove([morning, afternoon], '2026-11-10T13:51:00', []);
  assert.equal(before.state, 'free');
  assert.equal(before.free_minutes, 1);
  const at = nextMove([morning, afternoon], '2026-11-10T13:52:00', []);
  assert.equal(at.state, 'go_now');
  assert.equal(at.next?.leave_in_minutes, 0);
  assert.equal(at.free_minutes, null);
});

test('nextMove reports a negative leave time when the attendee is behind', () => {
  const m = nextMove([morning, afternoon], '2026-11-10T13:55:00', []);
  assert.equal(m.state, 'go_now');
  assert.equal(m.next?.leave_in_minutes, -3);
});

test('nextMove says leave early when the walk starts before the current pick ends', () => {
  const b = S('b', '2026-11-10T11:35:00', '2026-11-10T12:00:00', { room: HYATT });
  const m = nextMove([morning, b], '2026-11-10T11:25:00', []);
  assert.equal(m.state, 'go_now');
  assert.equal(m.current?.session.id, 'a');
  assert.equal(m.next?.leave_by, '2026-11-10T11:23:00');
});

test('nextMove without an origin says go only near the start', () => {
  const far = nextMove([afternoon], '2026-11-10T09:00:00', []);
  assert.equal(far.state, 'free');
  assert.equal(far.next?.walk_estimate_minutes, null);
  assert.equal(far.next?.leave_by, null);
  assert.equal(far.free_minutes, 300);
  const near = nextMove([afternoon], '2026-11-10T13:45:00', []);
  assert.equal(near.state, 'go_now');
});

test('nextMove does not let an all-day drop-in event hide a later talk', () => {
  const showcase = S('show', '2026-11-10T10:45:00', '2026-11-10T17:15:00', { room: L1A });
  const m = nextMove([showcase, afternoon], '2026-11-10T11:00:00', []);
  assert.equal(m.state, 'in_session');
  assert.equal(m.current?.session.id, 'show');
  assert.equal(m.next?.session.id, 'b');
  assert.equal(m.next?.leave_by, '2026-11-10T13:52:00');
  const during = nextMove([showcase, afternoon], '2026-11-10T14:10:00', []);
  assert.equal(during.current?.session.id, 'b');
  assert.equal(during.next, null);
});

test('nextMove uses the fromRoom override and handles an off-site next stop', () => {
  const m = nextMove([morning, afternoon], '2026-11-10T12:00:00', [], HYATT);
  assert.equal(m.next?.walk_estimate_minutes, 12);
  const off = S('o', '2026-11-10T14:00:00', '2026-11-10T15:00:00', { room: OFF });
  const o = nextMove([morning, off], '2026-11-10T12:00:00', []);
  assert.equal(o.next?.walk_estimate_minutes, null);
  assert.equal(o.next?.leave_by, null);
});

test('nextMove on the day before gives the next pick without a walk or a gap', () => {
  const m = nextMove([nextDay], '2026-11-10T22:00:00', [lunch]);
  assert.equal(m.state, 'free');
  assert.equal(m.next?.session.id, 'c');
  assert.equal(m.next?.walk_estimate_minutes, null);
  assert.equal(m.free_minutes, null);
  assert.deepEqual(m.during_gap, []);
});

test('nextMove skips a later pick that overlaps the current one', () => {
  const clash = S('x', '2026-11-10T11:20:00', '2026-11-10T11:50:00', { room: L1A });
  const m = nextMove([morning, clash, afternoon], '2026-11-10T11:10:00', []);
  assert.equal(m.current?.session.id, 'a');
  assert.equal(m.next?.session.id, 'b');
});

test('nextMove moves on from a missed pick', () => {
  const m = nextMove([morning, afternoon], '2026-11-10T12:00:00', []);
  assert.equal(m.state, 'free');
  assert.equal(m.next?.session.id, 'b');
  assert.equal(m.next?.walk_estimate_minutes, 8);
});

test('nextMove lists food inside the gap and leaves out registration', () => {
  const m = nextMove([morning, afternoon], '2026-11-10T12:00:00', [lunch, registration]);
  assert.deepEqual(
    m.during_gap.map((l) => l.id),
    ['l1'],
  );
  const after = nextMove(
    [morning, S('z', '2026-11-10T12:30:00', '2026-11-10T12:45:00', { room: L1A })],
    '2026-11-10T12:00:00',
    [lunch],
  );
  assert.deepEqual(after.during_gap, []);
});
