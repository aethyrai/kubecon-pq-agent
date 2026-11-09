/**
 * Geometry for the day ruler: a CSS grid with one row per ten-minute slot and one
 * column per venue. Sessions are placed by grid line from their wall-clock times, so an
 * overlap in one venue shows as two blocks side by side. Nothing here touches the DOM.
 */

export const SLOT_MINUTES = 10;
export const UNKNOWN_VENUE = 'Other venue';
const MAIN_VENUE = 'Salt Palace';

export interface Timed {
  start: string;
  end: string;
  venue: string;
}
export interface Frame {
  /** Minutes after midnight for grid line 1. Always a whole hour. */
  startMin: number;
  /** Minutes after midnight for the last grid line. Always a whole hour. */
  endMin: number;
  rows: number;
}
export interface Span {
  start: number;
  end: number;
}

/** Wall-clock minutes after midnight from an offset-less ISO string, or undefined. */
export function minutesOf(local: string): number | undefined {
  const m = /T(\d{2}):(\d{2})/.exec(local);
  if (!m) return undefined;
  return Number(m[1]) * 60 + Number(m[2]);
}

/** Whole hours around the first start and the last end. Undefined when nothing parses. */
export function dayFrame(sessions: readonly Timed[]): Frame | undefined {
  let first = Number.POSITIVE_INFINITY;
  let last = Number.NEGATIVE_INFINITY;
  for (const s of sessions) {
    const a = minutesOf(s.start);
    const b = minutesOf(s.end);
    if (a === undefined || b === undefined) continue;
    first = Math.min(first, a);
    last = Math.max(last, b);
  }
  if (!Number.isFinite(first) || !Number.isFinite(last)) return undefined;
  const startMin = Math.floor(first / 60) * 60;
  const endMin = Math.ceil(last / 60) * 60;
  return { startMin, endMin, rows: (endMin - startMin) / SLOT_MINUTES };
}

/** 1-based grid lines for a session. Partial slots round outward. Clamped to the frame. */
export function rowSpan(s: Timed, f: Frame): Span {
  const a = minutesOf(s.start) ?? f.startMin;
  const b = minutesOf(s.end) ?? a + SLOT_MINUTES;
  const lastLine = f.rows + 1;
  const start = Math.min(
    lastLine - 1,
    Math.max(1, Math.floor((a - f.startMin) / SLOT_MINUTES) + 1),
  );
  const end = Math.min(
    lastLine,
    Math.max(start + 1, Math.ceil((b - f.startMin) / SLOT_MINUTES) + 1),
  );
  return { start, end };
}

/** One mark per whole hour inside the frame, with the row it starts on. */
export function hourMarks(f: Frame): Array<{ row: number; label: string }> {
  const out: Array<{ row: number; label: string }> = [];
  for (let m = f.startMin; m < f.endMin; m += 60) {
    const h24 = Math.floor(m / 60) % 24;
    const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
    out.push({
      row: (m - f.startMin) / SLOT_MINUTES + 1,
      label: `${h12} ${h24 < 12 ? 'AM' : 'PM'}`,
    });
  }
  return out;
}

/** Venue columns: the main venue first, then alphabetical, then the unknown bucket. */
export function venuesOf(sessions: readonly Timed[]): string[] {
  const named = new Set<string>();
  let unknown = false;
  for (const s of sessions) {
    if (s.venue) named.add(s.venue);
    else unknown = true;
  }
  const rest = [...named].filter((v) => v !== MAIN_VENUE).sort((a, b) => a.localeCompare(b));
  return [
    ...(named.has(MAIN_VENUE) ? [MAIN_VENUE] : []),
    ...rest,
    ...(unknown ? [UNKNOWN_VENUE] : []),
  ];
}

/** The most sessions live at one instant within a single venue. 0 for no sessions. */
export function maxConcurrency(sessions: readonly Timed[]): number {
  const byVenue = new Map<string, Array<{ at: number; delta: number }>>();
  for (const s of sessions) {
    const a = minutesOf(s.start);
    const b = minutesOf(s.end);
    if (a === undefined || b === undefined) continue;
    const list = byVenue.get(s.venue) ?? [];
    list.push({ at: a, delta: 1 }, { at: b, delta: -1 });
    byVenue.set(s.venue, list);
  }
  let max = 0;
  for (const events of byVenue.values()) {
    // Ends sort before starts at the same minute, so back-to-back talks do not overlap.
    events.sort((x, y) => x.at - y.at || x.delta - y.delta);
    let live = 0;
    for (const e of events) {
      live += e.delta;
      max = Math.max(max, live);
    }
  }
  return max;
}

export interface RoomParts {
  venue: string;
  level: string;
  name: string;
}

/**
 * "Salt Palace | Level 1 | 151" becomes venue "Salt Palace", level "Level 1", name "Room 151".
 * Extra segments join the name with commas. A string without separators is all name.
 */
export function splitRoom(room: string): RoomParts {
  const parts = room
    .split('|')
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length < 2) return { venue: '', level: '', name: parts[0] ?? '' };
  const venue = parts[0] ?? '';
  const level = parts.find((p, i) => i > 0 && /^level\b/i.test(p)) ?? '';
  const name = parts.filter((p, i) => i > 0 && p !== level).join(', ');
  return { venue, level, name: /^\d+[a-z]?$/i.test(name) ? `Room ${name}` : name };
}

/** Room name with its level, without the venue. The ruler column already names the venue. */
export function shortRoom(room: string): string {
  const r = splitRoom(room);
  if (!r.name) return '';
  return r.level ? `${r.name}, ${r.level}` : r.name;
}
