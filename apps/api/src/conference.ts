import type { Hit, SessionFilters } from '@kubecon-pq-agent/es-client';

export interface Session {
  id: string;
  title: string;
  abstract: string;
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
}
export interface Exhibitor {
  id: string;
  name: string;
  booth: string;
  tier: string;
  description: string;
  categories: string[];
  hall: string;
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
export interface Room {
  id: string;
  venue: string;
  level: string;
  name: string;
  wheelchair_route: string;
  captioning: string;
  hearing_loop: boolean;
  quiet_room_nearby: string;
  nearest_accessible_restroom: string;
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

/** Everything the routes need from the data layer, so the routes are tested without Elasticsearch. */
export interface Conference {
  searchSessions(text: string, filters: SessionFilters, size: number): Promise<Hit<Session>[]>;
  recommend(interests: string, filters: SessionFilters, size: number): Promise<Hit<Session>[]>;
  schedule(day: string, filters: SessionFilters): Promise<Session[]>;
  sessionsById(ids: string[]): Promise<Session[]>;
  searchBooths(text: string, size: number): Promise<Hit<Exhibitor>[]>;
  sideEvents(day?: string): Promise<SideEvent[]>;
  room(id: string): Promise<Room | undefined>;
  logistics(day?: string): Promise<LogisticsItem[]>;
}

/** Sessions overlap when one starts before the other ends and they are on the same day. */
export function overlaps(
  a: Pick<Session, 'start' | 'end'>,
  b: Pick<Session, 'start' | 'end'>,
): boolean {
  return a.start < b.end && b.start < a.end;
}

export interface Conflict {
  a: string;
  b: string;
  overlapMinutes: number;
}

export function conflicts(sessions: Session[]): Conflict[] {
  const out: Conflict[] = [];
  for (let i = 0; i < sessions.length; i++) {
    for (let j = i + 1; j < sessions.length; j++) {
      const a = sessions[i];
      const b = sessions[j];
      if (!a || !b || !overlaps(a, b)) continue;
      const start = Math.max(Date.parse(a.start), Date.parse(b.start));
      const end = Math.min(Date.parse(a.end), Date.parse(b.end));
      out.push({ a: a.id, b: b.id, overlapMinutes: Math.round((end - start) / 60000) });
    }
  }
  return out;
}

/** Trim a session for API responses: no abstract in lists, keep what a card needs. */
export function card(s: Session): Omit<Session, 'abstract'> & { abstract?: string } {
  const { abstract: _abstract, ...rest } = s;
  return rest;
}
