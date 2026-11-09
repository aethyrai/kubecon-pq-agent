import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { NextMoveResponse, SessionCard } from './api';
import { type Formatters, headline, MAX_PLAN_IDS, validNow } from './now.ts';

test('the pick limit matches the limit in the api', () => {
  assert.equal(MAX_PLAN_IDS, 40);
});

const f: Formatters = {
  time: (l) => l.slice(11, 16),
  room: (r) => r,
  day: (d) => d,
};
const session = (over: Partial<SessionCard> = {}): SessionCard => ({
  id: 'a',
  title: 'Talk',
  speakers: [],
  track: '',
  level: '',
  day: '2026-11-10',
  start: '2026-11-10T14:00:00',
  end: '2026-11-10T14:30:00',
  room: 'Hall',
  venue: 'Salt Palace',
  colocated_event: '',
  tags: [],
  captioned: false,
  recorded: false,
  url: '',
  ...over,
});
const stop = (over: Partial<NonNullable<NextMoveResponse['next']>> = {}) => ({
  session: session(),
  starts_in_minutes: 10,
  walk_estimate_minutes: 8,
  leave_by: '2026-11-10T13:52:00',
  leave_in_minutes: 2,
  ...over,
});
const move = (over: Partial<NextMoveResponse>): NextMoveResponse => ({
  ids: ['a'],
  missing: [],
  now: '2026-11-10T13:50:00',
  state: 'free',
  current: null,
  next: null,
  free_minutes: null,
  during_gap: [],
  walk_basis: 'estimate',
  ...over,
});

test('validNow accepts only the form the api accepts', () => {
  assert.equal(validNow('2026-11-10T11:30'), '2026-11-10T11:30');
  assert.equal(validNow('2026-11-10T11:30:00'), '2026-11-10T11:30:00');
  assert.equal(validNow('soon'), undefined);
  assert.equal(validNow(['2026-11-10T11:30']), undefined);
  assert.equal(validNow(undefined), undefined);
});

test('go_now names the room and labels the walk as an estimate', () => {
  const h = headline(move({ state: 'go_now', next: stop() }), f);
  assert.equal(h.title, 'Go now to Hall');
  assert.match(h.detail, /about 8 minutes \(estimate\)/);
  assert.doesNotMatch(h.detail, /behind/);
});

test('go_now says how far behind the attendee is, in the singular too', () => {
  const h = headline(move({ state: 'go_now', next: stop({ leave_in_minutes: -1 }) }), f);
  assert.match(h.detail, /You are 1 minute behind\./);
});

test('go_now with no estimate says nothing about the walk', () => {
  const next = stop({ walk_estimate_minutes: null, leave_by: null, leave_in_minutes: null });
  const h = headline(move({ state: 'go_now', next }), f);
  assert.doesNotMatch(h.detail, /walk/);
});

test('in_session names the room and the end time', () => {
  const current = { session: session(), started_minutes_ago: 5, ends_in_minutes: 25 };
  const h = headline(move({ state: 'in_session', current }), f);
  assert.equal(h.title, 'You should be in Hall');
  assert.match(h.detail, /ends at 14:30/);
});

test('free today gives the open time and the leave-by time', () => {
  const h = headline(move({ state: 'free', next: stop(), free_minutes: 2 }), f);
  assert.equal(h.title, 'You are free for 2 minutes');
  assert.match(h.detail, /Leave by 13:52 \(estimate\)/);
});

test('free with no estimate leaves out the leave-by time', () => {
  const next = stop({ walk_estimate_minutes: null, leave_by: null, leave_in_minutes: null });
  const h = headline(move({ state: 'free', next, free_minutes: 60 }), f);
  assert.doesNotMatch(h.detail, /Leave by/);
});

test('free with the next pick on a later day names that day', () => {
  const later = session({ day: '2026-11-11', start: '2026-11-11T09:00:00' });
  const next = stop({ session: later, walk_estimate_minutes: null, leave_by: null });
  const h = headline(move({ state: 'free', next, free_minutes: null }), f);
  assert.equal(h.title, 'Nothing more today');
  assert.match(h.detail, /2026-11-11 at 09:00/);
});

test('no_plan and done have their own words', () => {
  assert.equal(headline(move({ state: 'no_plan' }), f).title, 'Your plan has no talks');
  assert.equal(headline(move({ state: 'done' }), f).title, 'Your plan is finished');
});

test('a state without its session is an error, not a blank page', () => {
  assert.throws(() => headline(move({ state: 'go_now', next: null }), f), /without its session/);
});
