import type { Hit } from '@kubecon-pq-agent/es-client';
import type { Conference, Exhibitor, Room, Session, SideEvent } from '../conference.js';

export const S = (
  id: string,
  start: string,
  end: string,
  extra: Partial<Session> = {},
): Session => ({
  id,
  title: `Talk ${id}`,
  abstract: 'About agents.',
  speakers: ['A. Speaker'],
  track: 'AI Inference + Agentic',
  level: 'Any Level',
  day: start.slice(0, 10),
  start,
  end,
  room: 'Salt Palace | Level 1 | Grand Ballroom BDF',
  venue: 'Salt Palace',
  colocated_event: '',
  tags: ['agents'],
  captioned: false,
  recorded: false,
  url: `https://example.test/?id=${id}`,
  ...extra,
});

export const SESSIONS: Session[] = [
  S('s1', '2026-11-10T11:00:00', '2026-11-10T11:35:00'),
  S('s2', '2026-11-10T11:20:00', '2026-11-10T11:55:00', { captioned: true }),
  S('s3', '2026-11-10T14:00:00', '2026-11-10T14:35:00', { track: 'Security' }),
  S('s4', '2026-11-11T09:00:00', '2026-11-11T09:30:00'),
];

const hit = <T extends { id: string }>(s: T, i: number): Hit<T> => ({
  id: s.id,
  score: 1 / (60 + i + 1),
  source: s,
  legs: ['bm25'],
});

export function fakeConference(): Conference & { calls: string[] } {
  const calls: string[] = [];
  const byFilters = (f: {
    day?: string | undefined;
    track?: string | undefined;
    captioned?: boolean | undefined;
  }) =>
    SESSIONS.filter(
      (s) =>
        (!f.day || s.day === f.day) &&
        (!f.track || s.track === f.track) &&
        (f.captioned === undefined || s.captioned === f.captioned),
    );
  return {
    calls,
    async searchSessions(text, filters, size) {
      calls.push(`search:${text}`);
      return byFilters(filters).slice(0, size).map(hit);
    },
    async recommend(interests, filters, size) {
      calls.push(`recommend:${interests}`);
      return byFilters(filters).slice(0, size).map(hit);
    },
    async schedule(day, filters) {
      calls.push(`schedule:${day}`);
      return byFilters({ ...filters, day }).sort((a, b) => a.start.localeCompare(b.start));
    },
    async sessionsById(ids) {
      return SESSIONS.filter((s) => ids.includes(s.id));
    },
    async searchBooths(text, size) {
      calls.push(`booths:${text}`);
      const ex: Exhibitor = {
        id: 'honeycomb',
        name: 'Honeycomb',
        booth: '203',
        tier: 'Silver',
        description: 'Observability',
        categories: ['Observability'],
        hall: '',
        url: '',
      };
      return [ex].slice(0, size).map(hit);
    },
    async sideEvents(day) {
      const ev: SideEvent = {
        id: 'coloc-1',
        name: 'Agent Rush Hackathon',
        host: 'Vultr',
        start: '2026-11-08T09:00:00',
        end: '2026-11-08T17:00:00',
        address: 'Off-Site',
        rsvp_url: '',
        capacity_note: 'Sold out',
        description: '',
        badge_required: false,
      };
      return !day || day === '2026-11-08' ? [ev] : [];
    },
    async room(id) {
      const r: Room = {
        id: '82949',
        venue: 'Salt Palace',
        level: 'Level 1',
        name: 'Grand Ballroom BDF',
        wheelchair_route: '',
        captioning: '',
        hearing_loop: false,
        quiet_room_nearby: '',
        nearest_accessible_restroom: '',
      };
      return id === r.id ? r : undefined;
    },
  };
}
