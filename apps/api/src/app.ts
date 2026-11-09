import type { SessionFilters } from '@kubecon-pq-agent/es-client';
import { Hono } from 'hono';
import { chaosDelay, mountChaos } from './chaos.js';
import { type Conference, card, conflicts } from './conference.js';
import { log } from './log.js';

export interface Readiness {
  /** True when Elasticsearch answered a health call recently. */
  elasticsearch: () => Promise<boolean>;
}

const DAYS = new Set(['2026-11-08', '2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12']);

function filtersFrom(q: Record<string, string | boolean | undefined>): SessionFilters {
  const f: SessionFilters = {};
  const str = (v: string | boolean | undefined): string | undefined =>
    typeof v === 'string' && v.length > 0 ? v : undefined;
  const day = str(q.day);
  const track = str(q.track);
  const level = str(q.level);
  const venue = str(q.venue);
  const event = str(q.event);
  if (day) f.day = day;
  if (track) f.track = track;
  if (level) f.level = level;
  if (venue) f.venue = venue;
  if (event) f.colocated_event = event;
  if (q.captioned === 'true' || q.captioned === true) f.captioned = true;
  if (q.captioned === 'false' || q.captioned === false) f.captioned = false;
  return f;
}
function sizeFrom(v: string | undefined, dflt: number, max: number): number {
  const n = Number(v ?? dflt);
  return Number.isFinite(n) && n > 0 ? Math.min(Math.floor(n), max) : dflt;
}

export function buildApp(
  ready: Readiness,
  conf: Conference,
  env: NodeJS.ProcessEnv = process.env,
): Hono {
  const app = new Hono();
  mountChaos(app, env);

  app.get('/healthz', (c) => c.json({ status: 'ok' }));
  app.get('/readyz', async (c) => {
    const es = await ready.elasticsearch();
    return c.json({ status: es ? 'ready' : 'not-ready', elasticsearch: es }, es ? 200 : 503);
  });

  /** Hybrid search: BM25 + kNN fused with RRF, filters on both legs. */
  app.get('/search', async (c) => {
    const q = c.req.query('q') ?? '';
    const filters = filtersFrom(c.req.query());
    const size = sizeFrom(c.req.query('size'), 10, 50);
    const hits = await conf.searchSessions(q, filters, size);
    log.info({ q, filters, hits: hits.length }, 'search');
    return c.json({
      query: q,
      filters,
      total: hits.length,
      hits: hits.map((h) => ({ ...card(h.source), score: h.score, legs: h.legs })),
    });
  });

  /** Interest text in, top sessions out, with ids echoed so clients render chips. */
  app.post('/recommend', async (c) => {
    const body: unknown = await c.req.json().catch(() => null);
    const interests =
      typeof body === 'object' &&
      body !== null &&
      typeof (body as { interests?: unknown }).interests === 'string'
        ? (body as { interests: string }).interests
        : '';
    if (interests.trim().length < 3)
      return c.json({ error: 'interests must be at least 3 characters' }, 400);
    const raw =
      typeof body === 'object' && body !== null
        ? ((body as { filters?: Record<string, string> }).filters ?? {})
        : {};
    const filters = filtersFrom(raw);
    const size = sizeFrom(c.req.query('size'), 8, 20);
    const hits = await conf.recommend(interests, filters, size);
    return c.json({
      interests,
      filters,
      session_ids: hits.map((h) => h.id),
      sessions: hits.map((h) => ({ ...card(h.source), score: h.score, legs: h.legs })),
    });
  });

  app.get('/schedule/:day', async (c) => {
    const day = c.req.param('day');
    if (!DAYS.has(day)) return c.json({ error: 'day must be 2026-11-08 to 2026-11-12' }, 400);
    const sessions = await conf.schedule(day, filtersFrom(c.req.query()));
    return c.json({ day, total: sessions.length, sessions: sessions.map(card) });
  });

  /** Given session ids, the overlapping pairs. */
  app.get('/plan/conflicts', async (c) => {
    const ids = [
      ...new Set(
        (c.req.query('ids') ?? '')
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
      ),
    ];
    if (ids.length < 2)
      return c.json({ error: 'ids: at least two comma-separated session ids' }, 400);
    const sessions = await conf.sessionsById(ids);
    const found = new Set(sessions.map((s) => s.id));
    return c.json({
      ids,
      missing: ids.filter((i) => !found.has(i)),
      conflicts: conflicts(sessions),
      sessions: sessions.map(card),
    });
  });

  app.get('/booths', async (c) => {
    const q = c.req.query('q') ?? '';
    const hits = await conf.searchBooths(q, sizeFrom(c.req.query('size'), 10, 50));
    return c.json({
      query: q,
      total: hits.length,
      exhibitors: hits.map((h) => ({ ...h.source, score: h.score })),
    });
  });

  app.get('/side-events', async (c) => {
    const day = c.req.query('day');
    if (day && !DAYS.has(day))
      return c.json({ error: 'day must be 2026-11-08 to 2026-11-12' }, 400);
    const events = await conf.sideEvents(day);
    return c.json({ day: day ?? null, total: events.length, events });
  });

  app.get('/rooms/:id/access', async (c) => {
    const room = await conf.room(c.req.param('id'));
    if (!room) return c.json({ error: 'room not found' }, 404);
    const facts = [
      room.wheelchair_route
        ? `Wheelchair route: ${room.wheelchair_route}`
        : 'Wheelchair route: ask at the Info Desk',
      room.captioning
        ? `Captioning: ${room.captioning}`
        : 'Captioning: live captions on the room screen for keynotes and breakouts',
      `Hearing loop: ${room.hearing_loop ? 'yes' : 'not listed'}`,
      room.quiet_room_nearby
        ? `Nearest quiet room: ${room.quiet_room_nearby}`
        : 'Nearest quiet room: Salt Palace Level 2, Upper Mezzanine',
      room.nearest_accessible_restroom
        ? `Nearest accessible restroom: ${room.nearest_accessible_restroom}`
        : 'Nearest accessible restroom: ask at the Info Desk',
    ];
    return c.json({
      room: { id: room.id, venue: room.venue, level: room.level, name: room.name },
      facts,
    });
  });

  app.notFound((c) => c.json({ error: 'not found' }, 404));
  app.onError((err, c) => {
    log.error({ err }, 'unhandled');
    return c.json({ error: 'internal error' }, 500);
  });
  void chaosDelay;
  return app;
}
