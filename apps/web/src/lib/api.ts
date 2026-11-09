/** Server-side calls to the conference api. In-cluster: http://api.conf.svc; through the tunnel: 127.0.0.1:8080. */
export const API_URL = process.env.API_URL ?? 'http://127.0.0.1:8080';

export interface SessionCard {
  id: string;
  title: string;
  speakers: string[];
  track: string;
  level: string;
  day: string;
  start: string;
  end: string;
  room: string;
  venue: string;
  colocated_event: string;
  tags: string[];
  captioned: boolean;
  recorded: boolean;
  url: string;
  score?: number;
  legs?: Array<'bm25' | 'knn'>;
}
export interface SearchResponse {
  query: string;
  total: number;
  hits: SessionCard[];
}
export interface ScheduleResponse {
  day: string;
  total: number;
  sessions: SessionCard[];
}
export interface Conflict {
  a: string;
  b: string;
  overlapMinutes: number;
}
export interface TightConnection {
  from: string;
  to: string;
  gapMinutes: number;
  walkMinutes: number;
  shortByMinutes: number;
}
export interface ConflictsResponse {
  ids: string[];
  missing: string[];
  conflicts: Conflict[];
  /** Absent from an api that predates walk estimates. */
  tight?: TightConnection[];
  sessions: SessionCard[];
}
export interface LogisticsItem {
  id: string;
  kind: 'registration' | 'coffee' | 'lunch';
  title: string;
  day: string;
  start: string;
  end: string;
  room: string;
  venue: string;
}
export interface LogisticsResponse {
  today: string;
  items: LogisticsItem[];
}
export interface NextMoveResponse {
  ids: string[];
  missing: string[];
  now: string;
  state: 'no_plan' | 'in_session' | 'go_now' | 'free' | 'done';
  current: { session: SessionCard; started_minutes_ago: number; ends_in_minutes: number } | null;
  next: {
    session: SessionCard;
    starts_in_minutes: number;
    walk_estimate_minutes: number | null;
    leave_by: string | null;
    leave_in_minutes: number | null;
  } | null;
  free_minutes: number | null;
  during_gap: LogisticsItem[];
  walk_basis: 'estimate';
}
export interface Exhibitor {
  id: string;
  name: string;
  booth: string;
  tier: string;
  description: string;
  categories: string[];
  url: string;
}
export interface SideEvent {
  id: string;
  name: string;
  host: string;
  start: string;
  end: string;
  address: string;
  rsvp_url: string;
  capacity_note: string;
  description: string;
  badge_required: boolean;
}
export interface RoomAccess {
  room: { id: string; venue: string; level: string; name: string };
  facts: string[];
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}
async function getJson<T>(path: string, guard: (v: unknown) => v is T): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    cache: 'no-store',
    headers: { accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`api ${path}: HTTP ${res.status}`);
  const body: unknown = await res.json();
  if (!guard(body)) throw new Error(`api ${path}: unexpected shape`);
  return body;
}

export const search = (q: string, mode: string): Promise<SearchResponse> =>
  getJson(
    `/search?q=${encodeURIComponent(q)}&size=${mode === 'text' ? 10 : 20}`,
    (v): v is SearchResponse => isObject(v) && Array.isArray(v.hits),
  );
export const schedule = (
  day: string,
  filters: Record<string, string | undefined>,
): Promise<ScheduleResponse> => {
  const qs = Object.entries(filters)
    .filter(([, v]) => v)
    .map(([k, v]) => `${k}=${encodeURIComponent(v ?? '')}`)
    .join('&');
  return getJson(
    `/schedule/${day}${qs ? `?${qs}` : ''}`,
    (v): v is ScheduleResponse => isObject(v) && Array.isArray(v.sessions),
  );
};
export const planConflicts = (ids: string[]): Promise<ConflictsResponse> =>
  getJson(
    `/plan/conflicts?ids=${encodeURIComponent(ids.join(','))}`,
    (v): v is ConflictsResponse => isObject(v) && Array.isArray(v.conflicts),
  );
export const planNext = (ids: string[], now?: string): Promise<NextMoveResponse> =>
  getJson(
    `/plan/next?ids=${encodeURIComponent(ids.join(','))}${now ? `&now=${encodeURIComponent(now)}` : ''}`,
    (v): v is NextMoveResponse =>
      isObject(v) && typeof v.state === 'string' && Array.isArray(v.during_gap),
  );
export const logistics = (): Promise<LogisticsResponse> =>
  getJson('/logistics', (v): v is LogisticsResponse => isObject(v) && Array.isArray(v.items));
export const booths = (q: string): Promise<{ exhibitors: Exhibitor[] }> =>
  getJson(
    `/booths?q=${encodeURIComponent(q)}&size=30`,
    (v): v is { exhibitors: Exhibitor[] } => isObject(v) && Array.isArray(v.exhibitors),
  );
export const sideEvents = (day?: string): Promise<{ events: SideEvent[] }> =>
  getJson(
    `/side-events${day ? `?day=${day}` : ''}`,
    (v): v is { events: SideEvent[] } => isObject(v) && Array.isArray(v.events),
  );
export const roomAccess = (id: string): Promise<RoomAccess | undefined> =>
  getJson(
    `/rooms/${encodeURIComponent(id)}/access`,
    (v): v is RoomAccess => isObject(v) && Array.isArray(v.facts),
  ).catch((e: unknown) => {
    if (e instanceof Error && /HTTP 404/.test(e.message)) return undefined;
    throw e;
  });

export const DAYS: Array<{ day: string; label: string }> = [
  { day: '2026-11-09', label: 'Monday' },
  { day: '2026-11-10', label: 'Tuesday' },
  { day: '2026-11-11', label: 'Wednesday' },
  { day: '2026-11-12', label: 'Thursday' },
];

/** Session times are offset-less Mountain wall-clock strings (2026-11-10T11:30:00). Format them as given. */
export function formatTime(local: string): string {
  const m = /T(\d{2}):(\d{2})/.exec(local);
  if (!m) return local;
  const h24 = Number(m[1]);
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${m[2]} ${h24 < 12 ? 'AM' : 'PM'}`;
}
export function timeRange(s: { start: string; end: string }): string {
  return `${formatTime(s.start)} to ${formatTime(s.end)}`;
}
/** Room ids are not in session cards; the room panel is reached by room name through the schedule's rooms index. */
export function roomSlug(room: string): string {
  return encodeURIComponent(room);
}
/** Weekday name for a conference day, or the raw date for an unknown one. */
export function dayLabel(day: string): string {
  if (day === '2026-11-08') return 'Sunday';
  return DAYS.find((d) => d.day === day)?.label ?? day;
}

/** The identity service, reachable in-cluster only. Serves the signed post-quantum trail. */
export const IDENTITY_URL = process.env.IDENTITY_URL ?? 'http://127.0.0.1:8082';

export interface TrailRecord {
  seq: number;
  at: string;
  kind: string;
  data: Record<string, string>;
  prev: string;
  hash: string;
  sig: string;
  alg: string;
}
export interface TrailResponse {
  algorithm: string;
  publicKey: string;
  head: string;
  fingerprint?: string;
  total?: number;
  from?: number;
  verification: { ok: boolean; count: number; brokenAt?: number; reason?: string };
  records: TrailRecord[];
}
export const trail = async (): Promise<TrailResponse> => {
  const res = await fetch(`${IDENTITY_URL}/trail`, {
    cache: 'no-store',
    headers: { accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`identity /trail: HTTP ${res.status}`);
  const body: unknown = await res.json();
  if (!isTrailResponse(body)) throw new Error('identity /trail: unexpected shape');
  return body;
};
function isTrailResponse(v: unknown): v is TrailResponse {
  return (
    isObject(v) &&
    typeof v.publicKey === 'string' &&
    Array.isArray(v.records) &&
    isObject(v.verification) &&
    typeof v.verification.ok === 'boolean'
  );
}
