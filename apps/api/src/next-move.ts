import type { LogisticsItem, Session } from './conference.js';

/**
 * Walk times are estimates. The schedule publishes venue and level, not distances, so every
 * response that carries one also says `walk_basis: 'estimate'`.
 */
export const WALK_BASIS = 'estimate';
const WALK_MINUTES = { sameRoom: 0, sameLevel: 5, otherLevel: 8, otherBuilding: 12 } as const;
const BUILDINGS = ['Salt Palace', 'Hyatt Regency'] as const;
/** With no walk estimate, say go this long before the start. */
const DEFAULT_GO_MINUTES = 15;
const VENUE_TIME_ZONE = 'America/Denver';
const LOCAL_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/;

const venueClock = new Intl.DateTimeFormat('sv-SE', {
  timeZone: VENUE_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});

/** The wall clock at the venue, in the offset-less form that session times use. */
export function venueNow(at: Date = new Date()): string {
  return venueClock.format(at).replace(' ', 'T');
}

/** A valid offset-less local time with seconds, or undefined. */
export function parseLocalTime(v: string | undefined): string | undefined {
  if (v === undefined || !LOCAL_TIME.test(v)) return undefined;
  const full = v.length === 16 ? `${v}:00` : v;
  return Number.isNaN(Date.parse(`${full}Z`)) ? undefined : full;
}

/** Session times are wall-clock strings. Reading both as UTC keeps the arithmetic DST-free. */
function minutesBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}Z`) - Date.parse(`${from}Z`)) / 60000);
}
function minusMinutes(local: string, minutes: number): string {
  return new Date(Date.parse(`${local}Z`) - minutes * 60000).toISOString().slice(0, 19);
}

/** An event this long, such as the Solutions Showcase, is drop-in: it does not hide later picks. */
const DROP_IN_MINUTES = 120;
function isDropIn(s: Pick<Session, 'start' | 'end'>): boolean {
  return minutesBetween(s.start, s.end) >= DROP_IN_MINUTES;
}

interface Place {
  building: string;
  level: string | undefined;
}
function placeOf(room: string): Place | undefined {
  const building = BUILDINGS.find((b) => room.startsWith(b));
  if (!building) return undefined;
  return { building, level: /\|\s*Level\s+(\d+)/i.exec(room)?.[1] };
}

/** Estimated minutes between two rooms, or null when either room is off-site or unknown. */
export function walkMinutes(from: string, to: string): number | null {
  const a = placeOf(from);
  const b = placeOf(to);
  if (!a || !b) return null;
  if (from === to) return WALK_MINUTES.sameRoom;
  if (a.building !== b.building) return WALK_MINUTES.otherBuilding;
  return a.level !== undefined && a.level === b.level
    ? WALK_MINUTES.sameLevel
    : WALK_MINUTES.otherLevel;
}

export interface TightConnection {
  from: string;
  to: string;
  gapMinutes: number;
  walkMinutes: number;
  shortByMinutes: number;
}

const byStart = <T extends Pick<Session, 'start'>>(sessions: readonly T[]): T[] =>
  [...sessions].sort((a, b) => a.start.localeCompare(b.start));

/** Picks that do not overlap but leave less time than the estimated walk. */
export function tightConnections(sessions: readonly Session[]): TightConnection[] {
  const sorted = byStart(sessions);
  const out: TightConnection[] = [];
  for (const a of sorted) {
    const b = sorted.find((s) => s.id !== a.id && s.day === a.day && s.start >= a.end);
    if (!b) continue;
    const walk = walkMinutes(a.room, b.room);
    const gap = minutesBetween(a.end, b.start);
    if (walk === null || gap >= walk) continue;
    out.push({
      from: a.id,
      to: b.id,
      gapMinutes: gap,
      walkMinutes: walk,
      shortByMinutes: walk - gap,
    });
  }
  return out;
}

export type NextMoveState = 'no_plan' | 'in_session' | 'go_now' | 'free' | 'done';

export interface NextMove<S> {
  now: string;
  state: NextMoveState;
  current: { session: S; started_minutes_ago: number; ends_in_minutes: number } | null;
  next: {
    session: S;
    starts_in_minutes: number;
    walk_estimate_minutes: number | null;
    leave_by: string | null;
    leave_in_minutes: number | null;
  } | null;
  /** Open time before the next pick on the same day. Null when there is no such pick. */
  free_minutes: number | null;
  /** Coffee and lunch that fall inside the open time. */
  during_gap: LogisticsItem[];
  walk_basis: typeof WALK_BASIS;
}

/**
 * What the attendee should do at `now`, given their picks. The attendee's location is the
 * `fromRoom` override, else the pick in progress, else the last pick that ended today.
 */
export function nextMove<S extends Pick<Session, 'day' | 'start' | 'end' | 'room'>>(
  sessions: readonly S[],
  now: string,
  logistics: readonly LogisticsItem[],
  fromRoom?: string,
): NextMove<S> {
  const sorted = byStart(sessions);
  const base = { now, walk_basis: WALK_BASIS } as const;
  const empty = { current: null, next: null, free_minutes: null, during_gap: [] };
  if (sorted.length === 0) return { ...base, ...empty, state: 'no_plan' };

  const today = now.slice(0, 10);
  const inProgress = sorted.filter((s) => s.start <= now && now < s.end);
  const running = inProgress.find((s) => !isDropIn(s)) ?? inProgress[0];
  const availableFrom = running && !isDropIn(running) ? running.end : now;
  const upcoming = sorted.find((s) => s.start > now && s.start >= availableFrom);
  const current = running
    ? {
        session: running,
        started_minutes_ago: minutesBetween(running.start, now),
        ends_in_minutes: minutesBetween(now, running.end),
      }
    : null;
  if (!current && !upcoming) return { ...base, ...empty, state: 'done' };
  if (!upcoming) {
    return { ...base, ...empty, current, state: 'in_session' };
  }

  const sameDay = upcoming.day === today;
  const lastEnded = sorted.filter((s) => s.day === today && s.end <= now).at(-1);
  const origin = fromRoom ?? running?.room ?? lastEnded?.room;
  const walk = sameDay && origin !== undefined ? walkMinutes(origin, upcoming.room) : null;
  const leaveBy = walk === null ? null : minusMinutes(upcoming.start, walk);
  const startsIn = minutesBetween(now, upcoming.start);
  const leaveIn = leaveBy === null ? null : minutesBetween(now, leaveBy);
  const next = {
    session: upcoming,
    starts_in_minutes: startsIn,
    walk_estimate_minutes: walk,
    leave_by: leaveBy,
    leave_in_minutes: leaveIn,
  };

  const goNow = sameDay && (leaveIn === null ? startsIn <= DEFAULT_GO_MINUTES : leaveIn <= 0);
  if (goNow) return { ...base, current, next, free_minutes: null, during_gap: [], state: 'go_now' };

  const gapEnd = leaveBy ?? upcoming.start;
  const state = current ? 'in_session' : 'free';
  if (!sameDay) return { ...base, current, next, free_minutes: null, during_gap: [], state };
  return {
    ...base,
    current,
    next,
    state,
    free_minutes: Math.max(0, minutesBetween(availableFrom, gapEnd)),
    during_gap: logistics.filter(
      (l) =>
        l.kind !== 'registration' && l.day === today && l.start < gapEnd && l.end > availableFrom,
    ),
  };
}
