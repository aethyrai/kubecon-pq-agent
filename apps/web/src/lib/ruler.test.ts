import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  dayFrame,
  hourMarks,
  maxConcurrency,
  minutesOf,
  rowSpan,
  SLOT_MINUTES,
  shortRoom,
  splitRoom,
  venuesOf,
} from './ruler.ts';

const s = (start: string, end: string, venue = 'Salt Palace') => ({
  start: `2026-11-10T${start}:00`,
  end: `2026-11-10T${end}:00`,
  venue,
});

test('minutesOf reads the wall-clock minutes from an offset-less ISO string', () => {
  assert.equal(minutesOf('2026-11-10T11:30:00'), 690);
  assert.equal(minutesOf('2026-11-10T00:00:00'), 0);
  assert.equal(minutesOf('garbage'), undefined);
});

test('dayFrame spans from the hour before the first start to the hour after the last end', () => {
  const f = dayFrame([s('11:30', '12:00'), s('14:50', '15:20')]);
  assert.deepEqual(f, { startMin: 660, endMin: 960, rows: 30 });
  assert.equal(dayFrame([]), undefined);
  assert.equal(dayFrame([{ start: 'x', end: 'y', venue: '' }]), undefined);
});

test('dayFrame keeps a whole-hour end when the last session ends on the hour', () => {
  const f = dayFrame([s('11:30', '12:00')]);
  assert.equal(f?.endMin, 720);
  assert.equal(f?.rows, 6);
});

test('rowSpan places a session on 1-based grid lines in ten-minute slots', () => {
  const f = { startMin: 660, endMin: 960, rows: 30 };
  assert.deepEqual(rowSpan(s('11:30', '12:00'), f), { start: 4, end: 7 });
  assert.deepEqual(rowSpan(s('11:00', '11:10'), f), { start: 1, end: 2 });
});

test('rowSpan rounds a partial slot outward so a short talk still has a row', () => {
  const f = { startMin: 660, endMin: 960, rows: 30 };
  assert.deepEqual(rowSpan(s('11:05', '11:20'), f), { start: 1, end: 3 });
  assert.equal(SLOT_MINUTES, 10);
});

test('rowSpan clamps a session that leaves the frame', () => {
  const f = { startMin: 660, endMin: 720, rows: 6 };
  assert.deepEqual(rowSpan(s('11:50', '12:30'), f), { start: 6, end: 7 });
});

test('hourMarks lists each whole hour with its grid row and label', () => {
  const f = { startMin: 660, endMin: 840, rows: 18 };
  assert.deepEqual(hourMarks(f), [
    { row: 1, label: '11 AM' },
    { row: 7, label: '12 PM' },
    { row: 13, label: '1 PM' },
  ]);
});

test('venuesOf puts Salt Palace first, then the rest alphabetically, unknown last', () => {
  assert.deepEqual(
    venuesOf([s('11:00', '11:30', 'Hyatt Regency'), s('11:00', '11:30'), s('11:00', '11:30', '')]),
    ['Salt Palace', 'Hyatt Regency', 'Other venue'],
  );
});

test('maxConcurrency counts the most sessions that overlap at one moment in one venue', () => {
  assert.equal(maxConcurrency([]), 0);
  assert.equal(maxConcurrency([s('11:00', '11:30')]), 1);
  assert.equal(maxConcurrency([s('11:00', '11:30'), s('11:30', '12:00')]), 1);
  assert.equal(maxConcurrency([s('11:00', '11:30'), s('11:10', '11:40'), s('11:20', '11:50')]), 3);
  assert.equal(maxConcurrency([s('11:00', '11:30'), s('11:00', '11:30', 'Hyatt Regency')]), 1);
});

test('splitRoom separates venue, level and room name', () => {
  assert.deepEqual(
    splitRoom('Salt Palace | Level 1 | Solutions Showcase | Hall 5 | Cosmic Canyon Zone'),
    {
      venue: 'Salt Palace',
      level: 'Level 1',
      name: 'Solutions Showcase, Hall 5, Cosmic Canyon Zone',
    },
  );
  assert.deepEqual(splitRoom('Salt Palace | Level 1 | 151 '), {
    venue: 'Salt Palace',
    level: 'Level 1',
    name: 'Room 151',
  });
  assert.deepEqual(splitRoom('Grand Ballroom'), { venue: '', level: '', name: 'Grand Ballroom' });
});

test('shortRoom keeps the room name and level, drops the venue', () => {
  assert.equal(
    shortRoom('Hyatt Regency | Level 2 | Salt Lake Ballroom DE'),
    'Salt Lake Ballroom DE, Level 2',
  );
  assert.equal(shortRoom('Salt Palace | Level 1 | 151 '), 'Room 151, Level 1');
  assert.equal(shortRoom('Grand Ballroom'), 'Grand Ballroom');
  assert.equal(shortRoom(''), '');
});
